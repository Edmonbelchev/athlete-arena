-- Weekly mission streak: complete at least 1 daily mission per day for 7 days.
-- Day 7 reward: 300 XP + 200 coins.

alter table public.profiles
  add column if not exists weekly_mission_streak integer not null default 0
    check (weekly_mission_streak >= 0 and weekly_mission_streak <= 7);

alter table public.profiles
  add column if not exists weekly_mission_streak_last_date date;

comment on column public.profiles.weekly_mission_streak is
  'Consecutive days with at least one completed daily mission in the current weekly streak cycle (0-7).';

comment on column public.profiles.weekly_mission_streak_last_date is
  'UTC date when the user last qualified the weekly mission streak.';

create or replace function public.process_weekly_mission_streak(
  p_user_id uuid,
  p_activity_date date default current_date
)
returns table (
  streak_days integer,
  reward_granted boolean,
  reward_xp integer,
  reward_coins integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak integer;
  v_last_date date;
  v_reward_granted boolean := false;
  v_reward_xp constant integer := 300;
  v_reward_coins constant integer := 200;
  v_total_xp integer;
  v_new_level integer;
begin
  if p_user_id is null then
    return;
  end if;

  select weekly_mission_streak, weekly_mission_streak_last_date
  into v_streak, v_last_date
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_last_date = p_activity_date then
    return query
    select v_streak, false, 0, 0;
    return;
  end if;

  if v_last_date = p_activity_date - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  if v_streak >= 7 then
    v_reward_granted := true;

    select total_xp
    into v_total_xp
    from public.profiles
    where id = p_user_id;

    v_total_xp := v_total_xp + v_reward_xp;
    v_new_level := public.calculate_level(v_total_xp);

    perform set_config('app.bypass_profile_stat_protection', 'true', true);

    update public.profiles
    set
      total_xp = v_total_xp,
      level = v_new_level,
      weekly_mission_streak = 1,
      weekly_mission_streak_last_date = p_activity_date
    where id = p_user_id;

    perform set_config('app.bypass_profile_stat_protection', 'false', true);

    perform public.log_xp_event(
      p_user_id,
      v_reward_xp,
      'weekly_mission_streak',
      p_activity_date::text
    );

    perform public.award_coins(p_user_id, v_reward_coins);

    return query
    select 1, true, v_reward_xp, v_reward_coins;
    return;
  end if;

  update public.profiles
  set
    weekly_mission_streak = v_streak,
    weekly_mission_streak_last_date = p_activity_date
  where id = p_user_id;

  return query
  select v_streak, false, 0, 0;
end;
$$;

create or replace function public.get_weekly_mission_streak_status()
returns table (
  streak_days integer,
  target_days integer,
  today_completed boolean,
  reward_xp integer,
  reward_coins integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_streak integer := 0;
  v_last_date date;
  v_today date := current_date;
  v_today_completed boolean := false;
  v_reward_xp constant integer := 300;
  v_reward_coins constant integer := 200;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select weekly_mission_streak, weekly_mission_streak_last_date
  into v_streak, v_last_date
  from public.profiles
  where id = v_user_id;

  select exists (
    select 1
    from public.daily_challenges dc
    where dc.user_id = v_user_id
      and dc.challenge_date = v_today
      and dc.status = 'completed'
  )
  into v_today_completed;

  if v_last_date is null or v_last_date < v_today - 1 then
    v_streak := 0;
  end if;

  return query
  select
    v_streak,
    7,
    v_today_completed,
    v_reward_xp,
    v_reward_coins;
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

grant execute on function public.get_weekly_mission_streak_status() to authenticated;
grant execute on function public.process_weekly_mission_streak(uuid, date) to authenticated;
