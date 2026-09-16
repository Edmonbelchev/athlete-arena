-- Remove personal goals feature (tables, RPCs, achievements, and rep crediting).

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


  perform public.process_weekly_mission_streak(v_user_id, v_challenge.challenge_date);

  return v_challenge;
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

  if v_participant.status = 'expired'::public.challenge_status then
    raise exception 'Challenge expired';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
    raise exception 'Use workout completion for this challenge';
  end if;

  if v_participant.status = 'completed'::public.challenge_status then
    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
    return v_participant;
  end if;

  if v_participant.status = 'pending'::public.challenge_status then
    raise exception 'Accept the challenge before completing reps';
  end if;

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
        status = 'completed'::public.challenge_status,
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
    status = 'completed'::public.challenge_status,
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id
  returning * into v_participant;

  v_new_reps := v_participant.completed_reps;
  v_delta := greatest(v_new_reps - v_previous_reps, 0);

  if v_delta > 0 then
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

drop function if exists public.get_user_movement_stats();

create or replace function public.get_user_movement_stats()
returns table (
  total_push_ups bigint,
  total_squats bigint,
  total_pull_ups bigint,
  total_dips bigint,
  total_burpees bigint,
  total_half_burpees bigint,
  total_jumping_jacks bigint,
  total_jumping_squats bigint,
  daily_missions_completed bigint,
  friend_races_completed bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'push_ups'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'push_ups'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'push_ups') as total_push_ups,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'squats'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'squats'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'squats') as total_squats,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'pull_ups'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'pull_ups'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'pull_ups') as total_pull_ups,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'dips'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'dips'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'dips') as total_dips,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'burpees'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'burpees'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'burpees') as total_burpees,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'half_burpees'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'half_burpees'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'half_burpees') as total_half_burpees,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'jumping_jacks'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'jumping_jacks'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'jumping_jacks') as total_jumping_jacks,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'jumping_squats'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'jumping_squats'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'jumping_squats') as total_jumping_squats,

    (
      select count(*)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
    ) as daily_missions_completed,

    (
      select count(*)
      from public.friend_challenge_participants fcp
      where fcp.user_id = v_user_id
        and fcp.status = 'completed'
    ) as friend_races_completed;
end;
$$;

grant execute on function public.get_user_movement_stats() to authenticated;

create or replace function public.sync_user_achievements(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_today date := current_date;
  v_completed_challenges bigint;
  v_total_xp integer;
  v_level integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_push_ups_total bigint;
  v_squats_total bigint;
  v_pull_ups_total bigint;
  v_burpees_total bigint;
  v_friend_races_won bigint;
  v_friends_count bigint;
  v_goals_created bigint;
  v_goals_completed bigint;
  v_login_streak integer;
  v_login_last_date date;
  v_workouts_completed bigint;
  v_workouts_completed_month bigint;
  v_achievement record;
  v_inserted integer;
  v_new_unlocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select login_streak, login_streak_last_date
  into v_login_streak, v_login_last_date
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_login_last_date is distinct from v_today then
    if v_login_last_date = v_today - 1 then
      v_login_streak := coalesce(v_login_streak, 0) + 1;
    else
      v_login_streak := 1;
    end if;

    update public.profiles
    set
      login_streak = v_login_streak,
      login_streak_last_date = v_today
    where id = v_user_id;
  end if;

  select public.get_user_workouts_completed(v_user_id)
  into v_workouts_completed;

  select public.get_user_workouts_completed_this_month(v_user_id)
  into v_workouts_completed_month;

  select
    count(*) filter (where dc.status = 'completed'),
    p.total_xp,
    p.level,
    p.current_streak,
    p.longest_streak,
    p.login_streak
  into
    v_completed_challenges,
    v_total_xp,
    v_level,
    v_current_streak,
    v_longest_streak,
    v_login_streak
  from public.profiles p
  left join public.daily_challenges dc on dc.user_id = p.id
  where p.id = v_user_id
  group by p.id;

  v_push_ups_total := public.get_user_total_exercise_reps(v_user_id, 'push_ups');
  v_squats_total := public.get_user_total_exercise_reps(v_user_id, 'squats');
  v_pull_ups_total := public.get_user_total_exercise_reps(v_user_id, 'pull_ups');
  v_burpees_total := public.get_user_total_exercise_reps(v_user_id, 'burpees');

  select count(*)
  into v_friend_races_won
  from public.friend_challenges
  where winner_user_id = v_user_id;

  select count(*)
  into v_friends_count
  from public.friendships f
  where f.status = 'accepted'
    and (f.requester_id = v_user_id or f.addressee_id = v_user_id);

  v_goals_created := 0;
  v_goals_completed := 0;

  for v_achievement in
    select id, requirements, xp_reward, coin_reward
    from public.achievements
    where is_active = true
  loop
    if public.check_achievement_requirement(
      v_achievement.requirements,
      v_completed_challenges,
      v_total_xp,
      v_level,
      v_current_streak,
      v_longest_streak,
      v_push_ups_total,
      v_squats_total,
      v_pull_ups_total,
      0,
      v_burpees_total,
      v_friend_races_won,
      v_friends_count,
      v_goals_created,
      v_goals_completed,
      v_login_streak,
      v_workouts_completed,
      v_workouts_completed_month
    ) then
      insert into public.user_achievements (user_id, achievement_id)
      values (v_user_id, v_achievement.id)
      on conflict do nothing;

      get diagnostics v_inserted = row_count;

      if v_inserted > 0 then
        v_new_unlocks := v_new_unlocks + v_inserted;
        if coalesce(v_achievement.xp_reward, 0) > 0 then
          perform public.award_friend_challenge_xp(v_user_id, v_achievement.xp_reward);
        end if;
        if coalesce(v_achievement.coin_reward, 0) > 0 then
          perform public.award_coins(v_user_id, v_achievement.coin_reward);
        end if;
      end if;
    end if;
  end loop;

  perform public.sync_user_titles(v_user_id);

  return v_new_unlocks;
end;
$$;



-- Goal-related achievements
delete from public.user_achievements ua
using public.achievements a
where ua.achievement_id = a.id
  and a.requirements->>'type' in ('goals_created', 'goals_completed');

delete from public.achievements
where requirements->>'type' in ('goals_created', 'goals_completed');

do $$
begin
  if to_regclass('public.user_goal_plans') is not null then
    delete from public.user_goal_plans;
    drop table public.user_goal_plans;
  end if;
end $$;

drop table if exists public.user_goals;
drop table if exists public.goal_activity_catalog;

drop function if exists public.get_user_goal_history(integer);
drop function if exists public.create_user_goal(text, public.goal_period, numeric);
drop function if exists public.cancel_user_goal(uuid);
drop function if exists public.get_user_goals(boolean);
drop function if exists public.get_goal_activity_catalog();
drop function if exists public.credit_user_goal_progress_for_exercise(uuid, public.exercise_type, integer, text, text);
drop function if exists public.credit_user_goal_progress(uuid, text, numeric, text, text);
drop function if exists public.log_goal_progress(uuid, numeric);
drop function if exists public.validate_goal_target_value(text, numeric);
drop function if exists public.goal_period_start(public.goal_period, timestamptz);
drop function if exists public.goal_period_end(public.goal_period, date);

drop type if exists public.goal_period;
drop type if exists public.goal_status;

