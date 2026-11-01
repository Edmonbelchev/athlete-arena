-- Add high knees, shadow boxing and tuck jumps to exercise_type.
-- Must be in its own migration: new enum values cannot be used until committed.
-- Each knee lift / punch / tuck jump is one rep.

alter type public.exercise_type add value if not exists 'high_knees';
alter type public.exercise_type add value if not exists 'shadow_boxing';
alter type public.exercise_type add value if not exists 'tuck_jumps';
