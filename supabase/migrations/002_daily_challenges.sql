-- Daily challenges table, enums, indexes, and RLS.

do $$
begin
  create type public.exercise_type as enum ('push_ups', 'squats');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.challenge_status as enum ('pending', 'in_progress', 'completed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_type public.exercise_type not null,
  target_reps integer not null check (target_reps > 0),
  completed_reps integer not null default 0 check (completed_reps >= 0),
  xp_reward integer not null check (xp_reward > 0),
  challenge_date date not null,
  status public.challenge_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint daily_challenges_completed_reps_within_target
    check (completed_reps <= target_reps),
  unique (user_id, challenge_date)
);

create index if not exists daily_challenges_user_date_idx
  on public.daily_challenges (user_id, challenge_date desc);

create index if not exists daily_challenges_user_status_idx
  on public.daily_challenges (user_id, status);

alter table public.daily_challenges enable row level security;

drop policy if exists "Users can view own challenges" on public.daily_challenges;

create policy "Users can view own challenges"
  on public.daily_challenges
  for select
  using (auth.uid() = user_id);

-- Inserts/updates happen only via security definer RPCs.
