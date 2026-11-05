-- Add star jumps and knee strikes to exercise_type.
-- Must be in its own migration: new enum values cannot be used until committed.
-- Each star jump / knee strike is one rep.

alter type public.exercise_type add value if not exists 'star_jumps';
alter type public.exercise_type add value if not exists 'knee_strikes';
