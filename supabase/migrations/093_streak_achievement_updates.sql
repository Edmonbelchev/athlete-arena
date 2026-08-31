-- Streak achievement: 3 days instead of 7. Replace 30-day streak with 10 workouts/month.

create or replace function public.get_user_workouts_completed_this_month(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.custom_workout_sessions
  where user_id = p_user_id
    and date_trunc('month', timezone('utc', completed_at))
      = date_trunc('month', timezone('utc', now()));
$$;

update public.achievements
set
  description = 'Reach a 3-day workout streak.',
  requirements = '{"type":"longest_streak","min":3}'::jsonb
where id = 'on_fire';

update public.achievements
set is_active = false
where id = 'unstoppable';

insert into public.achievements (
  id, title, description, icon, requirements, xp_reward, coin_reward, sort_order, is_active
)
values (
  'monthly_regular',
  'Monthly Regular',
  'Complete 10 workouts in a month.',
  'bolt',
  '{"type":"workouts_completed_month","min":10}'::jsonb,
  250,
  0,
  40,
  true
)
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  requirements = excluded.requirements,
  xp_reward = excluded.xp_reward,
  coin_reward = excluded.coin_reward,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

drop function if exists public.check_achievement_requirement(
  jsonb,
  bigint,
  integer,
  integer,
  integer,
  integer,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  integer,
  bigint
);

create or replace function public.check_achievement_requirement(
  p_requirements jsonb,
  p_completed_challenges bigint,
  p_total_xp integer,
  p_level integer,
  p_current_streak integer,
  p_longest_streak integer,
  p_push_ups_total bigint,
  p_squats_total bigint,
  p_pull_ups_total bigint,
  p_dips_total bigint,
  p_burpees_total bigint,
  p_friend_races_won bigint,
  p_friends_count bigint,
  p_goals_created bigint,
  p_goals_completed bigint,
  p_login_streak integer,
  p_workouts_completed bigint,
  p_workouts_completed_month bigint
)
returns boolean
language plpgsql
immutable
as $$
declare
  req_type text := p_requirements ->> 'type';
  req_min numeric := coalesce((p_requirements ->> 'min')::numeric, 0);
begin
  case req_type
    when 'completed_challenges' then
      return p_completed_challenges >= req_min;
    when 'total_xp' then
      return p_total_xp >= req_min;
    when 'level' then
      return p_level >= req_min;
    when 'current_streak' then
      return p_current_streak >= req_min;
    when 'longest_streak' then
      return greatest(p_current_streak, p_longest_streak) >= req_min;
    when 'push_ups_total' then
      return p_push_ups_total >= req_min;
    when 'squats_total' then
      return p_squats_total >= req_min;
    when 'pull_ups_total' then
      return p_pull_ups_total >= req_min;
    when 'dips_total' then
      return p_dips_total >= req_min;
    when 'burpees_total' then
      return p_burpees_total >= req_min;
    when 'friend_races_won' then
      return p_friend_races_won >= req_min;
    when 'friends_count' then
      return p_friends_count >= req_min;
    when 'goals_created' then
      return p_goals_created >= req_min;
    when 'goals_completed' then
      return p_goals_completed >= req_min;
    when 'login_streak' then
      return p_login_streak >= req_min;
    when 'workouts_completed' then
      return p_workouts_completed >= req_min;
    when 'workouts_completed_month' then
      return p_workouts_completed_month >= req_min;
    else
      return false;
  end case;
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
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'squats'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'pull_ups'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'burpees'
    ), 0),
    p.login_streak
  into
    v_completed_challenges,
    v_total_xp,
    v_level,
    v_current_streak,
    v_longest_streak,
    v_squats_total,
    v_pull_ups_total,
    v_burpees_total,
    v_login_streak
  from public.profiles p
  left join public.daily_challenges dc on dc.user_id = p.id
  where p.id = v_user_id
  group by p.id;

  v_squats_total := v_squats_total
    + public.get_user_friend_exercise_reps(v_user_id, 'squats')
    + public.get_user_workout_exercise_reps(v_user_id, 'squats');

  v_pull_ups_total := v_pull_ups_total
    + public.get_user_friend_exercise_reps(v_user_id, 'pull_ups')
    + public.get_user_workout_exercise_reps(v_user_id, 'pull_ups');

  v_burpees_total := v_burpees_total
    + public.get_user_friend_exercise_reps(v_user_id, 'burpees')
    + public.get_user_workout_exercise_reps(v_user_id, 'burpees');

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
      0,
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

grant execute on function public.get_user_workouts_completed_this_month(uuid) to authenticated;
