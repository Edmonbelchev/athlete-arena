-- High knees, shadow boxing and tuck jumps: daily quests (via swaps), coins, friend challenge
-- rewards, workout XP, movement stats and labels. Keep in sync with src/constants/challenges.ts
-- (CHALLENGE_CONFIG), friendChallengeRewards.ts and workoutXp.ts.


-- Same as 122, plus the new exercises' quest tiers.
create or replace function public.pick_daily_mission_tier(
  p_exercise public.exercise_type,
  p_tier_roll integer
)
returns table (
  target_reps integer,
  xp_reward integer
)
language plpgsql
immutable
as $$
begin
  if p_tier_roll < 0 or p_tier_roll > 3 then
    raise exception 'tier roll must be between 0 and 3';
  end if;

  case p_exercise
    when 'push_ups' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'squats' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'pull_ups' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'burpees' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'half_burpees' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'jumping_jacks' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'jumping_squats' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'lunges' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'sit_ups' then
      case p_tier_roll
        when 0 then return query select 15, 50;
        when 1 then return query select 20, 50;
        when 2 then return query select 25, 50;
        else return query select 30, 50;
      end case;
    when 'high_knees' then
      case p_tier_roll
        when 0 then return query select 30, 50;
        when 1 then return query select 40, 50;
        when 2 then return query select 50, 50;
        else return query select 60, 50;
      end case;
    when 'shadow_boxing' then
      case p_tier_roll
        when 0 then return query select 30, 50;
        when 1 then return query select 40, 50;
        when 2 then return query select 50, 50;
        else return query select 60, 50;
      end case;
    when 'tuck_jumps' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 25, 50;
      end case;
    else
      raise exception 'Unsupported exercise for daily missions: %', p_exercise;
  end case;
end;
$$;

-- Same as 122, plus the new exercises.
create or replace function public.calculate_daily_mission_coins(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_reps integer := greatest(coalesce(p_reps, 0), 0);
  v_coins integer;
begin
  case p_exercise
    when 'push_ups' then
      v_coins := v_reps / 5;
    when 'squats' then
      v_coins := v_reps / 10;
    when 'pull_ups' then
      v_coins := v_reps / 3;
    when 'burpees' then
      v_coins := v_reps / 4;
    when 'half_burpees' then
      v_coins := v_reps / 4;
    when 'jumping_jacks' then
      v_coins := v_reps / 10;
    when 'jumping_squats' then
      v_coins := v_reps / 10;
    when 'lunges' then
      v_coins := v_reps / 10;
    when 'sit_ups' then
      v_coins := v_reps / 6;
    when 'high_knees' then
      v_coins := v_reps / 10;
    when 'shadow_boxing' then
      v_coins := v_reps / 10;
    when 'tuck_jumps' then
      v_coins := v_reps / 4;
    else
      raise exception 'Unsupported exercise for daily mission coins: %', p_exercise;
  end case;

  return least(v_coins, 50);
end;
$$;

-- Same as 133 (Premium swaps free), with the new exercises swappable into quests.
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
  v_coin_balance integer;
  v_swap_cost constant integer := 50;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  if p_exercise not in (
    'push_ups',
    'squats',
    'pull_ups',
    'burpees',
    'half_burpees',
    'jumping_jacks',
    'jumping_squats',
    'lunges',
    'sit_ups',
    'high_knees',
    'shadow_boxing',
    'tuck_jumps'
  ) then
    raise exception 'Exercise cannot be used for daily quests';
  end if;

  select daily_quest_reroll_used_on
  into v_reroll_used_on
  from public.profiles
  where id = v_user_id;

  -- The first swap each day is free; every swap after that costs coins (free with Premium).
  -- Any later error rolls the charge back with the rest of the transaction.
  if v_reroll_used_on = v_today and not public.user_has_premium_access(v_user_id) then
    select coin_balance into v_coin_balance
    from public.profiles
    where id = v_user_id
    for update;

    if coalesce(v_coin_balance, 0) < v_swap_cost then
      raise exception 'Not enough coins - another quest swap today costs % coins', v_swap_cost;
    end if;

    perform set_config('app.bypass_profile_stat_protection', 'true', true);

    update public.profiles
    set coin_balance = coin_balance - v_swap_cost
    where id = v_user_id;

    perform set_config('app.bypass_profile_stat_protection', 'false', true);
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

-- Same as 122, plus the new exercises (FRIEND_CHALLENGE_FULL_REWARD_REPS).
create or replace function public.friend_challenge_full_reward_reps(p_exercise public.exercise_type)
returns integer
language sql
immutable
as $$
  select case p_exercise::text
    when 'push_ups' then 30
    when 'squats' then 50
    when 'pull_ups' then 15
    when 'burpees' then 20
    when 'half_burpees' then 25
    when 'jumping_jacks' then 60
    when 'jumping_squats' then 40
    when 'lunges' then 50
    when 'sit_ups' then 30
    when 'plank' then 60
    when 'high_knees' then 60
    when 'shadow_boxing' then 60
    when 'tuck_jumps' then 20
    else 50
  end;
$$;

-- Same as 106; tuck jumps earn 2 XP per rep like burpees (others default to 1).
create or replace function public.workout_xp_per_rep(p_exercise public.exercise_type)
returns integer
language sql
immutable
as $$
  select case p_exercise
    when 'jumping_jacks' then 1
    when 'squats' then 1
    when 'push_ups' then 1
    when 'half_burpees' then 1
    when 'jumping_squats' then 1
    when 'burpees' then 2
    when 'pull_ups' then 2
    when 'dips' then 2
    when 'tuck_jumps' then 2
    else 1
  end;
$$;

-- Labels for messages; same as 083 plus every exercise added since.
create or replace function public.format_exercise_label(p_exercise public.exercise_type)
returns text
language sql
immutable
as $$
  select case p_exercise
    when 'push_ups' then 'push-ups'
    when 'squats' then 'squats'
    when 'pull_ups' then 'pull-ups'
    when 'dips' then 'dips'
    when 'burpees' then 'burpees'
    when 'half_burpees' then 'half burpees'
    when 'jumping_jacks' then 'jumping jacks'
    when 'jumping_squats' then 'jumping squats'
    when 'lunges' then 'lunges'
    when 'sit_ups' then 'sit-ups'
    when 'plank' then 'plank'
    when 'high_knees' then 'high knees'
    when 'shadow_boxing' then 'shadow boxing punches'
    when 'tuck_jumps' then 'tuck jumps'
    else p_exercise::text
  end;
$$;

-- Same as 122 with totals for the new exercises (new columns: drop and recreate).
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
  total_lunges bigint,
  total_sit_ups bigint,
  total_plank_seconds bigint,
  total_high_knees bigint,
  total_shadow_boxing bigint,
  total_tuck_jumps bigint,
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
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'lunges'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'lunges'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'lunges') as total_lunges,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'sit_ups'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'sit_ups'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'sit_ups') as total_sit_ups,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'plank'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'plank'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'plank') as total_plank_seconds,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'high_knees'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'high_knees'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'high_knees') as total_high_knees,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'shadow_boxing'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'shadow_boxing'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'shadow_boxing') as total_shadow_boxing,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'tuck_jumps'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'tuck_jumps'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'tuck_jumps') as total_tuck_jumps,

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
