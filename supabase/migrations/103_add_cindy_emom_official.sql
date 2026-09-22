-- Official Cindy EMOM: 20 minutes, 5 pull-ups / 10 push-ups / 15 squats each minute.

update public.workout_catalog
set sort_order = 3
where title = 'Living Room Mash 96'
  and is_active = true
  and sort_order = 2;

insert into public.workout_catalog (
  title,
  description,
  workout_type,
  time_limit_seconds,
  leaderboard_metric,
  sort_order
)
select
  'Cindy EMOM',
  'Every minute on the minute for 20 minutes: 5 pull-ups, 10 push-ups, 15 squats. Finish the circuit within each minute; rest until the next minute. Ranked by completed minutes, then total reps when tied.',
  'emom'::public.custom_workout_type,
  1200,
  'most_rounds'::public.workout_leaderboard_metric,
  2
where not exists (
  select 1
  from public.workout_catalog wc
  where wc.title = 'Cindy EMOM'
    and wc.is_active = true
);

update public.workout_catalog
set
  description = 'Every minute on the minute for 20 minutes: 5 pull-ups, 10 push-ups, 15 squats. Finish the circuit within each minute; rest until the next minute. Ranked by completed minutes, then total reps when tied.',
  workout_type = 'emom'::public.custom_workout_type,
  time_limit_seconds = 1200,
  leaderboard_metric = 'most_rounds'::public.workout_leaderboard_metric,
  sort_order = 2,
  is_active = true
where title = 'Cindy EMOM';

insert into public.workout_catalog_exercises (catalog_workout_id, sort_order, exercise_type, target_reps)
select wc.id, exercise.sort_order, exercise.exercise_type, exercise.target_reps
from public.workout_catalog wc
cross join (
  values
    (0, 'pull_ups'::public.exercise_type, 5),
    (1, 'push_ups'::public.exercise_type, 10),
    (2, 'squats'::public.exercise_type, 15)
) as exercise(sort_order, exercise_type, target_reps)
where wc.title = 'Cindy EMOM'
  and wc.is_active = true
  and not exists (
    select 1
    from public.workout_catalog_exercises wce
    where wce.catalog_workout_id = wc.id
  );
