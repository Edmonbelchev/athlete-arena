-- =============================================================================
-- Exercise Challenger - full database setup
-- Run once in Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) >= 3),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]+$')
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  final_username text;
begin
  raw_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));

  if raw_username = '' or raw_username !~ '^[a-z0-9_]{3,30}$' then
    raw_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_username := raw_username;

  while exists (
    select 1 from public.profiles where lower(username) = final_username
  ) loop
    final_username := raw_username || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.protect_profile_stats()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.bypass_profile_stat_protection', true), '') = 'true' then
    return new;
  end if;

  if new.total_xp is distinct from old.total_xp
     or new.level is distinct from old.level
     or new.current_streak is distinct from old.current_streak
     or new.longest_streak is distinct from old.longest_streak then
    raise exception 'Profile stats cannot be modified directly';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_stats on public.profiles;
create trigger profiles_protect_stats
  before update on public.profiles
  for each row
  execute function public.protect_profile_stats();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 2. DAILY CHALLENGES
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.exercise_type as enum ('push_ups', 'squats');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.challenge_status as enum ('pending', 'in_progress', 'completed');
exception when duplicate_object then null;
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
  on public.daily_challenges for select
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. RPC FUNCTIONS
-- -----------------------------------------------------------------------------

create or replace function public.calculate_level(p_total_xp integer)
returns integer
language sql
immutable
as $$
  select floor(greatest(p_total_xp, 0) / 500.0)::integer + 1;
$$;

create or replace function public.pick_daily_challenge_tier(
  p_exercise public.exercise_type
)
returns table (target_reps integer, xp_reward integer)
language plpgsql
as $$
declare
  v_roll integer := floor(random() * 4)::integer;
begin
  if p_exercise = 'push_ups' then
    case v_roll
      when 0 then return query select 5, 50;
      when 1 then return query select 10, 75;
      when 2 then return query select 15, 100;
      else return query select 20, 150;
    end case;
  else
    case v_roll
      when 0 then return query select 10, 50;
      when 1 then return query select 15, 75;
      when 2 then return query select 20, 100;
      else return query select 30, 150;
    end case;
  end if;
end;
$$;

create or replace function public.get_or_create_daily_challenge()
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_challenge public.daily_challenges;
  v_exercise public.exercise_type;
  v_target_reps integer;
  v_xp_reward integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_challenge
  from public.daily_challenges
  where user_id = v_user_id and challenge_date = v_today;

  if found then
    return v_challenge;
  end if;

  if random() < 0.5 then
    v_exercise := 'push_ups';
  else
    v_exercise := 'squats';
  end if;

  select tier.target_reps, tier.xp_reward
  into v_target_reps, v_xp_reward
  from public.pick_daily_challenge_tier(v_exercise) as tier;

  insert into public.daily_challenges (
    user_id, exercise_type, target_reps, xp_reward, challenge_date
  ) values (
    v_user_id, v_exercise, v_target_reps, v_xp_reward, v_today
  )
  on conflict (user_id, challenge_date) do nothing
  returning * into v_challenge;

  if v_challenge.id is null then
    select * into v_challenge
    from public.daily_challenges
    where user_id = v_user_id and challenge_date = v_today;
  end if;

  return v_challenge;
end;
$$;

create or replace function public.start_challenge(p_challenge_id uuid)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.challenge_date <> current_date then
    raise exception 'Challenge is not for today';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.status = 'pending' then
    update public.daily_challenges
    set status = 'in_progress'
    where id = p_challenge_id
    returning * into v_challenge;
  end if;

  return v_challenge;
end;
$$;

create or replace function public.complete_challenge(
  p_challenge_id uuid,
  p_completed_reps integer
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
  v_yesterday date := current_date - 1;
  v_yesterday_completed boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_completed_reps < 0 then
    raise exception 'Completed reps must be non-negative';
  end if;

  select * into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.challenge_date <> current_date then
    raise exception 'Challenge is not for today';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    update public.daily_challenges
    set
      completed_reps = greatest(p_completed_reps, completed_reps),
      status = case
        when status = 'pending' then 'in_progress'::public.challenge_status
        else status
      end
    where id = p_challenge_id
    returning * into v_challenge;

    return v_challenge;
  end if;

  update public.daily_challenges
  set
    completed_reps = target_reps,
    status = 'completed',
    completed_at = coalesce(completed_at, now())
  where id = p_challenge_id
  returning * into v_challenge;

  select exists (
    select 1 from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed'
  ) into v_yesterday_completed;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  if v_yesterday_completed then
    v_new_streak := v_current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  v_new_longest_streak := greatest(v_new_longest_streak, v_new_streak);
  v_new_total_xp := v_new_total_xp + v_challenge.xp_reward;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set
    total_xp = v_new_total_xp,
    level = v_new_level,
    current_streak = v_new_streak,
    longest_streak = v_new_longest_streak
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  return v_challenge;
end;
$$;

revoke all on function public.pick_daily_challenge_tier(public.exercise_type) from public;
revoke all on function public.calculate_level(integer) from public;

grant execute on function public.get_or_create_daily_challenge() to authenticated;
grant execute on function public.start_challenge(uuid) to authenticated;
grant execute on function public.complete_challenge(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. BACKFILL - profiles for users who registered before this migration
-- -----------------------------------------------------------------------------

insert into public.profiles (id, username, display_name)
select
  u.id,
  coalesce(
    nullif(lower(trim(u.raw_user_meta_data->>'username')), ''),
    'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
  ) as username,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    nullif(lower(trim(u.raw_user_meta_data->>'username')), ''),
    'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
  ) as display_name
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. VERIFY (optional - inspect results after running)
-- -----------------------------------------------------------------------------

-- Uncomment to verify:
-- select 'profiles' as object, count(*)::text as count from public.profiles
-- union all
-- select 'daily_challenges', count(*)::text from public.daily_challenges
-- union all
-- select 'rpc: get_or_create_daily_challenge', proname from pg_proc where proname = 'get_or_create_daily_challenge';
