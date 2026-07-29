-- Profiles table, auto-creation on signup, RLS, and stat protection.
-- Run in Supabase SQL Editor or via Supabase CLI.

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
    select 1
    from public.profiles
    where lower(username) = final_username
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
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
