-- Add sit-ups and plank to exercise_type enum.
-- Must be in its own migration: new enum values cannot be used until committed.
-- Plank is a timed hold: target_reps / completed_reps hold seconds for it.

alter type public.exercise_type add value if not exists 'sit_ups';
alter type public.exercise_type add value if not exists 'plank';
