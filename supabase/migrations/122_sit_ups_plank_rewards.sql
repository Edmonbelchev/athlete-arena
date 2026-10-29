-- Sit-ups and plank: daily quests (sit-ups only), rewards, movement stats, and plank
-- hold challenges where the longest hold wins. Plank seconds live in *_reps columns.
-- workout_xp_per_rep and format_exercise_label already cover both through their else branches.

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
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'squats' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'pull_ups' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'burpees' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'half_burpees' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'jumping_jacks' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'jumping_squats' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'lunges' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'sit_ups' then
      case p_tier_roll
        when 0 then return query select 15, 50;
        when 1 then return query select 20, 50;
        when 2 then return query select 25, 50;
        else return query select 30, 50;
      end case;
    else
      raise exception 'Unsupported exercise for daily missions: %', p_exercise;
  end case;
end;
$$;

create or replace function public.calculate_daily_mission_coins(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_reps integer := greatest(coalesce(p_reps, 0), 0);
  v_coins integer;
begin
  case p_exercise
    when 'push_ups' then
      v_coins := v_reps / 5;
    when 'squats' then
      v_coins := v_reps / 10;
    when 'pull_ups' then
      v_coins := v_reps / 3;
    when 'burpees' then
      v_coins := v_reps / 4;
    when 'half_burpees' then
      v_coins := v_reps / 4;
    when 'jumping_jacks' then
      v_coins := v_reps / 10;
    when 'jumping_squats' then
      v_coins := v_reps / 10;
    when 'lunges' then
      v_coins := v_reps / 10;
    when 'sit_ups' then
      v_coins := v_reps / 6;
    else
      raise exception 'Unsupported exercise for daily mission coins: %', p_exercise;
  end case;

  return least(v_coins, 50);
end;
$$;

create or replace function public.reroll_daily_mission(
  p_mission_index integer,
  p_exercise public.exercise_type
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_day_number bigint;
  v_tier_roll integer;
  v_target_reps integer;
  v_template public.daily_challenge_templates;
  v_challenge public.daily_challenges;
  v_current_exercises public.exercise_type[];
  v_reroll_used_on date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  if p_exercise not in (
    'push_ups',
    'squats',
    'pull_ups',
    'burpees',
    'half_burpees',
    'jumping_jacks',
    'jumping_squats',
    'lunges',
    'sit_ups'
  ) then
    raise exception 'Exercise cannot be used for daily quests';
  end if;

  select daily_quest_reroll_used_on
  into v_reroll_used_on
  from public.profiles
  where id = v_user_id;

  if v_reroll_used_on = v_today then
    raise exception 'Daily quest re-roll already used today';
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  v_current_exercises := public.get_user_daily_mission_exercises(v_user_id, v_today);

  if p_exercise = any (v_current_exercises) then
    raise exception 'Exercise is already part of today''s quests';
  end if;

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = v_today
    and mission_index = p_mission_index;

  if not found then
    raise exception 'Daily mission template not found';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today
    and mission_index = p_mission_index
  for update;

  if found then
    if v_challenge.status = 'completed' then
      raise exception 'Cannot re-roll a completed quest';
    end if;

    if v_challenge.completed_reps > 0 then
      raise exception 'Cannot re-roll a quest with progress';
    end if;
  end if;

  v_day_number := (extract(epoch from v_today::timestamptz)::bigint / 86400)::bigint;
  v_tier_roll := ((v_day_number + p_mission_index * 17) % 4)::integer;

  select tier.target_reps
  into v_target_reps
  from public.pick_daily_mission_tier(p_exercise, v_tier_roll) as tier;

  if v_challenge.id is null then
    insert into public.daily_challenges (
      user_id,
      exercise_type,
      target_reps,
      xp_reward,
      challenge_date,
      mission_index,
      is_rerolled
    )
    values (
      v_user_id,
      p_exercise,
      v_target_reps,
      50,
      v_today,
      p_mission_index,
      true
    )
    returning * into v_challenge;
  else
    update public.daily_challenges
    set
      exercise_type = p_exercise,
      target_reps = v_target_reps,
      xp_reward = 50,
      completed_reps = 0,
      status = 'pending',
      completed_at = null,
      is_rerolled = true
    where id = v_challenge.id
    returning * into v_challenge;
  end if;

  update public.profiles
  set daily_quest_reroll_used_on = v_today
  where id = v_user_id;

  return v_challenge;
end;
$$;

drop function if exists public.get_user_movement_stats();

create or replace function public.get_user_movement_stats()
returns table (
  total_push_ups bigint,
  total_squats bigint,
  total_pull_ups bigint,
  total_dips bigint,
  total_burpees bigint,
  total_half_burpees bigint,
  total_jumping_jacks bigint,
  total_jumping_squats bigint,
  total_lunges bigint,
  total_sit_ups bigint,
  total_plank_seconds bigint,
  daily_missions_completed bigint,
  friend_races_completed bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'push_ups'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'push_ups'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'push_ups') as total_push_ups,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'squats'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'squats'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'squats') as total_squats,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'pull_ups'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'pull_ups'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'pull_ups') as total_pull_ups,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'dips'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'dips'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'dips') as total_dips,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'burpees'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'burpees'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'burpees') as total_burpees,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'half_burpees'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'half_burpees'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'half_burpees') as total_half_burpees,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'jumping_jacks'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'jumping_jacks'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'jumping_jacks') as total_jumping_jacks,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'jumping_squats'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'jumping_squats'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'jumping_squats') as total_jumping_squats,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'lunges'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'lunges'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'lunges') as total_lunges,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'sit_ups'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'sit_ups'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'sit_ups') as total_sit_ups,

    (
      select coalesce(sum(dc.completed_reps), 0)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
        and dc.exercise_type = 'plank'
    )
    +
    (
      select coalesce(sum(fcp.completed_reps), 0)
      from public.friend_challenge_participants fcp
      join public.friend_challenges fc on fc.id = fcp.challenge_id
      where fcp.user_id = v_user_id
        and fc.exercise_type = 'plank'
        and fcp.completed_reps > 0
    )
    + public.get_user_workout_exercise_reps(v_user_id, 'plank') as total_plank_seconds,

    (
      select count(*)
      from public.daily_challenges dc
      where dc.user_id = v_user_id
        and dc.status = 'completed'
    ) as daily_missions_completed,

    (
      select count(*)
      from public.friend_challenge_participants fcp
      where fcp.user_id = v_user_id
        and fcp.status = 'completed'
    ) as friend_races_completed;
