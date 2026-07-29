-- Challenge generation, completion, XP, and streak logic.
-- Server-side only - client cannot pick rewards or regenerate challenges.

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
returns table (
  target_reps integer,
  xp_reward integer
)
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

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today;

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
    user_id,
    exercise_type,
    target_reps,
    xp_reward,
    challenge_date
  )
  values (
    v_user_id,
    v_exercise,
    v_target_reps,
    v_xp_reward,
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

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id
    and user_id = v_user_id
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

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id
    and user_id = v_user_id
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
    select 1
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed'
  )
  into v_yesterday_completed;

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
