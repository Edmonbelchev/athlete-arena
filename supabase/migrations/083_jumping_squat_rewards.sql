-- Jumping squats: rewards, stats, daily quests, and goal catalog.

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
    when 'jumping_squats' then
      v_xp := v_reps * 1;
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
    when 'jumping_squats' then
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
    when 'jumping_squats' then
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
    when 'jumping_squats' then 'jumping squats'
    else p_exercise::text
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
    ) as total_jumping_squats,

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
    'jumping_squats',
    'reps',
    'Jumping Squats',
    'rep',
    'reps',
    'jumping_squats'::public.exercise_type,
    'auto_reps',
    0,
    38,
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
