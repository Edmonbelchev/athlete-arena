-- Add pull-ups and dips to the exercise catalog.

alter type public.exercise_type add value if not exists 'pull_ups';
alter type public.exercise_type add value if not exists 'dips';

create or replace function public.pick_daily_challenge_tier(
  p_exercise public.exercise_type
)
returns table (
  target_reps integer,
  xp_reward integer
)
language plpgsql
as $$
declare
  v_roll integer := floor(random() * 4)::integer;
begin
  case p_exercise
    when 'push_ups' then
      case v_roll
        when 0 then return query select 5, 50;
        when 1 then return query select 10, 75;
        when 2 then return query select 15, 100;
        else return query select 20, 150;
      end case;
    when 'squats' then
      case v_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 75;
        when 2 then return query select 20, 100;
        else return query select 30, 150;
      end case;
    when 'pull_ups' then
      case v_roll
        when 0 then return query select 3, 50;
        when 1 then return query select 5, 75;
        when 2 then return query select 8, 100;
        else return query select 10, 150;
      end case;
    else
      case v_roll
        when 0 then return query select 5, 50;
        when 1 then return query select 8, 75;
        when 2 then return query select 10, 100;
        else return query select 15, 150;
      end case;
  end case;
end;
$$;

create or replace function public.get_or_create_daily_challenge()
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_challenge public.daily_challenges;
  v_exercise public.exercise_type;
  v_target_reps integer;
  v_xp_reward integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today;

  if found then
    return v_challenge;
  end if;

  case floor(random() * 4)::integer
    when 0 then v_exercise := 'push_ups';
    when 1 then v_exercise := 'squats';
    when 2 then v_exercise := 'pull_ups';
    else v_exercise := 'dips';
  end case;

  select tier.target_reps, tier.xp_reward
  into v_target_reps, v_xp_reward
  from public.pick_daily_challenge_tier(v_exercise) as tier;

  insert into public.daily_challenges (
    user_id,
    exercise_type,
    target_reps,
    xp_reward,
    challenge_date
  )
  values (
    v_user_id,
    v_exercise,
    v_target_reps,
    v_xp_reward,
    v_today
  )
  returning * into v_challenge;

  return v_challenge;
end;
$$;

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
  p_friend_races_won bigint,
  p_friends_count bigint
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
    when 'friend_races_won' then
      return p_friend_races_won >= req_min;
    when 'friends_count' then
      return p_friends_count >= req_min;
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
  v_completed_challenges bigint;
  v_total_xp integer;
  v_level integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_push_ups_total bigint;
  v_squats_total bigint;
  v_pull_ups_total bigint;
  v_dips_total bigint;
  v_friend_races_won bigint;
  v_friends_count bigint;
  v_achievement record;
  v_inserted integer;
  v_new_unlocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

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
    ), 0)
  into
    v_completed_challenges,
    v_total_xp,
    v_level,
    v_current_streak,
    v_longest_streak,
    v_push_ups_total,
    v_squats_total,
    v_pull_ups_total,
    v_dips_total
  from public.profiles p
  left join public.daily_challenges dc on dc.user_id = p.id
  where p.id = v_user_id
  group by p.id;

  select count(*)
  into v_friend_races_won
  from public.friend_challenges
  where winner_user_id = v_user_id;

  select count(*)
  into v_friends_count
  from public.friendships f
  where f.status = 'accepted'
    and (f.requester_id = v_user_id or f.addressee_id = v_user_id);

  for v_achievement in
    select id, requirements, xp_reward
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
      v_friend_races_won,
      v_friends_count
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
      end if;
    end if;
  end loop;

  return v_new_unlocks;
end;
$$;

insert into public.achievements (id, title, description, icon, requirements, xp_reward, sort_order)
values
  (
    'pull_up_pro',
    'Pull-up Pro',
    'Complete 50 pull-ups across daily challenges.',
    'dumbbell',
    '{"type":"pull_ups_total","min":50}'::jsonb,
    75,
    95
  ),
  (
    'dip_master',
    'Dip Master',
    'Complete 75 dips across daily challenges.',
    'dumbbell',
    '{"type":"dips_total","min":75}'::jsonb,
    75,
    96
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  requirements = excluded.requirements,
  xp_reward = excluded.xp_reward,
  sort_order = excluded.sort_order,
  is_active = true;
