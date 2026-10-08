-- Cap workout XP at 500, tune down earn rates (sync src/constants/workoutXp.ts).

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
    else 1
  end;
$$;

create or replace function public.clamp_workout_session_xp(p_xp numeric)
returns integer
language sql
immutable
as $$
  select greatest(10, least(500, floor(coalesce(p_xp, 0) * 0.75)::integer));
$$;

create or replace function public.calculate_workout_session_xp(
  p_workout_type public.custom_workout_type,
  p_breakdown jsonb,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_elapsed_seconds integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_rep_xp integer;
  v_required_rep_xp integer;
  v_required_reps integer;
  v_par_seconds integer;
  v_elapsed integer;
  v_multiplier numeric;
  v_intervals integer;
  v_interval_bonus integer;
  v_minutes integer;
begin
  case p_workout_type
    when 'for_time' then
      v_required_rep_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, true);
      v_required_reps := public.sum_workout_required_reps_from_breakdown(p_breakdown);
      v_par_seconds := greatest(120, v_required_reps * 3);
      v_elapsed := greatest(30, coalesce(p_elapsed_seconds, v_par_seconds));
      v_multiplier := least(1.5, greatest(0.5, v_par_seconds::numeric / v_elapsed::numeric));
      return public.clamp_workout_session_xp(v_required_rep_xp * v_multiplier);

    when 'emom' then
      v_rep_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, false);
      v_intervals := greatest(1, coalesce(p_time_limit_seconds, 0) / 60);
      v_interval_bonus := floor(
        30.0 * greatest(0, coalesce(p_completed_rounds, 0))::numeric / v_intervals::numeric
      );
      return public.clamp_workout_session_xp(v_rep_xp + v_interval_bonus);

    else
      v_rep_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, false);
      v_elapsed := coalesce(
        nullif(p_elapsed_seconds, 0),
        nullif(p_time_limit_seconds, 0),
        60
      );
      v_minutes := greatest(1, v_elapsed / 60);
      return public.clamp_workout_session_xp(v_rep_xp + v_minutes * 4);
  end case;
end;
$$;

create or replace function public.preview_for_time_workout_xp(p_breakdown jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_base_xp integer;
  v_required_reps integer;
  v_par_seconds integer;
begin
  v_base_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, true);
  v_required_reps := public.sum_workout_required_reps_from_breakdown(p_breakdown);
  v_par_seconds := greatest(120, v_required_reps * 3);

  return jsonb_build_object(
    'base_xp', public.clamp_workout_session_xp(v_base_xp),
    'min_xp', public.clamp_workout_session_xp(v_base_xp * 0.5),
    'max_xp', public.clamp_workout_session_xp(v_base_xp * 1.5),
    'par_seconds', v_par_seconds
  );
end;
$$;
