-- High-tier rep achievements (XP + equipable title) for push-ups, squats, pull-ups, and burpees.

create or replace function public.get_user_total_exercise_reps(
  p_user_id uuid,
  p_exercise_type public.exercise_type
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(dc.completed_reps)
      from public.daily_challenges dc
      where dc.user_id = p_user_id
        and dc.status = 'completed'
        and dc.exercise_type = p_exercise_type
    ), 0)
    + public.get_user_friend_exercise_reps(p_user_id, p_exercise_type)
    + public.get_user_workout_exercise_reps(p_user_id, p_exercise_type);
$$;

alter table public.titles
  drop constraint if exists titles_requirement_type_check;

alter table public.titles
  add constraint titles_requirement_type_check check (
    requirement_type in (
      'workouts_completed',
      'friend_races_won',
      'weekly_leaderboard_first',
      'push_ups_total',
      'squats_total',
      'pull_ups_total',
      'burpees_total'
    )
  );

insert into public.titles (id, name, description, requirement_type, requirement_min, sort_order)
values
  (
    'push_up_legend',
    'Push-up Legend',
    'Complete 5,000 push-ups from activities.',
    'push_ups_total',
    5000,
    80
  ),
  (
    'squat_legend',
    'Squat Legend',
    'Complete 5,000 squats from activities.',
    'squats_total',
    5000,
    81
  ),
  (
    'pull_up_legend',
    'Pull-up Legend',
    'Complete 2,000 pull-ups from activities.',
    'pull_ups_total',
    2000,
    82
  ),
  (
    'burpee_legend',
    'Burpee Legend',
    'Complete 5,000 burpees from activities.',
    'burpees_total',
    5000,
    83
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  requirement_type = excluded.requirement_type,
  requirement_min = excluded.requirement_min,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.achievements (
  id, title, description, icon, requirements, xp_reward, coin_reward, sort_order, is_active
)
values
  (
    'push_up_legend',
    'Push-up Legend',
    'Complete 5,000 push-ups from activities.',
    'dumbbell',
    '{"type":"push_ups_total","min":5000}'::jsonb,
    250,
    0,
    98,
    true
  ),
  (
    'squat_legend',
    'Squat Legend',
    'Complete 5,000 squats from activities.',
    'dumbbell',
    '{"type":"squats_total","min":5000}'::jsonb,
    250,
    0,
    99,
    true
  ),
  (
    'pull_up_legend',
    'Pull-up Legend',
    'Complete 2,000 pull-ups from activities.',
    'dumbbell',
    '{"type":"pull_ups_total","min":2000}'::jsonb,
    250,
    0,
    100,
    true
  ),
  (
    'burpee_legend',
    'Burpee Legend',
    'Complete 5,000 burpees from activities.',
    'dumbbell',
    '{"type":"burpees_total","min":5000}'::jsonb,
    250,
    0,
    101,
    true
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  requirements = excluded.requirements,
  xp_reward = excluded.xp_reward,
  coin_reward = excluded.coin_reward,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create or replace function public.check_title_requirement(
  p_requirement_type text,
  p_requirement_min integer,
  p_workouts_completed bigint,
  p_friend_races_won bigint,
  p_weekly_leaderboard_wins bigint,
  p_push_ups_total bigint,
  p_squats_total bigint,
  p_pull_ups_total bigint,
  p_burpees_total bigint
)
returns boolean
language plpgsql
immutable
as $$
begin
  case p_requirement_type
    when 'workouts_completed' then
      return p_workouts_completed >= p_requirement_min;
    when 'friend_races_won' then
      return p_friend_races_won >= p_requirement_min;
    when 'weekly_leaderboard_first' then
      return p_weekly_leaderboard_wins >= p_requirement_min;
    when 'push_ups_total' then
      return p_push_ups_total >= p_requirement_min;
    when 'squats_total' then
      return p_squats_total >= p_requirement_min;
    when 'pull_ups_total' then
      return p_pull_ups_total >= p_requirement_min;
    when 'burpees_total' then
      return p_burpees_total >= p_requirement_min;
    else
      return false;
  end case;
end;
$$;

create or replace function public.sync_user_titles(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_workouts_completed bigint;
  v_friend_races_won bigint;
  v_weekly_leaderboard_wins bigint;
  v_push_ups_total bigint;
  v_squats_total bigint;
  v_pull_ups_total bigint;
  v_burpees_total bigint;
  v_title record;
  v_inserted integer;
  v_new_unlocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.process_weekly_leaderboard_awards();

  select public.get_user_workouts_completed(v_user_id)
  into v_workouts_completed;

  select count(*)
  into v_friend_races_won
  from public.friend_challenges
  where winner_user_id = v_user_id;

  select count(*)
  into v_weekly_leaderboard_wins
  from public.weekly_leaderboard_awards
  where user_id = v_user_id;

  v_push_ups_total := public.get_user_total_exercise_reps(v_user_id, 'push_ups');
  v_squats_total := public.get_user_total_exercise_reps(v_user_id, 'squats');
  v_pull_ups_total := public.get_user_total_exercise_reps(v_user_id, 'pull_ups');
  v_burpees_total := public.get_user_total_exercise_reps(v_user_id, 'burpees');

  for v_title in
    select id, requirement_type, requirement_min
    from public.titles
    where is_active = true
  loop
    if public.check_title_requirement(
      v_title.requirement_type,
      v_title.requirement_min,
      v_workouts_completed,
      v_friend_races_won,
      v_weekly_leaderboard_wins,
      v_push_ups_total,
      v_squats_total,
      v_pull_ups_total,
      v_burpees_total
    ) then
      insert into public.user_titles (user_id, title_id)
      values (v_user_id, v_title.id)
      on conflict do nothing;

      get diagnostics v_inserted = row_count;
      v_new_unlocks := v_new_unlocks + coalesce(v_inserted, 0);
    end if;
  end loop;

  return v_new_unlocks;
end;
$$;

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

  select count(*)
  into v_goals_created
  from public.user_goals
  where user_id = v_user_id;

  select count(*)
  into v_goals_completed
  from public.user_goals
  where user_id = v_user_id
    and status = 'completed';

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

grant execute on function public.get_user_total_exercise_reps(uuid, public.exercise_type) to authenticated;
