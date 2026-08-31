-- Count workout and friend-challenge reps toward rep-based achievements.

create or replace function public.get_user_friend_exercise_reps(
  p_user_id uuid,
  p_exercise_type public.exercise_type
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(fcp.completed_reps), 0)::bigint
  from public.friend_challenge_participants fcp
  join public.friend_challenges fc on fc.id = fcp.challenge_id
  where fcp.user_id = p_user_id
    and fc.exercise_type = p_exercise_type
    and fcp.completed_reps > 0;
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
  v_dips_total bigint;
  v_burpees_total bigint;
  v_friend_races_won bigint;
  v_friends_count bigint;
  v_goals_created bigint;
  v_goals_completed bigint;
  v_login_streak integer;
  v_login_last_date date;
  v_workouts_completed bigint;
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

  select
    count(*) filter (where dc.status = 'completed'),
    p.total_xp,
    p.level,
    p.current_streak,
    p.longest_streak,
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'push_ups'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'squats'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'pull_ups'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'dips'
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
    v_push_ups_total,
    v_squats_total,
    v_pull_ups_total,
    v_dips_total,
    v_burpees_total,
    v_login_streak
  from public.profiles p
  left join public.daily_challenges dc on dc.user_id = p.id
  where p.id = v_user_id
  group by p.id;

  v_push_ups_total := v_push_ups_total
    + public.get_user_friend_exercise_reps(v_user_id, 'push_ups')
    + public.get_user_workout_exercise_reps(v_user_id, 'push_ups');

  v_squats_total := v_squats_total
    + public.get_user_friend_exercise_reps(v_user_id, 'squats')
    + public.get_user_workout_exercise_reps(v_user_id, 'squats');

  v_pull_ups_total := v_pull_ups_total
    + public.get_user_friend_exercise_reps(v_user_id, 'pull_ups')
    + public.get_user_workout_exercise_reps(v_user_id, 'pull_ups');

  v_dips_total := v_dips_total
    + public.get_user_friend_exercise_reps(v_user_id, 'dips')
    + public.get_user_workout_exercise_reps(v_user_id, 'dips');

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
      v_push_ups_total,
      v_squats_total,
      v_pull_ups_total,
      v_dips_total,
      v_burpees_total,
      v_friend_races_won,
      v_friends_count,
      v_goals_created,
      v_goals_completed,
      v_login_streak,
      v_workouts_completed
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

grant execute on function public.get_user_friend_exercise_reps(uuid, public.exercise_type) to authenticated;
