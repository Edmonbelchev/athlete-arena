-- Official workout catalog, premium subscriptions, session history, and per-workout leaderboards.

alter type public.custom_workout_type add value if not exists 'emom';

do $$
begin
  create type public.workout_leaderboard_metric as enum ('most_rounds');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.workout_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 80),
  description text,
  workout_type public.custom_workout_type not null default 'amrap',
  time_limit_seconds integer not null check (time_limit_seconds between 60 and 7200),
  leaderboard_metric public.workout_leaderboard_metric,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint workout_catalog_leaderboard_metric_check check (
    (workout_type = 'amrap' and leaderboard_metric is not null)
    or (workout_type <> 'amrap' and leaderboard_metric is null)
  )
);

create table if not exists public.workout_catalog_exercises (
  id uuid primary key default gen_random_uuid(),
  catalog_workout_id uuid not null references public.workout_catalog (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  exercise_type public.exercise_type not null,
  target_reps integer not null check (target_reps between 1 and 500),
  unique (catalog_workout_id, sort_order)
);

create index if not exists workout_catalog_active_sort_idx
  on public.workout_catalog (is_active, sort_order, created_at desc);

create index if not exists workout_catalog_exercises_catalog_idx
  on public.workout_catalog_exercises (catalog_workout_id, sort_order);

create table if not exists public.user_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('active', 'expired', 'canceled')),
  provider text not null check (provider in ('manual', 'apple', 'google', 'stripe', 'revenuecat')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.custom_workout_sessions
  add column if not exists catalog_workout_id uuid references public.workout_catalog (id) on delete set null;

create index if not exists custom_workout_sessions_catalog_user_idx
  on public.custom_workout_sessions (catalog_workout_id, user_id, completed_at desc)
  where catalog_workout_id is not null;

create index if not exists custom_workout_sessions_user_template_idx
  on public.custom_workout_sessions (user_id, template_id, completed_at desc)
  where template_id is not null;

alter table public.workout_catalog enable row level security;
alter table public.workout_catalog_exercises enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists "Authenticated users can read active catalog workouts" on public.workout_catalog;
create policy "Authenticated users can read active catalog workouts"
  on public.workout_catalog
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Authenticated users can read catalog workout exercises" on public.workout_catalog_exercises;
create policy "Authenticated users can read catalog workout exercises"
  on public.workout_catalog_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_catalog wc
      where wc.id = catalog_workout_id
        and wc.is_active = true
    )
  );

