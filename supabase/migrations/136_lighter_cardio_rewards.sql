-- Lighter rewards for high knees and shadow boxing: every knee lift / punch is a rep, so reps
-- come fast and easy. Keep in sync with src/constants/dailyMissionRewards.ts,
-- friendChallengeRewards.ts and workoutXp.ts.

-- Daily quest reward per exercise: 50 XP / 20 coins, or 30 / 12 for the light cardio moves.
create or replace function public.daily_mission_reward(p_exercise public.exercise_type)
returns table (xp integer, coins integer)
language sql
immutable
as $$
  select
    case when p_exercise in ('high_knees', 'shadow_boxing') then 30 else 50 end,
    case when p_exercise in ('high_knees', 'shadow_boxing') then 12 else 20 end;
$$;


-- Same as 100, with the reward looked up per exercise.
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
  v_earned_xp integer;
  v_earned_coins integer;
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

  select reward.xp, reward.coins
  into v_earned_xp, v_earned_coins
  from public.daily_mission_reward(v_challenge.exercise_type) as reward;

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

-- Same as 135; the swapped-in quest shows its own XP reward.
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
      (select reward.xp from public.daily_mission_reward(p_exercise) as reward),
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
      xp_reward = (select reward.xp from public.daily_mission_reward(p_exercise) as reward),
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

-- Same as 135: high knees and shadow boxing need twice the reps for the full reward.
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
    when 'high_knees' then 120
    when 'shadow_boxing' then 120
    when 'tuck_jumps' then 20
    else 50
  end;
$$;

-- Same as 122, with half XP for high knees and shadow boxing.
create or replace function public.sum_workout_rep_xp_from_breakdown(
  p_breakdown jsonb,
  p_use_target_reps boolean default false
)
returns integer
language plpgsql
immutable
as $$
declare
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_reps integer;
  v_total integer := 0;
begin
  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    if p_use_target_reps then
      v_reps := coalesce((v_entry ->> 'target_reps')::integer, 0);
    else
      v_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);
    end if;

    if v_exercise is not null and v_reps > 0 then
      if v_exercise = 'plank'::public.exercise_type then
        v_total := v_total + v_reps / 5;
      elsif v_exercise in ('high_knees'::public.exercise_type, 'shadow_boxing'::public.exercise_type) then
        -- One XP per 2 knee lifts / punches (sync REPS_PER_XP in src/constants/workoutXp.ts).
        v_total := v_total + v_reps / 2;
      else
        v_total := v_total + v_reps * public.workout_xp_per_rep(v_exercise);
      end if;
    end if;
  end loop;

  return v_total;
end;
$$;
