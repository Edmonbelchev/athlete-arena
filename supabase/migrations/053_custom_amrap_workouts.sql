-- Custom AMRAP workouts: templates, session history, and friend sharing.

create type public.custom_workout_type as enum ('amrap');

create table public.custom_workout_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  workout_type public.custom_workout_type not null default 'amrap',
  time_limit_seconds integer not null check (time_limit_seconds between 60 and 7200),
  created_at timestamptz not null default now()
);

create table public.custom_workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.custom_workout_templates (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  exercise_type public.exercise_type not null,
  target_reps integer not null check (target_reps between 1 and 500),
  unique (template_id, sort_order)
);

create table public.custom_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.custom_workout_templates (id) on delete set null,
  title text not null,
  time_limit_seconds integer not null,
  completed_rounds integer not null default 0 check (completed_rounds >= 0),
  total_reps integer not null default 0 check (total_reps >= 0),
  exercise_breakdown jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null default now()
);

create table public.custom_workout_template_shares (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.custom_workout_templates (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  shared_with_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (template_id, shared_with_id),
  check (owner_id <> shared_with_id)
);

create index custom_workout_templates_creator_idx
  on public.custom_workout_templates (creator_id, created_at desc);

create index custom_workout_template_exercises_template_idx
  on public.custom_workout_template_exercises (template_id, sort_order);

create index custom_workout_sessions_user_idx
  on public.custom_workout_sessions (user_id, completed_at desc);

create index custom_workout_template_shares_recipient_idx
  on public.custom_workout_template_shares (shared_with_id, created_at desc);

alter table public.custom_workout_templates enable row level security;
alter table public.custom_workout_template_exercises enable row level security;
alter table public.custom_workout_sessions enable row level security;
alter table public.custom_workout_template_shares enable row level security;

create or replace function public.create_custom_workout_template(
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_exercise jsonb;
  v_sort_order integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  insert into public.custom_workout_templates (creator_id, title, time_limit_seconds)
  values (v_user_id, trim(p_title), p_time_limit_seconds)
  returning id into v_template_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    insert into public.custom_workout_template_exercises (
      template_id,
      sort_order,
      exercise_type,
      target_reps
    )
    values (
      v_template_id,
      v_sort_order,
      (v_exercise->>'exercise_type')::public.exercise_type,
      (v_exercise->>'target_reps')::integer
    );

    v_sort_order := v_sort_order + 1;
  end loop;

  return v_template_id;
end;
$$;

create or replace function public.get_my_custom_workout_templates()
returns table (
  template_id uuid,
  title text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  exercise_count integer,
  created_at timestamptz,
  is_owner boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    t.id as template_id,
    t.title,
    t.workout_type,
    t.time_limit_seconds,
    count(e.id)::integer as exercise_count,
    t.created_at,
    (t.creator_id = v_user_id) as is_owner
  from public.custom_workout_templates t
  left join public.custom_workout_template_exercises e on e.template_id = t.id
  where t.creator_id = v_user_id
     or exists (
       select 1
       from public.custom_workout_template_shares s
       where s.template_id = t.id
         and s.shared_with_id = v_user_id
     )
  group by t.id, t.title, t.workout_type, t.time_limit_seconds, t.created_at, t.creator_id
  order by t.created_at desc;
end;
$$;

create or replace function public.get_custom_workout_template_detail(p_template_id uuid)
returns table (
  template_id uuid,
  title text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_owner boolean,
  exercise_id uuid,
  sort_order integer,
  exercise_type public.exercise_type,
  target_reps integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select t.creator_id
  into v_creator_id
  from public.custom_workout_templates t
  where t.id = p_template_id;

  if not found then
    raise exception 'Workout template not found';
  end if;

  if v_creator_id <> v_user_id
     and not exists (
       select 1
       from public.custom_workout_template_shares s
       where s.template_id = p_template_id
         and s.shared_with_id = v_user_id
     ) then
    raise exception 'Workout template not found';
  end if;

  return query
  select
    t.id as template_id,
    t.title,
    t.workout_type,
    t.time_limit_seconds,
    t.creator_id,
    p.username as creator_username,
    p.display_name as creator_display_name,
    (t.creator_id = v_user_id) as is_owner,
    e.id as exercise_id,
    e.sort_order,
    e.exercise_type,
    e.target_reps
  from public.custom_workout_templates t
  join public.profiles p on p.id = t.creator_id
  join public.custom_workout_template_exercises e on e.template_id = t.id
  where t.id = p_template_id
  order by e.sort_order asc;
end;
$$;

create or replace function public.share_custom_workout_template(
  p_template_id uuid,
  p_friend_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.custom_workout_templates t
    where t.id = p_template_id
      and t.creator_id = v_user_id
  ) then
    raise exception 'Workout template not found';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only share workouts with friends';
  end if;

  insert into public.custom_workout_template_shares (template_id, owner_id, shared_with_id)
  values (p_template_id, v_user_id, p_friend_id)
  on conflict (template_id, shared_with_id) do nothing;
end;
$$;

create or replace function public.save_custom_workout_session(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_total_reps integer,
  p_exercise_breakdown jsonb,
  p_started_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.custom_workout_sessions (
    user_id,
    template_id,
    title,
    time_limit_seconds,
    completed_rounds,
    total_reps,
    exercise_breakdown,
    started_at
  )
  values (
    v_user_id,
    p_template_id,
    trim(p_title),
    p_time_limit_seconds,
    p_completed_rounds,
    p_total_reps,
    coalesce(p_exercise_breakdown, '[]'::jsonb),
    p_started_at
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.create_custom_workout_template(text, integer, jsonb) to authenticated;
grant execute on function public.get_my_custom_workout_templates() to authenticated;
grant execute on function public.get_custom_workout_template_detail(uuid) to authenticated;
grant execute on function public.share_custom_workout_template(uuid, uuid) to authenticated;
grant execute on function public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz) to authenticated;
