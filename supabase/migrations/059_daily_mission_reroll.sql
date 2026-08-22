-- Per-user daily quest re-roll: swap one mission slot to a chosen alternate exercise.
-- Rep crediting resolves the user's active slot per exercise instead of a global mapping.

alter table public.profiles
  add column if not exists daily_quest_reroll_used_on date;

alter table public.daily_challenges
  add column if not exists is_rerolled boolean not null default false;

create or replace function public.resolve_user_daily_mission_for_exercise(
  p_user_id uuid,
  p_date date,
  p_exercise public.exercise_type
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mission_index integer;
  v_default_index integer;
  v_user_slot_exercise public.exercise_type;
  v_template_exercise public.exercise_type;
begin
  select dc.mission_index
  into v_mission_index
  from public.daily_challenges dc
  where dc.user_id = p_user_id
    and dc.challenge_date = p_date
    and dc.exercise_type = p_exercise
    and dc.status <> 'completed'
  order by dc.mission_index
  limit 1;

  if v_mission_index is not null then
    return v_mission_index;
  end if;

  v_default_index := public.resolve_daily_mission_index(p_exercise);

  if v_default_index is null then
    return null;
  end if;

  select dc.exercise_type
  into v_user_slot_exercise
  from public.daily_challenges dc
  where dc.user_id = p_user_id
    and dc.challenge_date = p_date
    and dc.mission_index = v_default_index;

  if v_user_slot_exercise is not null then
    if v_user_slot_exercise = p_exercise then
      return v_default_index;
    end if;

    return null;
  end if;

  select t.exercise_type
  into v_template_exercise
  from public.daily_challenge_templates t
  where t.challenge_date = p_date
    and t.mission_index = v_default_index;

  if v_template_exercise = p_exercise then
    return v_default_index;
  end if;

  return null;
end;
$$;

create or replace function public.get_user_daily_mission_exercises(
  p_user_id uuid,
  p_date date
)
returns public.exercise_type[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exercises public.exercise_type[] := array[]::public.exercise_type[];
  v_mission_index integer;
  v_exercise public.exercise_type;
begin
  perform public.ensure_daily_mission_templates(p_date);

  for v_mission_index in 0..2 loop
    select coalesce(dc.exercise_type, t.exercise_type)
    into v_exercise
    from public.daily_challenge_templates t
    left join public.daily_challenges dc
      on dc.user_id = p_user_id
      and dc.challenge_date = p_date
      and dc.mission_index = t.mission_index
    where t.challenge_date = p_date
      and t.mission_index = v_mission_index;

    if v_exercise is not null then
      v_exercises := array_append(v_exercises, v_exercise);
    end if;
  end loop;

  return v_exercises;
end;
$$;

create or replace function public.reroll_daily_mission(
  p_mission_index integer,
  p_exercise public.exercise_type
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_day_number bigint;
  v_tier_roll integer;
  v_target_reps integer;
  v_template public.daily_challenge_templates;
  v_challenge public.daily_challenges;
  v_current_exercises public.exercise_type[];
  v_reroll_used_on date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  if p_exercise not in ('push_ups', 'squats', 'pull_ups', 'burpees') then
    raise exception 'Exercise cannot be used for daily quests';
  end if;

  select daily_quest_reroll_used_on
  into v_reroll_used_on
  from public.profiles
  where id = v_user_id;

  if v_reroll_used_on = v_today then
    raise exception 'Daily quest re-roll already used today';
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  v_current_exercises := public.get_user_daily_mission_exercises(v_user_id, v_today);

  if p_exercise = any (v_current_exercises) then
    raise exception 'Exercise is already part of today''s quests';
  end if;

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = v_today
    and mission_index = p_mission_index;

  if not found then
    raise exception 'Daily mission template not found';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today
    and mission_index = p_mission_index
  for update;

  if found then
    if v_challenge.status = 'completed' then
      raise exception 'Cannot re-roll a completed quest';
    end if;

    if v_challenge.completed_reps > 0 then
      raise exception 'Cannot re-roll a quest with progress';
    end if;
  end if;

  v_day_number := (extract(epoch from v_today::timestamptz)::bigint / 86400)::bigint;
  v_tier_roll := ((v_day_number + p_mission_index * 17) % 4)::integer;

  select tier.target_reps
  into v_target_reps
  from public.pick_daily_mission_tier(p_exercise, v_tier_roll) as tier;

  if v_challenge.id is null then
    insert into public.daily_challenges (
      user_id,
      exercise_type,
      target_reps,
      xp_reward,
      challenge_date,
      mission_index,
      is_rerolled
    )
    values (
      v_user_id,
      p_exercise,
      v_target_reps,
      50,
      v_today,
      p_mission_index,
      true
    )
    returning * into v_challenge;
  else
    update public.daily_challenges
    set
      exercise_type = p_exercise,
      target_reps = v_target_reps,
      xp_reward = 50,
      completed_reps = 0,
      status = 'pending',
      completed_at = null,
      is_rerolled = true
    where id = v_challenge.id
    returning * into v_challenge;
  end if;

  update public.profiles
  set daily_quest_reroll_used_on = v_today
  where id = v_user_id;

  return v_challenge;
end;
$$;

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

  select credited_reps
  into v_previous_credited
  from public.daily_mission_rep_sources
  where user_id = v_user_id
    and challenge_date = v_today
    and exercise_type = p_exercise
    and source_type = p_source_type
    and source_id = p_source_id;

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

  update public.daily_challenges
  set
    completed_reps = v_new_reps,
    status = case
      when status = 'pending' and v_new_reps > 0 then 'in_progress'::public.challenge_status
      else status
    end
  where id = v_challenge.id
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

drop function if exists public.get_daily_challenge_home();

create or replace function public.get_daily_challenge_home()
returns table (
  mission_index integer,
  template_id uuid,
  challenge_date date,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  catalog_slot integer,
  user_challenge_id uuid,
  user_status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  is_rerolled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  return query
  select
    t.mission_index,
    t.id,
    t.challenge_date,
    coalesce(dc.exercise_type, t.exercise_type) as exercise_type,
    coalesce(dc.target_reps, t.target_reps) as target_reps,
    t.xp_reward,
    t.catalog_slot,
    dc.id,
    dc.status,
    coalesce(dc.completed_reps, 0),
    dc.completed_at,
    coalesce(dc.is_rerolled, false)
  from public.daily_challenge_templates t
  left join public.daily_challenges dc
    on dc.user_id = v_user_id
    and dc.challenge_date = v_today
    and dc.mission_index = t.mission_index
  where t.challenge_date = v_today
  order by t.mission_index;
end;
$$;

grant execute on function public.resolve_user_daily_mission_for_exercise(uuid, date, public.exercise_type) to authenticated;
grant execute on function public.get_user_daily_mission_exercises(uuid, date) to authenticated;
grant execute on function public.reroll_daily_mission(integer, public.exercise_type) to authenticated;
grant execute on function public.get_daily_challenge_home() to authenticated;
