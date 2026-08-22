-- Accumulate daily mission reps from any matching exercise activity across the app.
-- Credits are deduplicated per (user, source, exercise, date).

create table if not exists public.daily_mission_rep_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_date date not null,
  exercise_type public.exercise_type not null,
  source_type text not null,
  source_id text not null,
  credited_reps integer not null default 0 check (credited_reps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_mission_rep_sources_unique
    unique (user_id, challenge_date, exercise_type, source_type, source_id)
);

alter table public.daily_mission_rep_sources enable row level security;

create policy "Users can read own daily mission rep sources"
  on public.daily_mission_rep_sources
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.resolve_daily_mission_index(
  p_exercise public.exercise_type
)
returns integer
language plpgsql
immutable
as $$
begin
  case p_exercise
    when 'push_ups' then return 0;
    when 'squats' then return 1;
    when 'pull_ups' then return 2;
    else return null;
  end case;
end;
$$;

create or replace function public.finalize_daily_mission_rewards(
  p_challenge_id uuid
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
  v_yesterday date := current_date - 1;
  v_yesterday_all_complete boolean;
  v_all_missions_complete boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
  v_earned_xp constant integer := 50;
  v_earned_coins constant integer := 20;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  update public.daily_challenges
  set
    status = 'completed',
    completed_reps = v_challenge.target_reps,
    xp_reward = v_earned_xp,
    completed_at = now()
  where id = p_challenge_id
  returning * into v_challenge;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  v_new_total_xp := v_new_total_xp + v_earned_xp;
  v_new_level := public.calculate_level(v_new_total_xp);

  select count(*) = 3
  into v_all_missions_complete
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_challenge.challenge_date
    and status = 'completed';

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  if v_all_missions_complete then
    select count(*) = 3
    into v_yesterday_all_complete
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed';

    if v_yesterday_all_complete then
      v_new_streak := v_current_streak + 1;
    else
      v_new_streak := 1;
    end if;

    v_new_longest_streak := greatest(v_new_longest_streak, v_new_streak);

    update public.profiles
    set
      total_xp = v_new_total_xp,
      level = v_new_level,
      current_streak = v_new_streak,
      longest_streak = v_new_longest_streak
    where id = v_user_id;
  else
    update public.profiles
    set
      total_xp = v_new_total_xp,
      level = v_new_level
    where id = v_user_id;
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.log_xp_event(
    v_user_id,
    v_earned_xp,
    'daily_challenge',
    v_challenge.id::text
  );

  perform public.award_coins(v_user_id, v_earned_coins);

  perform public.credit_user_goal_progress_for_exercise(
    v_user_id,
    v_challenge.exercise_type,
    v_challenge.target_reps,
    'daily_challenge',
    p_challenge_id::text
  );

  perform public.process_weekly_mission_streak(v_user_id, v_challenge.challenge_date);

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

  v_mission_index := public.resolve_daily_mission_index(p_exercise);

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

create or replace function public.finalize_daily_mission(
  p_challenge_id uuid
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  return public.finalize_daily_mission_rewards(p_challenge_id);
end;
$$;

create or replace function public.complete_challenge(
  p_challenge_id uuid,
  p_completed_reps integer
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
  v_new_reps integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.status not in ('pending', 'in_progress') then
    raise exception 'Challenge is not active';
  end if;

  if p_completed_reps < 0 then
    raise exception 'Completed reps must be non-negative';
  end if;

  v_new_reps := least(
    v_challenge.target_reps,
    greatest(p_completed_reps, v_challenge.completed_reps)
  );

  if v_new_reps < v_challenge.target_reps then
    update public.daily_challenges
    set
      completed_reps = v_new_reps,
      status = case
        when status = 'pending' then 'in_progress'::public.challenge_status
        else status
      end
    where id = p_challenge_id
    returning * into v_challenge;

    return v_challenge;
  end if;

  update public.daily_challenges
  set
    completed_reps = v_new_reps,
    status = case
      when status = 'pending' then 'in_progress'::public.challenge_status
      else status
    end
  where id = p_challenge_id
  returning * into v_challenge;

  return public.finalize_daily_mission_rewards(p_challenge_id);
end;
$$;

create or replace function public.complete_friend_challenge(
  p_participant_id uuid,
  p_completed_reps integer
)
returns public.friend_challenge_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.friend_challenge_participants;
  v_challenge public.friend_challenges;
  v_previous_reps integer;
  v_new_reps integer;
  v_delta integer;
  v_credit record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_completed_reps < 0 then
    raise exception 'Completed reps must be non-negative';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_participant.status = 'expired' then
    raise exception 'Challenge expired';
  end if;

  if v_participant.status = 'completed' then
    perform public.credit_daily_mission_reps(
      (select exercise_type from public.friend_challenges where id = v_participant.challenge_id),
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
    return v_participant;
  end if;

  if v_participant.status = 'pending' then
    raise exception 'Accept the challenge before completing reps';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  v_previous_reps := v_participant.completed_reps;

  if v_participant.started_at is null then
    if p_completed_reps < 1 then
      raise exception 'Complete at least one rep to start the timer';
    end if;

    update public.friend_challenge_participants
    set
      started_at = now(),
      completed_reps = greatest(p_completed_reps, completed_reps)
    where id = p_participant_id
    returning * into v_participant;

    v_new_reps := v_participant.completed_reps;
    v_delta := greatest(v_new_reps - v_previous_reps, 0);

    if v_delta > 0 then
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );

      perform public.credit_daily_mission_reps(
        v_challenge.exercise_type,
        'friend_challenge',
        p_participant_id::text,
        v_participant.completed_reps
      );
    end if;

    if p_completed_reps >= v_challenge.target_reps then
      update public.friend_challenge_participants
      set
        completed_reps = v_challenge.target_reps,
        status = 'completed',
        completed_at = coalesce(completed_at, now())
      where id = p_participant_id
      returning * into v_participant;

      perform public.resolve_friend_challenge_race(v_challenge.id);
    end if;

    return v_participant;
  end if;

  if v_challenge.time_limit_seconds is not null
     and v_participant.started_at + make_interval(secs => v_challenge.time_limit_seconds) < now() then
    update public.friend_challenge_participants
    set status = 'expired'::public.challenge_status
    where id = p_participant_id;

    perform public.resolve_friend_challenge_race(v_challenge.id);

    raise exception 'Challenge expired';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    update public.friend_challenge_participants
    set completed_reps = greatest(p_completed_reps, completed_reps)
    where id = p_participant_id
    returning * into v_participant;

    v_new_reps := v_participant.completed_reps;
    v_delta := greatest(v_new_reps - v_previous_reps, 0);

    if v_delta > 0 then
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );

      perform public.credit_daily_mission_reps(
        v_challenge.exercise_type,
        'friend_challenge',
        p_participant_id::text,
        v_participant.completed_reps
      );
    end if;

    return v_participant;
  end if;

  update public.friend_challenge_participants
  set
    completed_reps = v_challenge.target_reps,
    status = 'completed',
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id
  returning * into v_participant;

  v_new_reps := v_participant.completed_reps;
  v_delta := greatest(v_new_reps - v_previous_reps, 0);

  if v_delta > 0 then
    perform public.credit_user_goal_progress_for_exercise(
      v_user_id,
      v_challenge.exercise_type,
      v_delta,
      'friend_challenge',
      p_participant_id::text
    );

    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
  end if;

  perform public.resolve_friend_challenge_race(v_challenge.id);

  return v_participant;
end;
$$;

create or replace function public.save_custom_workout_session(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_total_reps integer,
  p_exercise_breakdown jsonb,
  p_started_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_total_reps integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.custom_workout_sessions (
    user_id,
    template_id,
    title,
    time_limit_seconds,
    completed_rounds,
    total_reps,
    exercise_breakdown,
    started_at
  )
  values (
    v_user_id,
    p_template_id,
    trim(p_title),
    p_time_limit_seconds,
    p_completed_rounds,
    p_total_reps,
    coalesce(p_exercise_breakdown, '[]'::jsonb),
    p_started_at
  )
  returning id into v_session_id;

  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_exercise_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    v_total_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);

    if v_exercise is not null and v_total_reps > 0 then
      perform public.credit_daily_mission_reps(
        v_exercise,
        'custom_workout',
        v_session_id::text,
        v_total_reps
      );
    end if;
  end loop;

  return v_session_id;
end;
$$;

grant execute on function public.resolve_daily_mission_index(public.exercise_type) to authenticated;
grant execute on function public.credit_daily_mission_reps(public.exercise_type, text, text, integer) to authenticated;
grant execute on function public.finalize_daily_mission(uuid) to authenticated;
grant execute on function public.finalize_daily_mission_rewards(uuid) to authenticated;
