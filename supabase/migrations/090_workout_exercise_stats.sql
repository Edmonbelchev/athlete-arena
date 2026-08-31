-- Include custom/catalog workout session reps in lifetime movement stats.

create or replace function public.get_user_workout_exercise_reps(
  p_user_id uuid,
  p_exercise_type public.exercise_type
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    sum(
      greatest(coalesce((entry.value ->> 'total_reps')::integer, 0), 0)
    ),
    0
  )::bigint
  from public.custom_workout_sessions s
  cross join lateral jsonb_array_elements(coalesce(s.exercise_breakdown, '[]'::jsonb)) as entry(value)
  where s.user_id = p_user_id
    and (entry.value ->> 'exercise_type')::public.exercise_type = p_exercise_type;
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

grant execute on function public.get_user_workout_exercise_reps(uuid, public.exercise_type) to authenticated;
grant execute on function public.get_user_movement_stats() to authenticated;
