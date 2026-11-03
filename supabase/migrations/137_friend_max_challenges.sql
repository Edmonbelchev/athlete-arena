-- Max effort friend challenges: instead of racing to a target, both players go for the most.
--   * Max reps: as many reps as possible in a set time (30 seconds to 10 minutes). The timer
--     starts with the first rep; when it runs out the attempt ends and the most reps wins.
--   * Max hold (plank): hold as long as you can - the attempt ends when form breaks. Uses the
--     plank hold flow (record_friend_hold_progress) with a 1 second minimum.
-- Rewards scale with the reps / seconds each player actually did.
-- Keep in sync with src/constants/friendChallenges.ts (FRIEND_CHALLENGE_MAX_DURATIONS).

alter table public.friend_challenges
  add column if not exists max_effort boolean not null default false;

-- Max reps windows go down to 30 seconds (race time caps still start at 1 minute).
alter table public.friend_challenges
  drop constraint if exists friend_challenges_time_limit_seconds_check;
alter table public.friend_challenges
  add constraint friend_challenges_time_limit_seconds_check
  check (time_limit_seconds is null or (time_limit_seconds >= 30 and time_limit_seconds <= 5400));

-- A max reps challenge always has its time window.
alter table public.friend_challenges
  drop constraint if exists friend_challenges_max_reps_window_check;
alter table public.friend_challenges
  add constraint friend_challenges_max_reps_window_check
  check (not max_effort or exercise_type = 'plank'::public.exercise_type or time_limit_seconds is not null);

-- "30 sec", "2 min", "1:30 min".
create or replace function public.format_challenge_duration(p_seconds integer)
returns text
language sql
immutable
as $$
  select case
    when p_seconds < 60 then p_seconds::text || ' sec'
    when p_seconds % 60 = 0 then (p_seconds / 60)::text || ' min'
    else (p_seconds / 60)::text || ':' || lpad((p_seconds % 60)::text, 2, '0') || ' min'
  end;
$$;

-- Create -------------------------------------------------------------------------------

drop function if exists public.create_friend_challenge(uuid, public.exercise_type, integer, text, integer, text);

create or replace function public.create_friend_challenge(
  p_friend_id uuid,
  p_exercise public.exercise_type,
  p_target_reps integer,
  p_message text default null,
  p_time_limit_seconds integer default null,
  p_emote_id text default null,
  p_max_effort boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge_id uuid;
  v_xp integer;
  v_participant_id uuid;
  v_is_hold boolean := p_exercise = 'plank'::public.exercise_type;
  v_max boolean := coalesce(p_max_effort, false);
  v_target integer;
  v_time_limit integer;
  v_title text;
  v_body text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_max then
    -- Nothing to reach: the most reps / longest hold wins. target_reps is the 1 rep / second
    -- needed to post a score.
    v_target := 1;
    if v_is_hold then
      v_time_limit := null;
    else
      if p_time_limit_seconds is null or p_time_limit_seconds < 30 or p_time_limit_seconds > 600 then
        raise exception 'Pick a time between 30 seconds and 10 minutes';
      end if;
      v_time_limit := p_time_limit_seconds;
    end if;
  else
    if p_target_reps < 1 or p_target_reps > 1000 then
      raise exception 'Target reps must be between 1 and 1000';
    end if;

    if p_time_limit_seconds is not null
       and (p_time_limit_seconds < 60 or p_time_limit_seconds > 5400) then
      raise exception 'Time limit must be between 60 and 5400 seconds';
    end if;

    v_target := p_target_reps;
    v_time_limit := p_time_limit_seconds;
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  if p_emote_id is not null then
    if not exists (
      select 1
      from public.user_inventory ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = v_user_id
        and ui.item_id = p_emote_id
        and si.item_type = 'emote'
    ) then
      raise exception 'Emote not owned';
    end if;
  end if;

  -- Max challenges show the reward at its full value.
  v_xp := public.calculate_friend_challenge_xp(
    p_exercise,
    case when v_max then public.friend_challenge_full_reward_reps(p_exercise) else v_target end
  );

  insert into public.friend_challenges (
    creator_id, exercise_type, target_reps, xp_reward, message, time_limit_seconds, creator_emote_id, max_effort
  )
  values (
    v_user_id, p_exercise, v_target, v_xp, nullif(trim(p_message), ''), v_time_limit, p_emote_id, v_max
  )
  returning id into v_challenge_id;

  insert into public.friend_challenge_participants (challenge_id, user_id, status)
  values
    (v_challenge_id, v_user_id, 'in_progress'),
    (v_challenge_id, p_friend_id, 'pending');

  select p.id
  into v_participant_id
  from public.friend_challenge_participants p
  where p.challenge_id = v_challenge_id
    and p.user_id = p_friend_id;

  if v_max and v_is_hold then
    v_title := 'New max challenge';
    v_body := ' challenged you to the longest ' || public.format_exercise_label(p_exercise);
  elsif v_max then
    v_title := 'New max challenge';
    v_body := ' challenged you to max ' || public.format_exercise_label(p_exercise)
      || ' in ' || public.format_challenge_duration(v_time_limit);
  else
    v_title := 'New speed race';
    v_body := ' challenged you to ' || v_target::text || ' ' || public.format_exercise_label(p_exercise);
  end if;

  perform public.enqueue_push_notification(
    p_friend_id,
    v_title,
    public.format_profile_short_name(v_user_id) || v_body,
    jsonb_build_object(
      'type', 'challenge_received',
      'challengeId', v_challenge_id,
      'participantId', v_participant_id,
      'url', '/(tabs)/friends'
    )
  );

  return v_challenge_id;
end;
$$;

grant execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text, integer, text, boolean) to authenticated;

