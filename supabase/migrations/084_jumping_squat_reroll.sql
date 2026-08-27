-- Allow jumping squats in daily quest re-rolls.

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
    'jumping_squats'
  ) then
    raise exception 'Exercise cannot be used for daily quests';
  end if;

  select daily_quest_reroll_used_on
  into v_reroll_used_on
  from public.profiles
  where id = v_user_id;

  if v_reroll_used_on = v_today then
    raise exception 'Daily quest re-roll already used today';
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
