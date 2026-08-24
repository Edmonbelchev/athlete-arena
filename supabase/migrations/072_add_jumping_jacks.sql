-- Jumping jacks: friend challenges, goals, stats, daily quest reroll.

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
    else
      raise exception 'Unsupported exercise for daily missions: %', p_exercise;
  end case;
end;
$$;

create or replace function public.calculate_friend_challenge_xp(
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
    when 'burpees' then
      v_xp := v_reps * 2;
    when 'half_burpees' then
      v_xp := v_reps * 2;
    when 'jumping_jacks' then
      v_xp := v_reps / 2;
    else
      raise exception 'Unsupported exercise for friend challenge XP: %', p_exercise;
  end case;

  return least(v_xp, 200);
end;
$$;

create or replace function public.calculate_friend_challenge_coins(
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
    else
      raise exception 'Unsupported exercise for friend challenge coins: %', p_exercise;
  end case;

  return least(v_coins, 50);
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
    when 'burpees' then
      v_coins := v_reps / 4;
    when 'half_burpees' then
      v_coins := v_reps / 4;
    when 'jumping_jacks' then
      v_coins := v_reps / 10;
    else
      raise exception 'Unsupported exercise for daily mission coins: %', p_exercise;
  end case;

  return least(v_coins, 50);
end;
$$;

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
    else p_exercise::text
  end;
$$;

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

  if p_exercise not in ('push_ups', 'squats', 'pull_ups', 'burpees', 'half_burpees', 'jumping_jacks') then
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
  total_steps numeric,
  total_run_km numeric,
  total_run_mi numeric,
  daily_missions_completed bigint,
  friend_races_completed bigint,
  goals_completed bigint,
  goals_completed_daily bigint,
  goals_completed_weekly bigint
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
    ) as total_push_ups,

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
    ) as total_squats,

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
    ) as total_pull_ups,

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
    ) as total_dips,

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
    ) as total_burpees,

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
    ) as total_half_burpees,

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
    ) as total_jumping_jacks,

    (
      select coalesce(sum(ug.current_value), 0)
      from public.user_goals ug
      where ug.user_id = v_user_id
        and ug.activity_id = 'steps'
    ) as total_steps,

    (
      select coalesce(sum(ug.current_value), 0)
      from public.user_goals ug
      where ug.user_id = v_user_id
        and ug.activity_id = 'run_km'
    ) as total_run_km,

    (
      select coalesce(sum(ug.current_value), 0)
      from public.user_goals ug
      where ug.user_id = v_user_id
        and ug.activity_id = 'run_mi'
    ) as total_run_mi,

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
    ) as friend_races_completed,

    (
      select count(*)
      from public.user_goals ug
      where ug.user_id = v_user_id
        and ug.status = 'completed'
    ) as goals_completed,

    (
      select count(*)
      from public.user_goals ug
      where ug.user_id = v_user_id
        and ug.status = 'completed'
        and ug.period = 'daily'
    ) as goals_completed_daily,

    (
      select count(*)
      from public.user_goals ug
      where ug.user_id = v_user_id
        and ug.status = 'completed'
        and ug.period = 'weekly'
    ) as goals_completed_weekly;
end;
$$;

grant execute on function public.get_user_movement_stats() to authenticated;

insert into public.goal_activity_catalog (
  id,
  kind,
  label,
  unit_singular,
  unit_plural,
  exercise_type,
  tracking_mode,
  decimal_places,
  sort_order,
  enabled
)
values
  (
    'jumping_jacks',
    'reps',
    'Jumping Jacks',
    'rep',
    'reps',
    'jumping_jacks'::public.exercise_type,
    'auto_reps',
    0,
    37,
    true
  )
on conflict (id) do update
set
  kind = excluded.kind,
  label = excluded.label,
  unit_singular = excluded.unit_singular,
  unit_plural = excluded.unit_plural,
  exercise_type = excluded.exercise_type,
  tracking_mode = excluded.tracking_mode,
  decimal_places = excluded.decimal_places,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;
