-- Goal completion history and lifetime movement stats.

create or replace function public.get_user_goal_history(
  p_limit integer default 50
)
returns table (
  id uuid,
  activity_id text,
  activity_label text,
  activity_kind text,
  unit_singular text,
  unit_plural text,
  decimal_places integer,
  period public.goal_period,
  target_value numeric,
  current_value numeric,
  period_start date,
  period_end date,
  completed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    ug.id,
    ug.activity_id,
    c.label as activity_label,
    c.kind as activity_kind,
    c.unit_singular,
    c.unit_plural,
    c.decimal_places,
    ug.period,
    ug.target_value,
    ug.current_value,
    ug.period_start,
    public.goal_period_end(ug.period, ug.period_start) as period_end,
    ug.completed_at,
    ug.created_at
  from public.user_goals ug
  join public.goal_activity_catalog c on c.id = ug.activity_id
  where ug.user_id = v_user_id
    and ug.status = 'completed'
  order by ug.completed_at desc nulls last, ug.period_start desc, ug.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.get_user_movement_stats()
returns table (
  total_push_ups bigint,
  total_squats bigint,
  total_pull_ups bigint,
  total_dips bigint,
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

grant execute on function public.get_user_goal_history(integer) to authenticated;
grant execute on function public.get_user_movement_stats() to authenticated;