-- Max reps progress ---------------------------------------------------------------------
-- Saves reps during a max reps attempt; `p_finish` (or the time running out) ends it. The
-- timer starts with the first rep. Reps arriving just after the window (network delay, up to
-- the grace period) still count; later ones are ignored.
create or replace function public.record_friend_max_reps(
  p_participant_id uuid,
  p_reps integer,
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
  v_deadline timestamptz;
  v_grace constant interval := interval '10 seconds';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_reps < 0 or p_reps > 5000 then
    raise exception 'Reps must be between 0 and 5000';
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
     or not v_challenge.max_effort
     or v_challenge.exercise_type = 'plank'::public.exercise_type
     or v_challenge.time_limit_seconds is null then
    raise exception 'Not a max reps challenge';
  end if;

  if v_participant.status = 'completed'::public.challenge_status then
    return v_participant;
  end if;

  if v_participant.status = 'pending'::public.challenge_status then
    raise exception 'Accept the challenge before starting';
  end if;

  if v_participant.status in ('expired'::public.challenge_status, 'declined'::public.challenge_status) then
    raise exception 'Challenge expired';
  end if;

  if v_participant.started_at is null then
    if p_reps < 1 then
      -- Nothing to save before the first rep starts the timer.
      return v_participant;
    end if;

    update public.friend_challenge_participants
    set started_at = now()
    where id = p_participant_id
    returning * into v_participant;
  end if;

  v_deadline := v_participant.started_at + make_interval(secs => v_challenge.time_limit_seconds);

  if now() <= v_deadline + v_grace and p_reps > v_participant.completed_reps then
    update public.friend_challenge_participants
    set completed_reps = p_reps
    where id = p_participant_id
    returning * into v_participant;

    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
  end if;

  if not p_finish and now() < v_deadline then
    return v_participant;
  end if;

  update public.friend_challenge_participants
  set
    status = 'completed'::public.challenge_status,
    completed_at = least(now(), v_deadline)
  where id = p_participant_id;

  perform public.resolve_friend_challenge_race(v_challenge.id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id;

  return v_participant;
end;
$$;

grant execute on function public.record_friend_max_reps(uuid, integer, boolean) to authenticated;

-- Speed race completion (same as 100): older app versions don't know max challenges and would
-- end one at its 1 rep minimum, so they are told to update instead.
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

  if v_participant.status = 'expired'::public.challenge_status then
    raise exception 'Challenge expired';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
    raise exception 'Use workout completion for this challenge';
  end if;

  if v_challenge.max_effort then
    raise exception 'Update the app to play max challenges';
  end if;

  if v_participant.status = 'completed'::public.challenge_status then
    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
    return v_participant;
  end if;

  if v_participant.status = 'pending'::public.challenge_status then
    raise exception 'Accept the challenge before completing reps';
  end if;

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

      perform public.credit_daily_mission_reps(
        v_challenge.exercise_type,
        'friend_challenge',
        p_participant_id::text,
        v_participant.completed_reps
      );
    end if;

    if p_completed_reps >= v_challenge.target_reps then
      update public.friend_challenge_participants
      set
        completed_reps = v_challenge.target_reps,
        status = 'completed'::public.challenge_status,
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

      perform public.credit_daily_mission_reps(
        v_challenge.exercise_type,
        'friend_challenge',
        p_participant_id::text,
        v_participant.completed_reps
      );
    end if;

    return v_participant;
  end if;

  update public.friend_challenge_participants
  set
    completed_reps = v_challenge.target_reps,
    status = 'completed'::public.challenge_status,
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id
  returning * into v_participant;

  v_new_reps := v_participant.completed_reps;
  v_delta := greatest(v_new_reps - v_previous_reps, 0);

  if v_delta > 0 then
    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
  end if;

  perform public.resolve_friend_challenge_race(v_challenge.id);

  return v_participant;
end;
$$;

-- Time running out ends a max reps attempt with the reps done (a speed race that runs out of
-- time is lost instead). Max attempts get the same grace as their last reps.
create or replace function public.expire_overdue_friend_challenges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_challenge_id uuid;
  v_max boolean;
  v_deadline timestamptz;
begin
  for v_participant_id, v_challenge_id, v_max, v_deadline in
    select
      p.id,
      p.challenge_id,
      fc.max_effort,
      p.started_at + make_interval(secs => fc.time_limit_seconds)
    from public.friend_challenge_participants p
    join public.friend_challenges fc on fc.id = p.challenge_id
    where p.user_id = p_user_id
      and p.status = 'in_progress'
      and p.started_at is not null
      and fc.time_limit_seconds is not null
      and p.started_at + make_interval(secs => fc.time_limit_seconds)
        + case when fc.max_effort then interval '10 seconds' else interval '0 seconds' end < now()
  loop
    if v_max then
      update public.friend_challenge_participants
      set status = 'completed'::public.challenge_status, completed_at = v_deadline
      where id = v_participant_id;
    else
      update public.friend_challenge_participants
      set status = 'expired'::public.challenge_status
      where id = v_participant_id;
    end if;

    perform public.resolve_friend_challenge_race(v_challenge_id);
  end loop;

  perform public.expire_stale_friend_challenges(p_user_id);
end;
$$;

revoke all on function public.expire_overdue_friend_challenges(uuid) from public;

-- Rewards and the winner ------------------------------------------------------------------

-- Max challenges pay for the reps / seconds actually done (speed races for the target).
create or replace function public.friend_challenge_reward_reps(
  p_challenge public.friend_challenges,
  p_participant public.friend_challenge_participants
)
returns integer
language sql
immutable
as $$
  select case
    when p_challenge.challenge_kind = 'workout'::public.friend_challenge_kind
      then coalesce(p_participant.workout_total_reps, 0)
    when p_challenge.max_effort
      then coalesce(p_participant.completed_reps, 0)
    else p_challenge.target_reps
  end;
$$;

revoke all on function public.friend_challenge_reward_reps(public.friend_challenges, public.friend_challenge_participants) from public;

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

  -- The best finisher so far: longest plank hold or most reps in a max challenge, fastest
  -- exercise race, or first workout finisher.
  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_first
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.status = 'completed'::public.challenge_status
  order by
    case
      when v_challenge.exercise_type = 'plank'::public.exercise_type or v_challenge.max_effort
        then p.completed_reps
    end desc nulls last,
    case
      when v_challenge.challenge_kind = 'exercise'::public.friend_challenge_kind
        and not v_challenge.max_effort
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
    elsif v_challenge.exercise_type = 'plank'::public.exercise_type or v_challenge.max_effort then
      -- Holds and max challenges: the longest hold / most reps wins.
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

revoke all on function public.resolve_friend_challenge_race(uuid) from public;

-- Challenge lists and detail: same as 079 plus max_effort ----------------------------------

drop function if exists public.get_my_friend_challenges();
drop function if exists public.get_friend_challenge_detail(uuid);
drop function if exists public.get_friend_challenges_with_user(uuid);

create or replace function public.get_my_friend_challenges()
returns table (
  participant_id uuid,
  challenge_id uuid,
  challenge_kind public.friend_challenge_kind,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  message text,
  time_limit_seconds integer,
  deadline_at timestamptz,
  status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  started_at timestamptz,
  xp_earned integer,
  coins_earned integer,
  elapsed_seconds integer,
  completed_rounds integer,
  workout_total_reps integer,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer,
  opponent_completed_at timestamptz,
  opponent_started_at timestamptz,
  opponent_elapsed_seconds integer,
  opponent_completed_rounds integer,
  opponent_workout_total_reps integer,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text,
  template_id uuid,
  catalog_workout_id uuid,
  workout_title text,
  workout_type public.custom_workout_type,
  structure_config jsonb,
  workout_exercises jsonb,
  max_effort boolean
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

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.challenge_kind,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    fc.time_limit_seconds,
    fc.deadline_at,
    mine.status,
    mine.completed_reps,
    mine.completed_at,
    mine.started_at,
    mine.xp_earned,
    mine.coins_earned,
    mine.elapsed_seconds,
    mine.completed_rounds,
    mine.workout_total_reps,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps,
    opponent.completed_at as opponent_completed_at,
    opponent.started_at as opponent_started_at,
    opponent.elapsed_seconds as opponent_elapsed_seconds,
    opponent.completed_rounds as opponent_completed_rounds,
    opponent.workout_total_reps as opponent_workout_total_reps,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji,
    fc.template_id,
    fc.catalog_workout_id,
    fc.workout_title,
    fc.workout_type,
    fc.structure_config,
    fc.workout_exercises,
    fc.max_effort
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.user_id = v_user_id
  order by fc.created_at desc;
end;
$$;

create or replace function public.get_friend_challenge_detail(p_participant_id uuid)
returns table (
  participant_id uuid,
  challenge_id uuid,
  challenge_kind public.friend_challenge_kind,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  message text,
  time_limit_seconds integer,
  deadline_at timestamptz,
  status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  started_at timestamptz,
  xp_earned integer,
  coins_earned integer,
  elapsed_seconds integer,
  completed_rounds integer,
  workout_total_reps integer,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer,
  opponent_completed_at timestamptz,
  opponent_started_at timestamptz,
  opponent_elapsed_seconds integer,
  opponent_completed_rounds integer,
  opponent_workout_total_reps integer,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text,
  template_id uuid,
  catalog_workout_id uuid,
  workout_title text,
  workout_type public.custom_workout_type,
  structure_config jsonb,
  workout_exercises jsonb,
  max_effort boolean
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

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.challenge_kind,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    fc.time_limit_seconds,
    fc.deadline_at,
    mine.status,
    mine.completed_reps,
    mine.completed_at,
    mine.started_at,
    mine.xp_earned,
    mine.coins_earned,
    mine.elapsed_seconds,
    mine.completed_rounds,
    mine.workout_total_reps,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps,
    opponent.completed_at as opponent_completed_at,
    opponent.started_at as opponent_started_at,
    opponent.elapsed_seconds as opponent_elapsed_seconds,
    opponent.completed_rounds as opponent_completed_rounds,
    opponent.workout_total_reps as opponent_workout_total_reps,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji,
    fc.template_id,
    fc.catalog_workout_id,
    fc.workout_title,
    fc.workout_type,
    fc.structure_config,
    fc.workout_exercises,
    fc.max_effort
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.id = p_participant_id
    and mine.user_id = v_user_id;
end;
$$;

create or replace function public.get_friend_challenges_with_user(p_friend_id uuid)
returns table (
  participant_id uuid,
  challenge_id uuid,
  challenge_kind public.friend_challenge_kind,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  message text,
  time_limit_seconds integer,
  deadline_at timestamptz,
  status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  started_at timestamptz,
  xp_earned integer,
  coins_earned integer,
  elapsed_seconds integer,
  completed_rounds integer,
  workout_total_reps integer,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer,
  opponent_completed_at timestamptz,
  opponent_started_at timestamptz,
  opponent_elapsed_seconds integer,
  opponent_completed_rounds integer,
  opponent_workout_total_reps integer,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text,
  template_id uuid,
  catalog_workout_id uuid,
  workout_title text,
  workout_type public.custom_workout_type,
  structure_config jsonb,
  workout_exercises jsonb,
  max_effort boolean
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

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'Not friends';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.challenge_kind,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    fc.time_limit_seconds,
    fc.deadline_at,
    mine.status,
    mine.completed_reps,
    mine.completed_at,
    mine.started_at,
    mine.xp_earned,
    mine.coins_earned,
    mine.elapsed_seconds,
    mine.completed_rounds,
    mine.workout_total_reps,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps,
    opponent.completed_at as opponent_completed_at,
    opponent.started_at as opponent_started_at,
    opponent.elapsed_seconds as opponent_elapsed_seconds,
    opponent.completed_rounds as opponent_completed_rounds,
    opponent.workout_total_reps as opponent_workout_total_reps,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji,
    fc.template_id,
    fc.catalog_workout_id,
    fc.workout_title,
    fc.workout_type,
    fc.structure_config,
    fc.workout_exercises,
    fc.max_effort
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.user_id = v_user_id
    and opponent.user_id = p_friend_id
  order by fc.created_at desc;
end;
$$;

grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.get_friend_challenge_detail(uuid) to authenticated;
grant execute on function public.get_friend_challenges_with_user(uuid) to authenticated;

-- Activity history: same as 125 plus max_effort -------------------------------------------

drop function if exists public.get_activity_history(text, integer, integer);

create or replace function public.get_activity_history(
  p_filter text default 'all',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  entry_id uuid,
  category text,
  kind text,
  exercise_type public.exercise_type,
  target_reps integer,
  completed_reps integer,
  xp_reward integer,
  status public.challenge_status,
  result_at timestamptz,
  opponent_username text,
  opponent_display_name text,
  opponent_completed_reps integer,
  opponent_status public.challenge_status,
  race_seconds integer,
  opponent_race_seconds integer,
  winner_user_id uuid,
  xp_earned integer,
  friend_challenge_kind text,
  workout_title text,
  workout_type public.custom_workout_type,
  completed_rounds integer,
  opponent_completed_rounds integer,
  total_reps integer,
  elapsed_seconds integer,
  time_limit_seconds integer,
  coins_earned integer,
  workout_session_id uuid,
  workout_session_xp integer,
  workout_session_coins integer,
  max_effort boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_filter text := lower(trim(coalesce(p_filter, 'all')));
  v_daily_workout_coins constant integer := 125;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_filter not in ('all', 'quests', 'friend_challenges', 'friend_workouts', 'workouts') then
    raise exception 'Invalid activity history filter';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  with combined as (
    select
      dc.id as entry_id,
      'daily_quest'::text as category,
      'daily'::text as kind,
      dc.exercise_type,
      dc.target_reps,
      dc.completed_reps,
      dc.xp_reward,
      dc.status,
      coalesce(dc.completed_at, dc.challenge_date::timestamptz) as result_at,
      null::text as opponent_username,
      null::text as opponent_display_name,
      null::integer as opponent_completed_reps,
      null::public.challenge_status as opponent_status,
      null::integer as race_seconds,
      null::integer as opponent_race_seconds,
      null::uuid as winner_user_id,
      null::integer as xp_earned,
      null::text as friend_challenge_kind,
      null::text as workout_title,
      null::public.custom_workout_type as workout_type,
      null::integer as completed_rounds,
      null::integer as opponent_completed_rounds,
      null::integer as total_reps,
      null::integer as elapsed_seconds,
      null::integer as time_limit_seconds,
      null::integer as coins_earned,
      null::uuid as workout_session_id,
      null::integer as workout_session_xp,
      null::integer as workout_session_coins,
      false as max_effort
    from public.daily_challenges dc
    where dc.user_id = v_user_id
      and (
        dc.status = 'completed'
        or dc.challenge_date < current_date
      )

    union all

    select
      mine.id as entry_id,
      case
        when fc.challenge_kind = 'workout'::public.friend_challenge_kind then 'friend_workout'
        else 'friend_exercise'
      end as category,
      'friend'::text as kind,
      fc.exercise_type,
      fc.target_reps,
      mine.completed_reps,
      fc.xp_reward,
      mine.status,
      coalesce(mine.completed_at, fc.resolved_at, fc.created_at) as result_at,
      opponent_profile.username as opponent_username,
      opponent_profile.display_name as opponent_display_name,
      opponent.completed_reps as opponent_completed_reps,
      opponent.status as opponent_status,
      coalesce(
        case
          when fc.challenge_kind = 'workout'::public.friend_challenge_kind
            and fc.workout_type = 'for_time'::public.custom_workout_type
            then mine.elapsed_seconds
          else null
        end,
        public.participant_race_seconds(mine.started_at, mine.completed_at)
      ) as race_seconds,
      coalesce(
        case
          when fc.challenge_kind = 'workout'::public.friend_challenge_kind
            and fc.workout_type = 'for_time'::public.custom_workout_type
            then opponent.elapsed_seconds
          else null
        end,
        public.participant_race_seconds(opponent.started_at, opponent.completed_at)
      ) as opponent_race_seconds,
      fc.winner_user_id,
      mine.xp_earned,
      fc.challenge_kind::text as friend_challenge_kind,
      fc.workout_title,
      fc.workout_type,
      mine.completed_rounds,
      opponent.completed_rounds as opponent_completed_rounds,
      mine.workout_total_reps as total_reps,
      mine.elapsed_seconds,
      fc.time_limit_seconds,
      mine.coins_earned,
      linked_session.id as workout_session_id,
      linked_session.session_xp as workout_session_xp,
      linked_session.coins_earned as workout_session_coins,
      fc.max_effort
    from public.friend_challenge_participants mine
    join public.friend_challenges fc on fc.id = mine.challenge_id
    join public.friend_challenge_participants opponent
      on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
    join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
    left join lateral (
      select
        s.id,
        s.coins_earned,
        (
          select e.amount
          from public.xp_events e
          where e.user_id = v_user_id
            and e.source_type = 'workout_session'
            and e.source_id = s.id::text
          order by e.created_at desc
          limit 1
        ) as session_xp
      from public.custom_workout_sessions s
      where s.friend_challenge_participant_id = mine.id
        and s.user_id = v_user_id
      order by s.completed_at desc
      limit 1
    ) linked_session on true
    where mine.user_id = v_user_id
      and mine.status in ('completed', 'expired', 'declined')

    union all

    select
      s.id as entry_id,
      'solo_workout'::text as category,
      'workout'::text as kind,
      null::public.exercise_type as exercise_type,
      null::integer as target_reps,
      s.total_reps as completed_reps,
      0 as xp_reward,
      'completed'::public.challenge_status as status,
      s.completed_at as result_at,
      null::text as opponent_username,
      null::text as opponent_display_name,
      null::integer as opponent_completed_reps,
      null::public.challenge_status as opponent_status,
      s.elapsed_seconds as race_seconds,
      null::integer as opponent_race_seconds,
      null::uuid as winner_user_id,
      coalesce(session_xp.amount, legacy_daily_xp.amount) as xp_earned,
      null::text as friend_challenge_kind,
      s.title as workout_title,
      coalesce(wc.workout_type, t.workout_type, 'amrap'::public.custom_workout_type) as workout_type,
      s.completed_rounds,
      null::integer as opponent_completed_rounds,
      s.total_reps,
      s.elapsed_seconds,
      s.time_limit_seconds,
      coalesce(
        s.coins_earned,
        case
          when legacy_daily_xp.amount is not null then v_daily_workout_coins
          else null
        end
      ) as coins_earned,
      s.id as workout_session_id,
      null::integer as workout_session_xp,
      null::integer as workout_session_coins,
      false as max_effort
    from public.custom_workout_sessions s
    left join public.workout_catalog wc on wc.id = s.catalog_workout_id
    left join public.custom_workout_templates t on t.id = s.template_id
    left join lateral (
      select e.amount
      from public.xp_events e
      where e.user_id = v_user_id
        and e.source_type = 'workout_session'
        and e.source_id = s.id::text
      order by e.created_at desc
      limit 1
    ) session_xp on true
    left join lateral (
      select e.amount
      from public.xp_events e
      where e.user_id = v_user_id
        and e.source_type = 'daily_workout'
        and e.source_id = s.id::text
      order by e.created_at desc
      limit 1
    ) legacy_daily_xp on true
    where s.user_id = v_user_id
      -- Runs done for a friend challenge are shown on the challenge entry instead.
      and s.friend_challenge_participant_id is null
  )
  select *
  from combined c
  where
    v_filter = 'all'
    or (v_filter = 'quests' and c.category = 'daily_quest' and c.status = 'completed'::public.challenge_status)
    or (v_filter = 'friend_challenges' and c.category = 'friend_exercise')
    or (v_filter = 'friend_workouts' and c.category = 'friend_workout')
    or (v_filter = 'workouts' and c.category = 'solo_workout')
  -- entry_id breaks ties (e.g. challenges expired together) so offset pages never overlap.
  order by c.result_at desc, c.category, c.entry_id
  limit v_limit
  offset v_offset;
end;
$$;

grant execute on function public.get_activity_history(text, integer, integer) to authenticated;
