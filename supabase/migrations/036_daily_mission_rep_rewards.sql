-- Daily mission rewards scale by exercise and completed reps.

create or replace function public.calculate_daily_mission_xp(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_reps integer := greatest(coalesce(p_reps, 0), 0);
  v_xp integer;
begin
  case p_exercise
    when 'push_ups' then
      v_xp := v_reps * 2;
    when 'squats' then
      v_xp := v_reps * 1;
    when 'pull_ups' then
      v_xp := v_reps * 3;
    else
      raise exception 'Unsupported exercise for daily mission XP: %', p_exercise;
  end case;

  return least(v_xp, 300);
end;
$$;

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
    else
      raise exception 'Unsupported exercise for daily mission coins: %', p_exercise;
  end case;

  return least(v_coins, 50);
end;
$$;

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
  v_xp_reward integer;
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

    v_xp_reward := public.calculate_daily_mission_xp(v_exercise, v_target_reps);

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
      v_xp_reward,
      v_mission_index,
      null
    )
    on conflict (challenge_date, mission_index) do update
    set
      exercise_type = excluded.exercise_type,
      target_reps = excluded.target_reps,
      xp_reward = excluded.xp_reward;
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
  v_xp_reward integer;
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

  v_xp_reward := public.calculate_daily_mission_xp(v_template.exercise_type, v_template.target_reps);

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
    v_xp_reward,
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

  if v_challenge.status <> 'in_progress' then
    raise exception 'Challenge is not in progress';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  v_earned_xp := public.calculate_daily_mission_xp(v_challenge.exercise_type, p_completed_reps);
  v_earned_coins := public.calculate_daily_mission_coins(v_challenge.exercise_type, p_completed_reps);

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

  return v_challenge;
end;
$$;

grant execute on function public.calculate_daily_mission_xp(public.exercise_type, integer) to authenticated;
grant execute on function public.calculate_daily_mission_coins(public.exercise_type, integer) to authenticated;

update public.daily_challenge_templates as t
set xp_reward = public.calculate_daily_mission_xp(t.exercise_type, t.target_reps)
where t.challenge_date >= current_date;

update public.daily_challenges as dc
set xp_reward = public.calculate_daily_mission_xp(dc.exercise_type, dc.target_reps)
where dc.challenge_date >= current_date
  and dc.status <> 'completed';
