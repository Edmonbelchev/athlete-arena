-- Fix ambiguous "exercise_type" in credit_daily_mission_reps
-- (PL/pgSQL output column vs daily_mission_rep_sources.exercise_type).

create or replace function public.credit_daily_mission_reps(
  p_exercise public.exercise_type,
  p_source_type text,
  p_source_id text,
  p_source_total_reps integer
)
returns table (
  daily_challenge_id uuid,
  mission_index integer,
  exercise_type public.exercise_type,
  target_reps integer,
  completed_reps integer,
  status public.challenge_status,
  just_completed boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_mission_index integer;
  v_challenge public.daily_challenges;
  v_previous_credited integer := 0;
  v_delta integer;
  v_new_reps integer;
  v_was_completed boolean;
  v_just_completed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_source_total_reps is null or p_source_total_reps < 0 then
    return;
  end if;

  v_mission_index := public.resolve_user_daily_mission_for_exercise(
    v_user_id,
    v_today,
    p_exercise
  );

  if v_mission_index is null then
    return;
  end if;

  select dmrs.credited_reps
  into v_previous_credited
  from public.daily_mission_rep_sources dmrs
  where dmrs.user_id = v_user_id
    and dmrs.challenge_date = v_today
    and dmrs.exercise_type = p_exercise
    and dmrs.source_type = p_source_type
    and dmrs.source_id = p_source_id;

  v_delta := greatest(p_source_total_reps - coalesce(v_previous_credited, 0), 0);

  if v_delta = 0 then
    select dc.*
    into v_challenge
    from public.daily_challenges dc
    where dc.user_id = v_user_id
      and dc.challenge_date = v_today
      and dc.mission_index = v_mission_index;

    if found then
      daily_challenge_id := v_challenge.id;
      mission_index := v_challenge.mission_index;
      exercise_type := v_challenge.exercise_type;
      target_reps := v_challenge.target_reps;
      completed_reps := v_challenge.completed_reps;
      status := v_challenge.status;
      just_completed := false;
      return next;
    end if;
  end if;

  insert into public.daily_mission_rep_sources (
    user_id,
    challenge_date,
    exercise_type,
    source_type,
    source_id,
    credited_reps
  )
  values (
    v_user_id,
    v_today,
    p_exercise,
    p_source_type,
    p_source_id,
    p_source_total_reps
  )
  on conflict on constraint daily_mission_rep_sources_unique
  do update
  set
    credited_reps = excluded.credited_reps,
    updated_at = now();

  v_challenge := public.get_or_create_daily_challenge(v_mission_index);

  if v_challenge.exercise_type <> p_exercise then
    return;
  end if;

  if v_challenge.status = 'completed' then
    daily_challenge_id := v_challenge.id;
    mission_index := v_challenge.mission_index;
    exercise_type := v_challenge.exercise_type;
    target_reps := v_challenge.target_reps;
    completed_reps := v_challenge.completed_reps;
    status := v_challenge.status;
    just_completed := false;
    return next;
  end if;

  v_was_completed := v_challenge.status = 'completed';
  v_new_reps := least(v_challenge.target_reps, v_challenge.completed_reps + v_delta);

  update public.daily_challenges dc
  set
    completed_reps = v_new_reps,
    status = case
      when dc.status = 'pending' and v_new_reps > 0 then 'in_progress'::public.challenge_status
      else dc.status
    end
  where dc.id = v_challenge.id
  returning * into v_challenge;

  if v_new_reps >= v_challenge.target_reps then
    v_challenge := public.finalize_daily_mission_rewards(v_challenge.id);
    v_just_completed := not v_was_completed;
  end if;

  daily_challenge_id := v_challenge.id;
  mission_index := v_challenge.mission_index;
  exercise_type := v_challenge.exercise_type;
  target_reps := v_challenge.target_reps;
  completed_reps := v_challenge.completed_reps;
  status := v_challenge.status;
  just_completed := v_just_completed;
  return next;
end;
$$;