drop policy if exists "Users can read own subscription" on public.user_subscriptions;
create policy "Users can read own subscription"
  on public.user_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.user_has_premium_access(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subscription public.user_subscriptions;
begin
  if p_user_id is null then
    return false;
  end if;

  select *
  into v_subscription
  from public.user_subscriptions
  where user_id = p_user_id;

  if not found then
    return false;
  end if;

  if v_subscription.status <> 'active' then
    return false;
  end if;

  if v_subscription.expires_at is not null and v_subscription.expires_at <= now() then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.get_my_premium_status()
returns table (
  is_premium boolean,
  provider text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription public.user_subscriptions;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_subscription
  from public.user_subscriptions
  where user_id = v_user_id;

  if not found then
    return query select false, null::text, null::timestamptz;
    return;
  end if;

  return query
  select
    public.user_has_premium_access(v_user_id),
    v_subscription.provider,
    v_subscription.expires_at;
end;
$$;

create or replace function public.get_workout_catalog()
returns table (
  catalog_workout_id uuid,
  title text,
  description text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  leaderboard_metric public.workout_leaderboard_metric,
  exercise_count integer,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    wc.id,
    wc.title,
    wc.description,
    wc.workout_type,
    wc.time_limit_seconds,
    wc.leaderboard_metric,
    count(wce.id)::integer as exercise_count,
    wc.sort_order
  from public.workout_catalog wc
  left join public.workout_catalog_exercises wce on wce.catalog_workout_id = wc.id
  where wc.is_active = true
  group by wc.id
  order by wc.sort_order asc, wc.created_at asc;
end;
$$;

create or replace function public.get_workout_catalog_detail(p_catalog_workout_id uuid)
returns table (
  catalog_workout_id uuid,
  title text,
  description text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  leaderboard_metric public.workout_leaderboard_metric,
  exercise_id uuid,
  sort_order integer,
  exercise_type public.exercise_type,
  target_reps integer,
  my_best_rounds integer,
  my_best_reps integer,
  my_session_count integer
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

  if not exists (
    select 1
    from public.workout_catalog wc
    where wc.id = p_catalog_workout_id
      and wc.is_active = true
  ) then
    raise exception 'Workout not found';
  end if;

  return query
  with my_stats as (
    select
      best.completed_rounds::integer as best_rounds,
      best.total_reps::integer as best_reps,
      stats.session_count
    from (
      select count(*)::integer as session_count
      from public.custom_workout_sessions s
      where s.user_id = v_user_id
        and s.catalog_workout_id = p_catalog_workout_id
    ) stats
    left join lateral (
      select s.completed_rounds, s.total_reps
      from public.custom_workout_sessions s
      where s.user_id = v_user_id
        and s.catalog_workout_id = p_catalog_workout_id
      order by s.completed_rounds desc, s.total_reps desc, s.completed_at desc
      limit 1
    ) best on true
  )
  select
    wc.id,
    wc.title,
    wc.description,
    wc.workout_type,
    wc.time_limit_seconds,
    wc.leaderboard_metric,
    wce.id,
    wce.sort_order,
    wce.exercise_type,
    wce.target_reps,
    ms.best_rounds,
    ms.best_reps,
    ms.session_count
  from public.workout_catalog wc
  cross join my_stats ms
  join public.workout_catalog_exercises wce on wce.catalog_workout_id = wc.id
  where wc.id = p_catalog_workout_id
  order by wce.sort_order asc;
end;
$$;

create or replace function public.get_my_workout_sessions(
  p_catalog_workout_id uuid default null,
  p_template_id uuid default null,
  p_limit integer default 20
)
returns table (
  session_id uuid,
  title text,
  time_limit_seconds integer,
  completed_rounds integer,
  total_reps integer,
  exercise_breakdown jsonb,
  started_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (p_catalog_workout_id is null and p_template_id is null)
     or (p_catalog_workout_id is not null and p_template_id is not null) then
    raise exception 'Provide exactly one workout reference';
  end if;

  if p_template_id is not null then
    if not exists (
      select 1
      from public.custom_workout_templates t
      where t.id = p_template_id
        and t.deleted_at is null
        and (
          t.creator_id = v_user_id
          or exists (
            select 1
            from public.custom_workout_template_shares s
            where s.template_id = p_template_id
              and s.shared_with_id = v_user_id
          )
        )
    ) then
      raise exception 'Workout template not found';
    end if;
  end if;

  if p_catalog_workout_id is not null then
    if not exists (
      select 1
      from public.workout_catalog wc
      where wc.id = p_catalog_workout_id
        and wc.is_active = true
    ) then
      raise exception 'Workout not found';
    end if;
  end if;

  return query
  select
    s.id,
    s.title,
    s.time_limit_seconds,
    s.completed_rounds,
    s.total_reps,
    s.exercise_breakdown,
    s.started_at,
    s.completed_at
  from public.custom_workout_sessions s
  where s.user_id = v_user_id
    and (
      (p_catalog_workout_id is not null and s.catalog_workout_id = p_catalog_workout_id)
      or (p_template_id is not null and s.template_id = p_template_id)
    )
  order by s.completed_at desc
  limit v_limit;
end;
$$;

create or replace function public.get_catalog_workout_leaderboard(
  p_catalog_workout_id uuid,
  p_period text default 'all_time',
  p_limit integer default 50
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  level integer,
  score_amount integer,
  tiebreak_amount integer,
  avatar_url text,
  avatar_icon text,
  avatar_background text,
  frame_border_color text,
  frame_border_width integer,
  is_current_user boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_period not in ('weekly', 'all_time') then
    raise exception 'Invalid leaderboard period';
  end if;

  if not exists (
    select 1
    from public.workout_catalog wc
    where wc.id = p_catalog_workout_id
      and wc.is_active = true
      and wc.leaderboard_metric is not null
  ) then
    raise exception 'Leaderboard not available for this workout';
  end if;

  if p_period = 'weekly' then
    return query
    with week_start as (
      select date_trunc('week', timezone('utc', now())) as starts_at
    ),
    session_scores as (
      select
        s.user_id,
        s.completed_rounds,
        s.total_reps,
        s.completed_at
      from public.custom_workout_sessions s
      cross join week_start w
      where s.catalog_workout_id = p_catalog_workout_id
        and s.completed_at >= w.starts_at
    ),
    best_per_user as (
      select distinct on (ss.user_id)
        ss.user_id,
        ss.completed_rounds as score_amount,
        ss.total_reps as tiebreak_amount
      from session_scores ss
      order by ss.user_id, ss.completed_rounds desc, ss.total_reps desc, ss.completed_at desc
    ),
    ranked as (
      select
        row_number() over (
          order by b.score_amount desc, coalesce(b.tiebreak_amount, 0) desc, p.username asc
        ) as rank,
        p.id as user_id,
        p.username,
        p.display_name,
        p.level,
        b.score_amount,
        coalesce(b.tiebreak_amount, 0) as tiebreak_amount,
        p.avatar_url,
        avatar_item.metadata->>'icon' as avatar_icon,
        avatar_item.metadata->>'backgroundColor' as avatar_background,
        frame_item.metadata->>'borderColor' as frame_border_color,
        nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
        (p.id = v_user_id) as is_current_user
      from best_per_user b
      join public.profiles p on p.id = b.user_id
      left join public.user_equipped_items uei_avatar
        on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
      left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
      left join public.user_equipped_items uei_frame
        on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
      left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
      where b.score_amount > 0
    )
    select *
    from ranked r
    where r.rank <= v_limit or r.is_current_user
    order by r.rank;

    return;
  end if;

  return query
  with session_scores as (
    select
      s.user_id,
      s.completed_rounds,
      s.total_reps,
      s.completed_at
    from public.custom_workout_sessions s
    where s.catalog_workout_id = p_catalog_workout_id
  ),
  best_per_user as (
    select distinct on (ss.user_id)
      ss.user_id,
      ss.completed_rounds as score_amount,
      ss.total_reps as tiebreak_amount
    from session_scores ss
    order by ss.user_id, ss.completed_rounds desc, ss.total_reps desc, ss.completed_at desc
  ),
  ranked as (
    select
      row_number() over (
        order by b.score_amount desc, coalesce(b.tiebreak_amount, 0) desc, p.username asc
      ) as rank,
      p.id as user_id,
      p.username,
      p.display_name,
      p.level,
      b.score_amount,
      coalesce(b.tiebreak_amount, 0) as tiebreak_amount,
      p.avatar_url,
      avatar_item.metadata->>'icon' as avatar_icon,
      avatar_item.metadata->>'backgroundColor' as avatar_background,
      frame_item.metadata->>'borderColor' as frame_border_color,
      nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
      (p.id = v_user_id) as is_current_user
    from best_per_user b
    join public.profiles p on p.id = b.user_id
    left join public.user_equipped_items uei_avatar
      on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
    left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
    left join public.user_equipped_items uei_frame
      on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
    left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
    where b.score_amount > 0
  )
  select *
  from ranked r
  where r.rank <= v_limit or r.is_current_user
  order by r.rank;
end;
$$;

create or replace function public.save_custom_workout_session(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_total_reps integer,
  p_exercise_breakdown jsonb,
  p_started_at timestamptz,
  p_catalog_workout_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_total_reps integer;
  v_has_template_access boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (p_template_id is null and p_catalog_workout_id is null)
     or (p_template_id is not null and p_catalog_workout_id is not null) then
    raise exception 'Provide exactly one workout reference';
  end if;

  if p_catalog_workout_id is not null then
    if not exists (
      select 1
      from public.workout_catalog wc
      where wc.id = p_catalog_workout_id
        and wc.is_active = true
    ) then
      raise exception 'Workout not found';
    end if;
  end if;

  if p_template_id is not null then
    select exists (
      select 1
      from public.custom_workout_templates t
      where t.id = p_template_id
        and t.deleted_at is null
        and (
          t.creator_id = v_user_id
          or exists (
            select 1
            from public.custom_workout_template_shares s
            where s.template_id = p_template_id
              and s.shared_with_id = v_user_id
          )
        )
    )
    into v_has_template_access;

    if not v_has_template_access then
      raise exception 'Workout template not found';
    end if;
  end if;

  insert into public.custom_workout_sessions (
    user_id,
    template_id,
    catalog_workout_id,
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
    p_catalog_workout_id,
    trim(p_title),
    p_time_limit_seconds,
    p_completed_rounds,
    p_total_reps,
    coalesce(p_exercise_breakdown, '[]'::jsonb),
    p_started_at
  )
  returning id into v_session_id;

  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_exercise_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    v_total_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);

    if v_exercise is not null and v_total_reps > 0 then
      perform public.credit_daily_mission_reps(
        v_exercise,
        'custom_workout',
        v_session_id::text,
        v_total_reps
      );
    end if;
  end loop;

  return v_session_id;
end;
$$;

create or replace function public.create_custom_workout_template(
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb,
  p_workout_type text default 'amrap'
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

  if not public.user_has_premium_access(v_user_id) then
    raise exception 'Premium subscription required to create workouts';
  end if;

  if p_workout_type not in ('amrap') then
    raise exception 'Unsupported workout type';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  insert into public.custom_workout_templates (creator_id, title, workout_type, time_limit_seconds)
  values (
    v_user_id,
    trim(p_title),
    p_workout_type::public.custom_workout_type,
    p_time_limit_seconds
  )
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

create or replace function public.update_custom_workout_template(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb,
  p_workout_type text default 'amrap'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise jsonb;
  v_sort_order integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.user_has_premium_access(v_user_id) then
    raise exception 'Premium subscription required to edit workouts';
  end if;

  if p_workout_type not in ('amrap') then
    raise exception 'Unsupported workout type';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  update public.custom_workout_templates
  set
    title = trim(p_title),
    workout_type = p_workout_type::public.custom_workout_type,
    time_limit_seconds = p_time_limit_seconds
  where id = p_template_id
    and creator_id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception 'Workout template not found';
  end if;

  delete from public.custom_workout_template_exercises
  where template_id = p_template_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    insert into public.custom_workout_template_exercises (
      template_id,
      sort_order,
      exercise_type,
      target_reps
    )
    values (
      p_template_id,
      v_sort_order,
      (v_exercise->>'exercise_type')::public.exercise_type,
      (v_exercise->>'target_reps')::integer
    );

    v_sort_order := v_sort_order + 1;
  end loop;
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
  v_template_title text;
  v_share_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.user_has_premium_access(v_user_id) then
    raise exception 'Premium subscription required to share workouts';
  end if;

  select t.title
  into v_template_title
  from public.custom_workout_templates t
  where t.id = p_template_id
    and t.creator_id = v_user_id
    and t.deleted_at is null;

  if not found then
    raise exception 'Workout template not found';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only share workouts with friends';
  end if;

  insert into public.custom_workout_template_shares (template_id, owner_id, shared_with_id)
  values (p_template_id, v_user_id, p_friend_id)
  on conflict (template_id, shared_with_id) do nothing
  returning id into v_share_id;

  if v_share_id is not null then
    perform public.enqueue_push_notification(
      p_friend_id,
      'Workout shared with you',
      public.format_profile_short_name(v_user_id) || ' shared "' || v_template_title || '" with you',
      jsonb_build_object(
        'type', 'workout_shared',
        'templateId', p_template_id,
        'url', '/(tabs)/workouts/library?templateId=' || p_template_id::text
      )
    );
  end if;
end;
$$;

insert into public.workout_catalog (
  title,
  description,
  workout_type,
  time_limit_seconds,
  leaderboard_metric,
  sort_order
)
select
  'Cindy AMRAP',
  'CrossFit benchmark: 5 pull-ups, 10 push-ups, 15 squats. Ranked by completed rounds, then reps when rounds are tied.',
  'amrap',
  1200,
  'most_rounds'::public.workout_leaderboard_metric,
  1
where not exists (
  select 1
  from public.workout_catalog wc
  where wc.title = 'Cindy AMRAP'
);

insert into public.workout_catalog_exercises (catalog_workout_id, sort_order, exercise_type, target_reps)
select wc.id, exercise.sort_order, exercise.exercise_type, exercise.target_reps
from public.workout_catalog wc
cross join (
  values
    (0, 'pull_ups'::public.exercise_type, 5),
    (1, 'push_ups'::public.exercise_type, 10),
    (2, 'squats'::public.exercise_type, 15)
) as exercise(sort_order, exercise_type, target_reps)
where wc.title = 'Cindy AMRAP'
  and not exists (
    select 1
    from public.workout_catalog_exercises wce
    where wce.catalog_workout_id = wc.id
  );

grant execute on function public.user_has_premium_access(uuid) to authenticated;
grant execute on function public.get_my_premium_status() to authenticated;
grant execute on function public.get_workout_catalog() to authenticated;
grant execute on function public.get_workout_catalog_detail(uuid) to authenticated;
grant execute on function public.get_my_workout_sessions(uuid, uuid, integer) to authenticated;
grant execute on function public.get_catalog_workout_leaderboard(uuid, text, integer) to authenticated;
grant execute on function public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz, uuid) to authenticated;
grant execute on function public.create_custom_workout_template(text, integer, jsonb, text) to authenticated;
grant execute on function public.update_custom_workout_template(uuid, text, integer, jsonb, text) to authenticated;
grant execute on function public.share_custom_workout_template(uuid, uuid) to authenticated;
