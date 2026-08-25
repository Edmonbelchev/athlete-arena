-- Add for_time workout type and fastest_time leaderboard metric.
-- Must be in its own migration: new enum values cannot be used until committed.

alter type public.custom_workout_type add value if not exists 'for_time';

alter type public.workout_leaderboard_metric add value if not exists 'fastest_time';
