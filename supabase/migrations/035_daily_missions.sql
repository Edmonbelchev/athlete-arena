-- Daily Missions: three exercises per day (push-ups, squats, pull-ups)
-- with deterministic random rep tiers per mission.

alter table public.daily_challenge_templates
  add column if not exists mission_index integer not null default 0
    check (mission_index >= 0 and mission_index < 3);

alter table public.daily_challenges
  add column if not exists mission_index integer not null default 0
    check (mission_index >= 0 and mission_index < 3);

alter table public.daily_challenge_templates
  drop constraint if exists daily_challenge_templates_challenge_date_key;

alter table public.daily_challenges
  drop constraint if exists daily_challenges_user_id_challenge_date_key;

alter table public.daily_challenge_templates
  drop constraint if exists daily_challenge_templates_date_mission_key;

alter table public.daily_challenges
  drop constraint if exists daily_challenges_user_date_mission_key;

alter table public.daily_challenge_templates
  add constraint daily_challenge_templates_date_mission_key
    unique (challenge_date, mission_index);

alter table public.daily_challenges
  add constraint daily_challenges_user_date_mission_key
    unique (user_id, challenge_date, mission_index);

create or replace function public.pick_daily_mission_tier(
  p_exercise public.exercise_type,
  p_tier_roll integer
)
returns table (
  target_reps integer,
  xp_reward integer
)
language plpgsql
immutable
as $$
begin
  if p_tier_roll < 0 or p_tier_roll > 3 then
    raise exception 'tier roll must be between 0 and 3';
  end if;

  case p_exercise
    when 'push_ups' then
      case p_tier_roll
        when 0 then return query select 5, 50;
        when 1 then return query select 10, 75;
        when 2 then return query select 15, 100;
        else return query select 20, 150;
      end case;
    when 'squats' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 75;
        when 2 then return query select 20, 100;
        else return query select 30, 150;
      end case;
    when 'pull_ups' then
      case p_tier_roll
        when 0 then return query select 3, 50;
        when 1 then return query select 5, 75;
        when 2 then return query select 8, 100;
        else return query select 10, 150;
      end case;
    else
      raise exception 'Unsupported exercise for daily missions: %', p_exercise;
  end case;
end;
$$;

create or replace function public.ensure_daily_mission_templates(
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_number bigint;
  v_mission_index integer;
  v_exercise public.exercise_type;
  v_tier_roll integer;
  v_target_reps integer;
  v_xp_reward integer;
  v_exercises public.exercise_type[] := array[
    'push_ups'::public.exercise_type,
    'squats'::public.exercise_type,
    'pull_ups'::public.exercise_type
  ];
begin
  v_day_number := (extract(epoch from p_date::timestamptz)::bigint / 86400)::bigint;

  for v_mission_index in 0..2 loop
    v_exercise := v_exercises[v_mission_index + 1];
    v_tier_roll := ((v_day_number + v_mission_index * 17) % 4)::integer;

    select tier.target_reps, tier.xp_reward
    into v_target_reps, v_xp_reward
    from public.pick_daily_mission_tier(v_exercise, v_tier_roll) as tier;

    insert into public.daily_challenge_templates (
      challenge_date,
      exercise_type,
      target_reps,
      xp_reward,
      mission_index,
      catalog_slot
    )
    values (
      p_date,
      v_exercise,
      v_target_reps,
      v_xp_reward,
      v_mission_index,
      null
    )
    on conflict (challenge_date, mission_index) do update
    set
      exercise_type = excluded.exercise_type,
      target_reps = excluded.target_reps,
      xp_reward = excluded.xp_reward;
  end loop;
end;
$$;

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
begin
  perform public.ensure_daily_mission_templates(p_date);

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = p_date
  order by mission_index
  limit 1;

  if not found then
    raise exception 'Failed to ensure daily mission templates for %', p_date;
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
    perform public.ensure_daily_mission_templates(current_date + v_offset);
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

-- Return type / signature changes require drop before recreate.
drop function if exists public.get_daily_challenge_home();
drop function if exists public.get_or_create_daily_challenge(integer);
drop function if exists public.get_or_create_daily_challenge();

create or replace function public.get_daily_challenge_home()
returns table (
  mission_index integer,
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  return query
  select
    t.mission_index,
    t.id,
    t.challenge_date,
    t.exercise_type,
    t.target_reps,
    t.xp_reward,
    t.catalog_slot,
    dc.id,
    dc.status,
    coalesce(dc.completed_reps, 0),
    dc.completed_at
  from public.daily_challenge_templates t
  left join public.daily_challenges dc
    on dc.user_id = v_user_id
    and dc.challenge_date = v_today
    and dc.mission_index = t.mission_index
  where t.challenge_date = v_today
  order by t.mission_index;
end;
$$;

create or replace function public.get_or_create_daily_challenge(
  p_mission_index integer default 0
)
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

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today
    and mission_index = p_mission_index;

  if found then
    return v_challenge;
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = v_today
    and mission_index = p_mission_index;

  if not found then
    raise exception 'Daily mission template not found';
  end if;

  insert into public.daily_challenges (
    user_id,
    exercise_type,
    target_reps,
    xp_reward,
    challenge_date,
    mission_index
  )
  values (
    v_user_id,
    v_template.exercise_type,
    v_template.target_reps,
    v_template.xp_reward,
    v_today,
    p_mission_index
  )
  on conflict (user_id, challenge_date, mission_index) do nothing
  returning * into v_challenge;

  if v_challenge.id is null then
    select *
    into v_challenge
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_today
      and mission_index = p_mission_index;
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
  v_yesterday_all_complete boolean;
  v_all_missions_complete boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
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
    completed_at = now()
  where id = p_challenge_id
  returning * into v_challenge;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  v_new_total_xp := v_new_total_xp + v_challenge.xp_reward;
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
    v_challenge.xp_reward,
    'daily_challenge',
    v_challenge.id::text
  );

  perform public.award_coins(v_user_id, 50);

  return v_challenge;
end;
$$;

revoke all on function public.pick_daily_mission_tier(public.exercise_type, integer) from public;
revoke all on function public.ensure_daily_mission_templates(date) from public;

grant execute on function public.pick_daily_mission_tier(public.exercise_type, integer) to authenticated;
grant execute on function public.ensure_daily_mission_templates(date) to authenticated;
grant execute on function public.get_daily_challenge_home() to authenticated;
grant execute on function public.get_or_create_daily_challenge(integer) to authenticated;
