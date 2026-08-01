-- 30 predefined daily challenges rotated globally by calendar date.
-- Today's workout is resolved from the catalog before any per-user row exists.

create table if not exists public.daily_challenge_catalog (
  slot integer primary key check (slot >= 0 and slot < 30),
  exercise_type public.exercise_type not null,
  target_reps integer not null check (target_reps > 0),
  xp_reward integer not null check (xp_reward > 0)
);

insert into public.daily_challenge_catalog (slot, exercise_type, target_reps, xp_reward)
values
  (0, 'push_ups', 5, 50),
  (1, 'squats', 10, 50),
  (2, 'pull_ups', 3, 50),
  (3, 'dips', 5, 50),
  (4, 'push_ups', 10, 75),
  (5, 'squats', 15, 75),
  (6, 'pull_ups', 5, 75),
  (7, 'dips', 8, 75),
  (8, 'push_ups', 15, 100),
  (9, 'squats', 20, 100),
  (10, 'pull_ups', 8, 100),
  (11, 'dips', 10, 100),
  (12, 'push_ups', 20, 150),
  (13, 'squats', 30, 150),
  (14, 'pull_ups', 10, 150),
  (15, 'dips', 15, 150),
  (16, 'push_ups', 10, 75),
  (17, 'squats', 20, 100),
  (18, 'pull_ups', 5, 75),
  (19, 'dips', 10, 100),
  (20, 'push_ups', 15, 100),
  (21, 'squats', 10, 50),
  (22, 'pull_ups', 8, 100),
  (23, 'dips', 8, 75),
  (24, 'push_ups', 5, 50),
  (25, 'squats', 15, 75),
  (26, 'pull_ups', 3, 50),
  (27, 'dips', 15, 150),
  (28, 'push_ups', 20, 150),
  (29, 'squats', 30, 150)
on conflict (slot) do update
set
  exercise_type = excluded.exercise_type,
  target_reps = excluded.target_reps,
  xp_reward = excluded.xp_reward;

alter table public.daily_challenge_catalog enable row level security;

drop policy if exists "Authenticated users can read daily challenge catalog" on public.daily_challenge_catalog;
create policy "Authenticated users can read daily challenge catalog"
  on public.daily_challenge_catalog
  for select
  to authenticated
  using (true);

alter table public.daily_challenge_templates
  add column if not exists catalog_slot integer check (catalog_slot >= 0 and catalog_slot < 30);

create or replace function public.ensure_daily_challenge_template(
  p_date date default current_date
)
returns public.daily_challenge_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.daily_challenge_templates;
  v_day_number bigint;
  v_catalog_slot integer;
  v_catalog public.daily_challenge_catalog;
begin
  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = p_date;

  if found then
    return v_template;
  end if;

  v_day_number := (extract(epoch from p_date::timestamptz)::bigint / 86400)::bigint;
  v_catalog_slot := (v_day_number % 30)::integer;

  select *
  into v_catalog
  from public.daily_challenge_catalog
  where slot = v_catalog_slot;

  if not found then
    raise exception 'Daily challenge catalog slot % is missing', v_catalog_slot;
  end if;

  insert into public.daily_challenge_templates (
    challenge_date,
    exercise_type,
    target_reps,
    xp_reward,
    catalog_slot
  )
  values (
    p_date,
    v_catalog.exercise_type,
    v_catalog.target_reps,
    v_catalog.xp_reward,
    v_catalog_slot
  )
  on conflict (challenge_date) do nothing
  returning * into v_template;

  if v_template.id is null then
    select *
    into v_template
    from public.daily_challenge_templates
    where challenge_date = p_date;
  end if;

  return v_template;
end;
$$;

create or replace function public.seed_upcoming_daily_challenge_templates(
  p_days_ahead integer default 7
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset integer;
  v_created integer := 0;
begin
  if p_days_ahead < 0 or p_days_ahead > 366 then
    raise exception 'p_days_ahead must be between 0 and 366';
  end if;

  for v_offset in 0..p_days_ahead loop
    perform public.ensure_daily_challenge_template(current_date + v_offset);
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

create or replace function public.get_daily_challenge_home()
returns table (
  template_id uuid,
  challenge_date date,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  catalog_slot integer,
  user_challenge_id uuid,
  user_status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_template public.daily_challenge_templates;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_template := public.ensure_daily_challenge_template(v_today);

  return query
  select
    v_template.id,
    v_template.challenge_date,
    v_template.exercise_type,
    v_template.target_reps,
    v_template.xp_reward,
    v_template.catalog_slot,
    dc.id,
    dc.status,
    coalesce(dc.completed_reps, 0),
    dc.completed_at
  from (select 1) as anchor
  left join public.daily_challenges dc
    on dc.user_id = v_user_id
    and dc.challenge_date = v_today;
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
  v_template public.daily_challenge_templates;
  v_challenge public.daily_challenges;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today;

  if found then
    return v_challenge;
  end if;

  v_template := public.ensure_daily_challenge_template(v_today);

  insert into public.daily_challenges (
    user_id,
    exercise_type,
    target_reps,
    xp_reward,
    challenge_date
  )
  values (
    v_user_id,
    v_template.exercise_type,
    v_template.target_reps,
    v_template.xp_reward,
    v_today
  )
  on conflict (user_id, challenge_date) do nothing
  returning * into v_challenge;

  if v_challenge.id is null then
    select *
    into v_challenge
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_today;
  end if;

  return v_challenge;
end;
$$;

revoke all on function public.seed_upcoming_daily_challenge_templates(integer) from public;
grant execute on function public.seed_upcoming_daily_challenge_templates(integer) to service_role;

revoke all on function public.get_daily_challenge_home() from public;
grant execute on function public.get_daily_challenge_home() to authenticated;
