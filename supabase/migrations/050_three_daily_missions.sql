-- Restore 3 daily missions per day (push-ups, squats, pull-ups).
-- Burpees remain available for friend challenges and goals.

alter table public.daily_challenges
  drop constraint if exists daily_challenges_mission_index_check;

alter table public.daily_challenge_templates
  drop constraint if exists daily_challenge_templates_mission_index_check;

-- Remove 4th mission rows before re-adding constraints (must run while checks are dropped).
delete from public.daily_challenge_templates
where mission_index >= 3;

delete from public.daily_challenges
where mission_index >= 3;

alter table public.daily_challenges
  add constraint daily_challenges_mission_index_check
  check (mission_index >= 0 and mission_index < 3);

alter table public.daily_challenge_templates
  add constraint daily_challenge_templates_mission_index_check
  check (mission_index >= 0 and mission_index < 3);

create or replace function public.ensure_daily_mission_templates(
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_number bigint;
  v_mission_index integer;
  v_exercise public.exercise_type;
  v_tier_roll integer;
  v_target_reps integer;
  v_exercises public.exercise_type[] := array[
    'push_ups'::public.exercise_type,
    'squats'::public.exercise_type,
    'pull_ups'::public.exercise_type
  ];
begin
  v_day_number := (extract(epoch from p_date::timestamptz)::bigint / 86400)::bigint;

  for v_mission_index in 0..2 loop
    v_exercise := v_exercises[v_mission_index + 1];
    v_tier_roll := ((v_day_number + v_mission_index * 17) % 4)::integer;

    select tier.target_reps
    into v_target_reps
    from public.pick_daily_mission_tier(v_exercise, v_tier_roll) as tier;

    insert into public.daily_challenge_templates (
      challenge_date,
      exercise_type,
      target_reps,
      xp_reward,
      mission_index,
      catalog_slot
    )
    values (
      p_date,
      v_exercise,
      v_target_reps,
      50,
      v_mission_index,
      null
    )
    on conflict (challenge_date, mission_index) do update
    set
      exercise_type = excluded.exercise_type,
      target_reps = excluded.target_reps,
      xp_reward = 50;
  end loop;
end;
$$;

create or replace function public.get_or_create_daily_challenge(
  p_mission_index integer default 0
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_template public.daily_challenge_templates;
  v_challenge public.daily_challenges;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today
    and mission_index = p_mission_index;

  if found then
    return v_challenge;
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = v_today
    and mission_index = p_mission_index;

  if not found then
    raise exception 'Daily mission template not found';
  end if;

  insert into public.daily_challenges (
    user_id,
    exercise_type,
    target_reps,
    xp_reward,
    challenge_date,
    mission_index
  )
  values (
    v_user_id,
    v_template.exercise_type,
    v_template.target_reps,
    50,
    v_today,
    p_mission_index
  )
  on conflict (user_id, challenge_date, mission_index) do nothing
  returning * into v_challenge;

  if v_challenge.id is null then
    select *
    into v_challenge
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_today
      and mission_index = p_mission_index;
  end if;

  return v_challenge;
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

  if v_challenge.status <> 'in_progress' then
    raise exception 'Challenge is not in progress';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  update public.daily_challenges
  set
    status = 'completed',
    completed_reps = p_completed_reps,
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
    p_completed_reps,
    'daily_challenge',
    p_challenge_id::text
  );

  perform public.process_weekly_mission_streak(v_user_id, v_challenge.challenge_date);

  return v_challenge;
end;
$$;

-- Regenerate today's templates with 3 missions only.
select public.ensure_daily_mission_templates(current_date);
