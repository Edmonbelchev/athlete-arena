-- Official Stimulus Travel WOD 7 EMOM: 15 minutes, 3 push-ups / 3 burpees each minute.

update public.workout_catalog
set sort_order = 4
where title = 'Living Room Mash 96'
  and is_active = true
  and sort_order = 3;

insert into public.workout_catalog (
  title,
  description,
  workout_type,
  time_limit_seconds,
  leaderboard_metric,
  sort_order
)
select
  'Stimulus Travel WOD 7',
  'Every minute on the minute for 15 minutes: 3 push-ups, 3 burpees. Finish the circuit within each minute; rest until the next minute. Ranked by completed minutes, then total reps when tied.',
  'emom'::public.custom_workout_type,
  900,
  'most_rounds'::public.workout_leaderboard_metric,
  3
where not exists (
  select 1
  from public.workout_catalog wc
  where wc.title = 'Stimulus Travel WOD 7'
    and wc.is_active = true
);

update public.workout_catalog
set
  description = 'Every minute on the minute for 15 minutes: 3 push-ups, 3 burpees. Finish the circuit within each minute; rest until the next minute. Ranked by completed minutes, then total reps when tied.',
  workout_type = 'emom'::public.custom_workout_type,
  time_limit_seconds = 900,
  leaderboard_metric = 'most_rounds'::public.workout_leaderboard_metric,
  sort_order = 3,
  is_active = true
where title = 'Stimulus Travel WOD 7';

insert into public.workout_catalog_exercises (catalog_workout_id, sort_order, exercise_type, target_reps)
select wc.id, exercise.sort_order, exercise.exercise_type, exercise.target_reps
from public.workout_catalog wc
cross join (
  values
    (0, 'push_ups'::public.exercise_type, 3),
    (1, 'burpees'::public.exercise_type, 3)
) as exercise(sort_order, exercise_type, target_reps)
where wc.title = 'Stimulus Travel WOD 7'
  and wc.is_active = true
  and not exists (
    select 1
    from public.workout_catalog_exercises wce
    where wce.catalog_workout_id = wc.id
  );