end;
$$;

grant execute on function public.get_user_movement_stats() to authenticated;

-- Friend challenge rewards reach full value at 30 sit-ups / a 60 second plank.
create or replace function public.friend_challenge_full_reward_reps(p_exercise public.exercise_type)
returns integer
language sql
immutable
as $$
  select case p_exercise::text
    when 'push_ups' then 30
    when 'squats' then 50
    when 'pull_ups' then 15
    when 'burpees' then 20
    when 'half_burpees' then 25
    when 'jumping_jacks' then 60
    when 'jumping_squats' then 40
    when 'lunges' then 50
    when 'sit_ups' then 30
    when 'plank' then 60
    else 50
  end;
$$;

-- Hold challenges (plank) -----------------------------------------------------------
-- Seconds held are stored in completed_reps. Progress keeps growing past the minimum
-- (target_reps); the attempt ends when the player finishes, and the longest hold wins.
create or replace function public.record_friend_hold_progress(
  p_participant_id uuid,
  p_held_seconds integer,
  p_finish boolean default false
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_held_seconds < 0 or p_held_seconds > 3600 then
    raise exception 'Hold time must be between 0 and 3600 seconds';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  if v_challenge.challenge_kind <> 'exercise'::public.friend_challenge_kind
     or v_challenge.exercise_type is distinct from 'plank'::public.exercise_type then
    raise exception 'Not a hold challenge';
  end if;

  if v_participant.status = 'completed'::public.challenge_status then
    return v_participant;
  end if;

  if v_participant.status = 'pending'::public.challenge_status then
    raise exception 'Accept the challenge before holding';
  end if;

  if v_participant.status in ('expired'::public.challenge_status, 'declined'::public.challenge_status) then
    raise exception 'Challenge expired';
  end if;

  update public.friend_challenge_participants
  set
    started_at = coalesce(
      started_at,
      case when p_held_seconds > 0 then now() - make_interval(secs => p_held_seconds) end
    ),
    completed_reps = greatest(completed_reps, p_held_seconds)
  where id = p_participant_id
  returning * into v_participant;

  if not p_finish then
    return v_participant;
  end if;

  if v_participant.completed_reps < v_challenge.target_reps then
    raise exception 'Hold at least % seconds to finish', v_challenge.target_reps;
  end if;

  update public.friend_challenge_participants
  set
    status = 'completed'::public.challenge_status,
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id;

  perform public.resolve_friend_challenge_race(v_challenge.id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id;

  return v_participant;
end;
$$;

grant execute on function public.record_friend_hold_progress(uuid, integer, boolean) to authenticated;

create or replace function public.resolve_friend_challenge_race(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.friend_challenges;
  v_participant record;
  v_first record;
  v_opponent record;
  v_compare integer;
begin
  select * into v_challenge
  from public.friend_challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.resolved_at is not null then
    return;
  end if;

  -- Everyone who finished gets the finish reward straight away.
  for v_participant in
    select p.id from public.friend_challenge_participants p
    where p.challenge_id = p_challenge_id
      and p.status = 'completed'::public.challenge_status
  loop
    perform public.pay_friend_challenge_reward(v_participant.id, 'finish');
  end loop;

  -- The best finisher so far: longest plank hold, fastest exercise race, or first workout finisher.
  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_first
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.status = 'completed'::public.challenge_status
  order by
    case when v_challenge.exercise_type = 'plank'::public.exercise_type then p.completed_reps end desc nulls last,
    case
      when v_challenge.challenge_kind = 'exercise'::public.friend_challenge_kind
        then public.participant_race_seconds(p.started_at, p.completed_at)
    end asc nulls last,
    p.completed_at asc nulls last
  limit 1;

  if not found then
    return;
  end if;

  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_opponent
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.id <> v_first.id;

  if v_opponent.status = 'completed'::public.challenge_status then
    if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
      -- > 0 means the opponent did better.
      v_compare := public.compare_friend_workout_results(
        v_first.completed_rounds,
        v_first.workout_total_reps,
        v_first.elapsed_seconds,
        v_opponent.completed_rounds,
        v_opponent.workout_total_reps,
        v_opponent.elapsed_seconds,
        v_challenge.workout_type
      );
    elsif v_challenge.exercise_type = 'plank'::public.exercise_type then
      -- Holds: the longest hold wins.
      v_compare := sign(v_opponent.completed_reps - v_first.completed_reps)::integer;
    elsif v_first.race_seconds is not null
          and v_opponent.race_seconds is not null
          and v_opponent.race_seconds = v_first.race_seconds then
      v_compare := 0;
    else
      v_compare := -1;
    end if;

    update public.friend_challenges
    set
      resolved_at = now(),
      winner_user_id = case
        when v_compare > 0 then v_opponent.user_id
        when v_compare < 0 then v_first.user_id
        else null
      end
    where id = p_challenge_id;

    if v_compare >= 0 then
      perform public.pay_friend_challenge_reward(v_opponent.id, 'win');
    end if;
    if v_compare <= 0 then
      perform public.pay_friend_challenge_reward(v_first.id, 'win');
    end if;

    return;
  end if;

  if v_opponent.status in ('expired'::public.challenge_status, 'declined'::public.challenge_status) then
    update public.friend_challenges
    set winner_user_id = v_first.user_id, resolved_at = now()
    where id = p_challenge_id;

    -- Running out of the attempt timer is a lost race; declining or never
    -- finishing within 7 days is a no-show.
    if v_opponent.status = 'declined'::public.challenge_status
       or v_challenge.stale_expired_at is not null then
      perform public.pay_friend_challenge_reward(v_first.id, 'no_show');
    else
      perform public.pay_friend_challenge_reward(v_first.id, 'win');
    end if;
  end if;
end;
$$;

-- Workout XP for holds: one XP per 5 plank seconds (sync PLANK_SECONDS_PER_XP in
-- src/constants/workoutXp.ts). Long holds are easy to sustain, so a second earns far less
-- than a rep; a 10-minute plank is worth 120 raw XP, not 600.
create or replace function public.sum_workout_rep_xp_from_breakdown(
  p_breakdown jsonb,
  p_use_target_reps boolean default false
)
returns integer
language plpgsql
immutable
as $$
declare
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_reps integer;
  v_total integer := 0;
begin
  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    if p_use_target_reps then
      v_reps := coalesce((v_entry ->> 'target_reps')::integer, 0);
    else
      v_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);
    end if;

    if v_exercise is not null and v_reps > 0 then
      if v_exercise = 'plank'::public.exercise_type then
        v_total := v_total + v_reps / 5;
      else
        v_total := v_total + v_reps * public.workout_xp_per_rep(v_exercise);
      end if;
    end if;
  end loop;

  return v_total;
end;
$$;

-- For Time par is 3 seconds per required rep; a hold second only takes one second of par.
create or replace function public.sum_workout_required_reps_from_breakdown(p_breakdown jsonb)
returns integer
language plpgsql
immutable
as $$
declare
  v_entry jsonb;
  v_reps integer;
  v_total integer := 0;
begin
  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_breakdown, '[]'::jsonb))
  loop
    v_reps := coalesce((v_entry ->> 'target_reps')::integer, 0);
    if v_reps > 0 then
      if (v_entry ->> 'exercise_type') = 'plank' then
        v_total := v_total + ceil(v_reps / 3.0)::integer;
      else
        v_total := v_total + v_reps;
      end if;
    end if;
  end loop;

  return v_total;
end;
$$;
