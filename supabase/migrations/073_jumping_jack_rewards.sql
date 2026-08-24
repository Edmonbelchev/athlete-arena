-- Jumping jacks: 0.5 XP/rep and 1 coin/10 reps (friend challenges + daily mission coin helper).

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
