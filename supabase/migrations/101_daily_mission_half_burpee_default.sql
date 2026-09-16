-- Use half burpees instead of pull-ups as the third default daily mission.

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
  v_exercises public.exercise_type[] := array[
    'push_ups'::public.exercise_type,
    'squats'::public.exercise_type,
    'half_burpees'::public.exercise_type
  ];
begin
  v_day_number := (extract(epoch from p_date::timestamptz)::bigint / 86400)::bigint;

  for v_mission_index in 0..2 loop
    v_exercise := v_exercises[v_mission_index + 1];
    v_tier_roll := ((v_day_number + v_mission_index * 17) % 4)::integer;

    select tier.target_reps
    into v_target_reps
    from public.pick_daily_mission_tier(v_exercise, v_tier_roll) as tier;

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
      50,
      v_mission_index,
      null
    )
    on conflict (challenge_date, mission_index) do update
    set
      exercise_type = excluded.exercise_type,
      target_reps = excluded.target_reps,
      xp_reward = 50;
  end loop;
end;
$$;

select public.ensure_daily_mission_templates(current_date);
select public.ensure_daily_mission_templates(current_date + 1);

-- Align open default (non-rerolled) user quests on mission slot 2 with the new template.
update public.daily_challenges dc
set
  exercise_type = t.exercise_type,
  target_reps = t.target_reps,
  xp_reward = t.xp_reward
from public.daily_challenge_templates t
where dc.challenge_date = t.challenge_date
  and dc.mission_index = t.mission_index
  and dc.mission_index = 2
  and coalesce(dc.is_rerolled, false) = false
  and dc.status <> 'completed'::public.challenge_status
  and dc.exercise_type = 'pull_ups'::public.exercise_type
  and t.exercise_type = 'half_burpees'::public.exercise_type;
