-- Workout holds (plank) can target up to 30 minutes; rep exercises stay capped at 500.
-- Keep in sync with getTargetMax in src/components/workouts/CreateWorkoutModal.tsx.

alter table public.custom_workout_template_exercises
  drop constraint if exists custom_workout_template_exercises_target_reps_check;

alter table public.custom_workout_template_exercises
  add constraint custom_workout_template_exercises_target_reps_check
  check (
    target_reps >= 1
    and target_reps <= case when exercise_type = 'plank'::public.exercise_type then 1800 else 500 end
  );

alter table public.workout_catalog_exercises
  drop constraint if exists workout_catalog_exercises_target_reps_check;

alter table public.workout_catalog_exercises
  add constraint workout_catalog_exercises_target_reps_check
  check (
    target_reps >= 1
    and target_reps <= case when exercise_type = 'plank'::public.exercise_type then 1800 else 500 end
  );
