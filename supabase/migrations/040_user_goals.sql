-- Personal daily and weekly goals with an extensible activity catalog.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'goal_period') then
    create type public.goal_period as enum ('daily', 'weekly');
  end if;

  if not exists (select 1 from pg_type where typname = 'goal_status') then
    create type public.goal_status as enum ('active', 'completed', 'cancelled');
  end if;
end
$$;

create table if not exists public.goal_activity_catalog (
  id text primary key,
  kind text not null check (kind in ('reps', 'distance', 'steps')),
  label text not null,
  unit_singular text not null,
  unit_plural text not null,
  exercise_type public.exercise_type,
  tracking_mode text not null default 'manual'
    check (tracking_mode in ('auto_reps', 'manual')),
  decimal_places integer not null default 0 check (decimal_places >= 0 and decimal_places <= 3),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.goal_activity_catalog (
  id,
  kind,
  label,
  unit_singular,
  unit_plural,
  exercise_type,
  tracking_mode,
  decimal_places,
  sort_order,
  enabled
)
values
  ('push_ups', 'reps', 'Push-ups', 'rep', 'reps', 'push_ups'::public.exercise_type, 'auto_reps', 0, 10, true),
  ('squats', 'reps', 'Squats', 'rep', 'reps', 'squats'::public.exercise_type, 'auto_reps', 0, 20, true),
  ('pull_ups', 'reps', 'Pull-ups', 'rep', 'reps', 'pull_ups'::public.exercise_type, 'auto_reps', 0, 30, true),
  ('steps', 'steps', 'Steps', 'step', 'steps', null, 'manual', 0, 40, true),
  ('run_km', 'distance', 'Running', 'km', 'km', null, 'manual', 1, 50, true),
  ('run_mi', 'distance', 'Running', 'mile', 'miles', null, 'manual', 1, 60, false)
on conflict (id) do update
set
  kind = excluded.kind,
  label = excluded.label,
  unit_singular = excluded.unit_singular,
  unit_plural = excluded.unit_plural,
  exercise_type = excluded.exercise_type,
  tracking_mode = excluded.tracking_mode,
  decimal_places = excluded.decimal_places,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id text not null references public.goal_activity_catalog (id),
  period public.goal_period not null,
  target_value numeric(12, 3) not null check (target_value > 0),
  current_value numeric(12, 3) not null default 0 check (current_value >= 0),
  period_start date not null,
  status public.goal_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_goals_active_unique_idx
  on public.user_goals (user_id, activity_id, period, period_start)
  where status = 'active';

create index if not exists user_goals_user_period_idx
  on public.user_goals (user_id, period, period_start desc, status);

alter table public.goal_activity_catalog enable row level security;
alter table public.user_goals enable row level security;

drop policy if exists "Anyone can read goal activity catalog" on public.goal_activity_catalog;
create policy "Anyone can read goal activity catalog"
  on public.goal_activity_catalog
  for select
  using (true);

drop policy if exists "Users can view own goals" on public.user_goals;
create policy "Users can view own goals"
  on public.user_goals
  for select
  using (auth.uid() = user_id);

create or replace function public.goal_period_start(
  p_period public.goal_period,
  p_reference timestamptz default now()
)
returns date
language sql
immutable
as $$
  select case p_period
    when 'daily' then (timezone('utc', p_reference))::date
    when 'weekly' then date_trunc('week', timezone('utc', p_reference))::date
  end;
$$;

create or replace function public.goal_period_end(
  p_period public.goal_period,
  p_period_start date
)
returns date
language sql
immutable
as $$
  select case p_period
    when 'daily' then p_period_start
    when 'weekly' then p_period_start + 6
  end;
$$;

create or replace function public.validate_goal_target_value(
  p_kind text,
  p_target_value numeric
)
returns void
language plpgsql
immutable
as $$
begin
  if p_target_value is null or p_target_value <= 0 then
    raise exception 'Target must be greater than zero';
  end if;

  case p_kind
    when 'reps' then
      if p_target_value < 1 or p_target_value > 1000 then
        raise exception 'Rep goals must be between 1 and 1000';
      end if;
    when 'steps' then
      if p_target_value < 500 or p_target_value > 200000 then
        raise exception 'Step goals must be between 500 and 200,000';
      end if;
    when 'distance' then
      if p_target_value < 0.1 or p_target_value > 500 then
        raise exception 'Distance goals must be between 0.1 and 500';
      end if;
    else
      raise exception 'Unsupported goal activity kind: %', p_kind;
  end case;
end;
$$;

create or replace function public.credit_user_goal_progress(
  p_user_id uuid,
  p_activity_id text,
  p_amount numeric,
  p_source_type text default null,
  p_source_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal public.user_goals;
  v_daily_start date := public.goal_period_start('daily');
  v_weekly_start date := public.goal_period_start('weekly');
  v_next_value numeric(12, 3);
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return;
  end if;

  for v_goal in
    select *
    from public.user_goals
    where user_id = p_user_id
      and activity_id = p_activity_id
      and status = 'active'
      and (
        (period = 'daily' and period_start = v_daily_start)
        or (period = 'weekly' and period_start = v_weekly_start)
      )
    for update
  loop
    v_next_value := least(v_goal.current_value + p_amount, v_goal.target_value);

    if v_next_value = v_goal.current_value then
      continue;
    end if;

    update public.user_goals
    set
      current_value = v_next_value,
      status = case when v_next_value >= target_value then 'completed'::public.goal_status else status end,
      completed_at = case
        when v_next_value >= target_value then coalesce(completed_at, now())
        else completed_at
      end,
      updated_at = now()
    where id = v_goal.id;
  end loop;
end;
$$;

create or replace function public.credit_user_goal_progress_for_exercise(
  p_user_id uuid,
  p_exercise public.exercise_type,
  p_amount integer,
  p_source_type text default null,
  p_source_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id text;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return;
  end if;

  select id
  into v_activity_id
  from public.goal_activity_catalog
  where exercise_type = p_exercise
    and tracking_mode = 'auto_reps'
  limit 1;

  if v_activity_id is null then
    return;
  end if;

  perform public.credit_user_goal_progress(
    p_user_id,
    v_activity_id,
    p_amount::numeric,
    p_source_type,
    p_source_id
  );
end;
$$;

create or replace function public.get_goal_activity_catalog()
returns setof public.goal_activity_catalog
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.goal_activity_catalog
  where enabled = true
  order by sort_order, label;
$$;

create or replace function public.get_user_goals(
  p_include_completed boolean default true
)
returns table (
  id uuid,
  activity_id text,
  activity_label text,
  activity_kind text,
  unit_singular text,
  unit_plural text,
  tracking_mode text,
  decimal_places integer,
  period public.goal_period,
  target_value numeric,
  current_value numeric,
  period_start date,
  period_end date,
  status public.goal_status,
  completed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_daily_start date := public.goal_period_start('daily');
  v_weekly_start date := public.goal_period_start('weekly');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    ug.id,
    ug.activity_id,
    c.label as activity_label,
    c.kind as activity_kind,
    c.unit_singular,
    c.unit_plural,
    c.tracking_mode,
    c.decimal_places,
    ug.period,
    ug.target_value,
    ug.current_value,
    ug.period_start,
    public.goal_period_end(ug.period, ug.period_start) as period_end,
    ug.status,
    ug.completed_at,
    ug.created_at
  from public.user_goals ug
  join public.goal_activity_catalog c on c.id = ug.activity_id
  where ug.user_id = v_user_id
    and ug.status <> 'cancelled'
    and (
      (ug.period = 'daily' and ug.period_start = v_daily_start)
      or (ug.period = 'weekly' and ug.period_start = v_weekly_start)
    )
  order by ug.period, c.sort_order, ug.created_at;
end;
$$;

create or replace function public.create_user_goal(
  p_activity_id text,
  p_period public.goal_period,
  p_target_value numeric
)
returns public.user_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.goal_activity_catalog;
  v_period_start date;
  v_active_count integer;
  v_goal public.user_goals;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_activity
  from public.goal_activity_catalog
  where id = p_activity_id
    and enabled = true;

  if not found then
    raise exception 'Activity not available';
  end if;

  perform public.validate_goal_target_value(v_activity.kind, p_target_value);

  v_period_start := public.goal_period_start(p_period);

  select count(*)
  into v_active_count
  from public.user_goals
  where user_id = v_user_id
    and period = p_period
    and period_start = v_period_start
    and status = 'active';

  if v_active_count >= 5 then
    raise exception 'You can only have 5 active % goals at a time', p_period;
  end if;

  if exists (
    select 1
    from public.user_goals
    where user_id = v_user_id
      and activity_id = p_activity_id
      and period = p_period
      and period_start = v_period_start
      and status = 'active'
  ) then
    raise exception 'You already have an active goal for this activity and period';
  end if;

  insert into public.user_goals (
    user_id,
    activity_id,
    period,
    target_value,
    period_start
  )
  values (
    v_user_id,
    p_activity_id,
    p_period,
    p_target_value,
    v_period_start
  )
  returning * into v_goal;

  return v_goal;
end;
$$;

create or replace function public.cancel_user_goal(
  p_goal_id uuid
)
returns public.user_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.user_goals;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_goals
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_goal_id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_goal;

  if not found then
    raise exception 'Goal not found';
  end if;

  return v_goal;
end;
$$;

create or replace function public.log_goal_progress(
  p_goal_id uuid,
  p_amount numeric
)
returns public.user_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.user_goals;
  v_activity public.goal_activity_catalog;
  v_next_value numeric(12, 3);
  v_period_start date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Progress amount must be greater than zero';
  end if;

  select ug.*, c.*
  into v_goal
  from public.user_goals ug
  join public.goal_activity_catalog c on c.id = ug.activity_id
  where ug.id = p_goal_id
    and ug.user_id = v_user_id
  for update of ug;

  if not found then
    raise exception 'Goal not found';
  end if;

  select *
  into v_activity
  from public.goal_activity_catalog
  where id = v_goal.activity_id;

  if v_activity.tracking_mode <> 'manual' then
    raise exception 'This goal tracks progress automatically';
  end if;

  v_period_start := public.goal_period_start(v_goal.period);

  if v_goal.period_start <> v_period_start then
    raise exception 'This goal has expired';
  end if;

  if v_goal.status <> 'active' then
    raise exception 'Goal is not active';
  end if;

  v_next_value := least(v_goal.current_value + p_amount, v_goal.target_value);

  update public.user_goals
  set
    current_value = v_next_value,
    status = case when v_next_value >= target_value then 'completed'::public.goal_status else status end,
    completed_at = case
      when v_next_value >= target_value then coalesce(completed_at, now())
      else completed_at
    end,
    updated_at = now()
  where id = p_goal_id
  returning * into v_goal;

  return v_goal;
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
  v_yesterday_all_complete boolean;
  v_all_missions_complete boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
  v_earned_xp constant integer := 50;
  v_earned_coins constant integer := 20;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.status <> 'in_progress' then
    raise exception 'Challenge is not in progress';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  update public.daily_challenges
  set
    status = 'completed',
    completed_reps = p_completed_reps,
    xp_reward = v_earned_xp,
    completed_at = now()
  where id = p_challenge_id
  returning * into v_challenge;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  v_new_total_xp := v_new_total_xp + v_earned_xp;
  v_new_level := public.calculate_level(v_new_total_xp);

  select count(*) = 3
  into v_all_missions_complete
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_challenge.challenge_date
    and status = 'completed';

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  if v_all_missions_complete then
    select count(*) = 3
    into v_yesterday_all_complete
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed';

    if v_yesterday_all_complete then
      v_new_streak := v_current_streak + 1;
    else
      v_new_streak := 1;
    end if;

    v_new_longest_streak := greatest(v_new_longest_streak, v_new_streak);

    update public.profiles
    set
      total_xp = v_new_total_xp,
      level = v_new_level,
      current_streak = v_new_streak,
      longest_streak = v_new_longest_streak
    where id = v_user_id;
  else
    update public.profiles
    set
      total_xp = v_new_total_xp,
      level = v_new_level
    where id = v_user_id;
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.log_xp_event(
    v_user_id,
    v_earned_xp,
    'daily_challenge',
    v_challenge.id::text
  );

  perform public.award_coins(v_user_id, v_earned_coins);

  perform public.credit_user_goal_progress_for_exercise(
    v_user_id,
    v_challenge.exercise_type,
    p_completed_reps,
    'daily_challenge',
    p_challenge_id::text
  );

  return v_challenge;
end;
$$;

create or replace function public.complete_friend_challenge(
  p_participant_id uuid,
  p_completed_reps integer
)
returns public.friend_challenge_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.friend_challenge_participants;
  v_challenge public.friend_challenges;
  v_previous_reps integer;
  v_new_reps integer;
  v_delta integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_completed_reps < 0 then
    raise exception 'Completed reps must be non-negative';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_participant.status = 'expired' then
    raise exception 'Challenge expired';
  end if;

  if v_participant.status = 'completed' then
    return v_participant;
  end if;

  if v_participant.status = 'pending' then
    raise exception 'Accept the challenge before completing reps';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  v_previous_reps := v_participant.completed_reps;

  if v_participant.started_at is null then
    if p_completed_reps < 1 then
      raise exception 'Complete at least one rep to start the timer';
    end if;

    update public.friend_challenge_participants
    set
      started_at = now(),
      completed_reps = greatest(p_completed_reps, completed_reps)
    where id = p_participant_id
    returning * into v_participant;

    v_new_reps := v_participant.completed_reps;
    v_delta := greatest(v_new_reps - v_previous_reps, 0);

    if v_delta > 0 then
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );
    end if;

    if p_completed_reps >= v_challenge.target_reps then
      update public.friend_challenge_participants
      set
        completed_reps = v_challenge.target_reps,
        status = 'completed',
        completed_at = coalesce(completed_at, now())
      where id = p_participant_id
      returning * into v_participant;

      perform public.resolve_friend_challenge_race(v_challenge.id);
    end if;

    return v_participant;
  end if;

  if v_challenge.time_limit_seconds is not null
     and v_participant.started_at + make_interval(secs => v_challenge.time_limit_seconds) < now() then
    update public.friend_challenge_participants
    set status = 'expired'::public.challenge_status
    where id = p_participant_id;

    perform public.resolve_friend_challenge_race(v_challenge.id);

    raise exception 'Challenge expired';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    update public.friend_challenge_participants
    set completed_reps = greatest(p_completed_reps, completed_reps)
    where id = p_participant_id
    returning * into v_participant;

    v_new_reps := v_participant.completed_reps;
    v_delta := greatest(v_new_reps - v_previous_reps, 0);

    if v_delta > 0 then
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );
    end if;

    return v_participant;
  end if;

  update public.friend_challenge_participants
  set
    completed_reps = v_challenge.target_reps,
    status = 'completed',
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id
  returning * into v_participant;

  v_new_reps := v_participant.completed_reps;
  v_delta := greatest(v_new_reps - v_previous_reps, 0);

  if v_delta > 0 then
    perform public.credit_user_goal_progress_for_exercise(
      v_user_id,
      v_challenge.exercise_type,
      v_delta,
      'friend_challenge',
      p_participant_id::text
    );
  end if;

  perform public.resolve_friend_challenge_race(v_challenge.id);

  return v_participant;
end;
$$;

grant execute on function public.get_goal_activity_catalog() to authenticated, anon;
grant execute on function public.get_user_goals(boolean) to authenticated;
grant execute on function public.create_user_goal(text, public.goal_period, numeric) to authenticated;
grant execute on function public.cancel_user_goal(uuid) to authenticated;
grant execute on function public.log_goal_progress(uuid, numeric) to authenticated;
