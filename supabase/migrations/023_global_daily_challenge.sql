-- One shared daily challenge definition for all players (per calendar date).
-- Per-user progress still lives in daily_challenges.

create table if not exists public.daily_challenge_templates (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  exercise_type public.exercise_type not null,
  target_reps integer not null check (target_reps > 0),
  xp_reward integer not null check (xp_reward > 0),
  created_at timestamptz not null default now()
);

alter table public.daily_challenge_templates enable row level security;

drop policy if exists "Authenticated users can read daily challenge templates" on public.daily_challenge_templates;
create policy "Authenticated users can read daily challenge templates"
  on public.daily_challenge_templates
  for select
  to authenticated
  using (true);

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
  v_exercise_index integer;
  v_tier_roll integer;
  v_exercise public.exercise_type;
  v_target_reps integer;
  v_xp_reward integer;
begin
  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = p_date;

  if found then
    return v_template;
  end if;

  -- Deterministic pick from date so every player gets the same challenge.
  v_day_number := (extract(epoch from p_date::timestamptz)::bigint / 86400)::bigint;
  v_exercise_index := (v_day_number % 4)::integer;
  v_tier_roll := ((v_day_number / 4) % 4)::integer;

  case v_exercise_index
    when 0 then v_exercise := 'push_ups';
    when 1 then v_exercise := 'squats';
    when 2 then v_exercise := 'pull_ups';
    else v_exercise := 'dips';
  end case;

  case v_exercise
    when 'push_ups' then
      case v_tier_roll
        when 0 then v_target_reps := 5; v_xp_reward := 50;
        when 1 then v_target_reps := 10; v_xp_reward := 75;
        when 2 then v_target_reps := 15; v_xp_reward := 100;
        else v_target_reps := 20; v_xp_reward := 150;
      end case;
    when 'squats' then
      case v_tier_roll
        when 0 then v_target_reps := 10; v_xp_reward := 50;
        when 1 then v_target_reps := 15; v_xp_reward := 75;
        when 2 then v_target_reps := 20; v_xp_reward := 100;
        else v_target_reps := 30; v_xp_reward := 150;
      end case;
    when 'pull_ups' then
      case v_tier_roll
        when 0 then v_target_reps := 3; v_xp_reward := 50;
        when 1 then v_target_reps := 5; v_xp_reward := 75;
        when 2 then v_target_reps := 8; v_xp_reward := 100;
        else v_target_reps := 10; v_xp_reward := 150;
      end case;
    else
      case v_tier_roll
        when 0 then v_target_reps := 5; v_xp_reward := 50;
        when 1 then v_target_reps := 8; v_xp_reward := 75;
        when 2 then v_target_reps := 10; v_xp_reward := 100;
        else v_target_reps := 15; v_xp_reward := 150;
      end case;
  end case;

  insert into public.daily_challenge_templates (
    challenge_date,
    exercise_type,
    target_reps,
    xp_reward
  )
  values (
    p_date,
    v_exercise,
    v_target_reps,
    v_xp_reward
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

revoke all on function public.ensure_daily_challenge_template(date) from public;
grant execute on function public.ensure_daily_challenge_template(date) to authenticated;
