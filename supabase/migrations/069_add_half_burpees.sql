-- Add half_burpees to exercise_type enum.
-- Must be in its own migration: new enum values cannot be used until committed.

alter type public.exercise_type add value if not exists 'half_burpees';
