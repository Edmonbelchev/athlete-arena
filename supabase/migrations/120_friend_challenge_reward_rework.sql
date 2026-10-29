-- Friend challenge reward rework.
--
-- Every challenge now pays in three parts:
--   finish  - paid as soon as you complete it
--   win     - bonus for winning the head-to-head (both get it on a tie)
--   no-show - smaller bonus when you finished but your friend declined or
--             let the challenge expire
--
--                       finish       win          no-show
--   exercise (max)      50 XP 30c    +35 XP +20c  +20 XP +10c
--   workout  (max)      100 XP 60c   +70 XP +40c  +40 XP +20c
--
-- To stop farming with tiny challenges, every part scales with reps:
-- exercise challenges reach the full amount at a per-exercise target
-- (e.g. 30 push-ups), workouts at 100 total reps done. Fewer reps pay
-- proportionally less (rounded down).
--
-- Challenges also expire 7 days after they were sent: anyone who has not
-- finished by then is marked expired.

alter table public.friend_challenges
  add column if not exists stale_expired_at timestamptz;

alter table public.friend_challenge_participants
  add column if not exists participation_awarded boolean not null default false;

-- Rewards already paid under the old model must not be paid again.
update public.friend_challenge_participants p
set participation_awarded = true
where coalesce(p.xp_earned, 0) > 0
   or coalesce(p.coins_earned, 0) > 0
   or exists (
     select 1 from public.friend_challenges fc
     where fc.id = p.challenge_id and fc.resolved_at is not null
   );

-- Reward amounts ------------------------------------------------------------------

-- Workout base amounts (also used for friend_challenges.xp_reward on workouts).
create or replace function public.friend_challenge_participation_xp()
returns integer language sql immutable as $$ select 100; $$;

create or replace function public.friend_challenge_participation_coins()
returns integer language sql immutable as $$ select 60; $$;

create or replace function public.friend_challenge_winner_bonus_xp()
returns integer language sql immutable as $$ select 70; $$;

create or replace function public.friend_challenge_winner_bonus_coins()
returns integer language sql immutable as $$ select 40; $$;

-- Reps at which an exercise challenge pays its full reward.
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
    else 50
  end;
$$;

-- One reward part for a challenge, scaled by reps.
-- p_part: 'finish' | 'win' | 'no_show'; p_reward: 'xp' | 'coins'.
-- p_reps: target reps for exercise challenges, reps done for workouts.
create or replace function public.friend_challenge_reward(
  p_kind public.friend_challenge_kind,
  p_exercise public.exercise_type,
  p_reps integer,
  p_part text,
  p_reward text
)
returns integer
language plpgsql
immutable
as $$
declare
  v_is_workout boolean := p_kind = 'workout'::public.friend_challenge_kind;
  v_full_reps integer;
  v_base integer;
begin
  v_full_reps := case
    when v_is_workout then 100
    else public.friend_challenge_full_reward_reps(p_exercise)
  end;

  v_base := case p_part || ':' || p_reward
    when 'finish:xp' then 50
    when 'finish:coins' then 30
    when 'win:xp' then 35
    when 'win:coins' then 20
    when 'no_show:xp' then 20
    when 'no_show:coins' then 10
    else 0
  end;

  if v_is_workout then
    v_base := v_base * 2;
  end if;

  return floor(
    v_base * least(greatest(coalesce(p_reps, 0), 0), v_full_reps)::numeric / v_full_reps
  )::integer;
end;
$$;

-- Reps a participant's reward is scaled by.
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
    else p_challenge.target_reps
  end;
$$;

-- Most an exercise challenge can pay (finish + win); stored as xp_reward when it is created.
create or replace function public.calculate_friend_challenge_xp(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language sql
immutable
as $$
  select public.friend_challenge_reward('exercise', p_exercise, p_reps, 'finish', 'xp')
    + public.friend_challenge_reward('exercise', p_exercise, p_reps, 'win', 'xp');
$$;

create or replace function public.calculate_friend_challenge_coins(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language sql
immutable
as $$
  select public.friend_challenge_reward('exercise', p_exercise, p_reps, 'finish', 'coins')
    + public.friend_challenge_reward('exercise', p_exercise, p_reps, 'win', 'coins');
$$;

-- Paying rewards ------------------------------------------------------------------

-- Adds a reward part to a participant and records it as earned.
create or replace function public.pay_friend_challenge_reward(
  p_participant_id uuid,
  p_part text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.friend_challenge_participants;
  v_challenge public.friend_challenges;
  v_reps integer;
  v_xp integer;
  v_coins integer;
begin
  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id
  for update;

  if not found or v_participant.status <> 'completed'::public.challenge_status then
    return;
  end if;

  -- Finish is paid once; win and no-show share one bonus per participant.
  if (p_part = 'finish' and v_participant.participation_awarded)
     or (p_part <> 'finish' and v_participant.winner_bonus_awarded) then
    return;
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  v_reps := public.friend_challenge_reward_reps(v_challenge, v_participant);
  v_xp := public.friend_challenge_reward(v_challenge.challenge_kind, v_challenge.exercise_type, v_reps, p_part, 'xp');
  v_coins := public.friend_challenge_reward(v_challenge.challenge_kind, v_challenge.exercise_type, v_reps, p_part, 'coins');

  perform public.award_friend_challenge_xp(v_participant.user_id, v_xp);
  if v_coins > 0 then
    perform public.award_coins(v_participant.user_id, v_coins);
  end if;

  update public.friend_challenge_participants
  set
    xp_earned = coalesce(xp_earned, 0) + v_xp,
    coins_earned = coalesce(coins_earned, 0) + v_coins,
    participation_awarded = participation_awarded or p_part = 'finish',
    winner_bonus_awarded = winner_bonus_awarded or p_part <> 'finish'
  where id = p_participant_id;
end;
$$;

create or replace function public.award_friend_challenge_participation(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pay_friend_challenge_reward(p_participant_id, 'finish');
end;
$$;

create or replace function public.award_friend_challenge_winner_bonus(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pay_friend_challenge_reward(p_participant_id, 'win');
end;
$$;

-- Resolving a challenge -------------------------------------------------------------

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

  -- The best finisher so far: fastest for exercise races, first to finish for workouts.
  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_first
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.status = 'completed'::public.challenge_status
  order by
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

-- 7-day expiry ----------------------------------------------------------------------

-- Expires challenges sent over 7 days ago; only those involving p_user_id when given.
create or replace function public.expire_stale_friend_challenges(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge_id uuid;
  v_count integer := 0;
begin
  for v_challenge_id in
    select fc.id
    from public.friend_challenges fc
    where fc.resolved_at is null
      and fc.created_at < now() - interval '7 days'
      and exists (
        select 1 from public.friend_challenge_participants p
        where p.challenge_id = fc.id
          and p.status in ('pending'::public.challenge_status, 'in_progress'::public.challenge_status)
      )
      and (
        p_user_id is null
        or exists (
          select 1 from public.friend_challenge_participants p
          where p.challenge_id = fc.id and p.user_id = p_user_id
        )
      )
    for update of fc skip locked
  loop
    update public.friend_challenge_participants
    set status = 'expired'::public.challenge_status
    where challenge_id = v_challenge_id
      and status in ('pending'::public.challenge_status, 'in_progress'::public.challenge_status);

    update public.friend_challenges
    set stale_expired_at = now()
    where id = v_challenge_id;

    perform public.resolve_friend_challenge_race(v_challenge_id);

    -- Nobody finished: close it without a winner.
    update public.friend_challenges
    set resolved_at = coalesce(resolved_at, now())
    where id = v_challenge_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Runs before every challenge read and write, so expiry applies as soon as either player opens the app.
create or replace function public.expire_overdue_friend_challenges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_participant_id uuid;
  v_challenge_id uuid;
begin
  for v_expired_participant_id, v_challenge_id in
    select p.id, p.challenge_id
    from public.friend_challenge_participants p
    join public.friend_challenges fc on fc.id = p.challenge_id
    where p.user_id = p_user_id
      and p.status = 'in_progress'
      and p.started_at is not null
      and fc.time_limit_seconds is not null
      and p.started_at + make_interval(secs => fc.time_limit_seconds) < now()
  loop
    update public.friend_challenge_participants
    set status = 'expired'::public.challenge_status
    where id = v_expired_participant_id;

    perform public.resolve_friend_challenge_race(v_challenge_id);
  end loop;

  perform public.expire_stale_friend_challenges(p_user_id);
end;
$$;

-- Workouts finished after the 7-day expiry are rejected.
create or replace function public.complete_friend_workout_challenge(
  p_participant_id uuid,
  p_started_at timestamptz,
  p_completed_rounds integer,
  p_total_reps integer,
  p_elapsed_seconds integer default null
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
  v_opponent public.friend_challenge_participants;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
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

  if v_challenge.challenge_kind <> 'workout'::public.friend_challenge_kind then
    raise exception 'Not a workout challenge';
  end if;

  if v_participant.status = 'completed'::public.challenge_status then
    return v_participant;
  end if;

  if v_participant.status = 'pending'::public.challenge_status then
    raise exception 'Accept the challenge before completing the workout';
  end if;

  -- Timer-expired workouts still submit their result; only the 7-day expiry closes them.
  if v_challenge.stale_expired_at is not null
     and v_participant.status <> 'in_progress'::public.challenge_status then
    raise exception 'Challenge expired';
  end if;

  update public.friend_challenge_participants
  set
    started_at = coalesce(started_at, p_started_at),
    completed_at = now(),
    status = 'completed'::public.challenge_status,
    completed_rounds = greatest(coalesce(p_completed_rounds, 0), 0),
    workout_total_reps = greatest(coalesce(p_total_reps, 0), 0),
    elapsed_seconds = case
      when v_challenge.workout_type = 'for_time'::public.custom_workout_type
        then greatest(coalesce(p_elapsed_seconds, 0), 0)
      else elapsed_seconds
    end,
    completed_reps = greatest(coalesce(p_total_reps, 0), 0)
  where id = p_participant_id
  returning * into v_participant;

  select * into v_opponent
  from public.friend_challenge_participants
  where challenge_id = v_challenge.id
    and user_id <> v_user_id;

  if v_opponent.id is not null
     and v_opponent.status = 'in_progress'::public.challenge_status
     and v_opponent.started_at is null then
    perform public.schedule_friend_workout_waiting_push(
      v_challenge.id,
      v_opponent.user_id,
      v_user_id,
      v_opponent.id,
      v_challenge.workout_title
    );
  end if;

  perform public.award_friend_challenge_participation(p_participant_id);
  perform public.resolve_friend_challenge_race(v_challenge.id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id;

  return v_participant;
end;
$$;

-- Also sweep every stale challenge on the scheduled job, so rewards land without anyone opening the app.
create or replace function public.run_engagement_push_scheduler()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spin_count integer := 0;
  v_streak_count integer := 0;
  v_friend_waiting_count integer := 0;
  v_expired_count integer := 0;
begin
  v_expired_count := public.expire_stale_friend_challenges();
  v_friend_waiting_count := public.send_friend_waiting_push_notifications();
  v_spin_count := public.send_daily_spin_push_notifications();
  v_streak_count := public.send_streak_at_risk_push_notifications();

  return jsonb_build_object(
    'friend_challenges_expired', v_expired_count,
    'friend_waiting_sent', v_friend_waiting_count,
    'daily_spin_sent', v_spin_count,
    'streak_at_risk_sent', v_streak_count,
    'ran_at', now()
  );
end;
$$;

revoke all on function public.friend_challenge_reward(public.friend_challenge_kind, public.exercise_type, integer, text, text) from public;
revoke all on function public.friend_challenge_reward_reps(public.friend_challenges, public.friend_challenge_participants) from public;
revoke all on function public.pay_friend_challenge_reward(uuid, text) from public;
revoke all on function public.expire_stale_friend_challenges(uuid) from public;

-- History shows the coins each friend challenge actually paid.
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
  coins_earned integer
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
      null::integer as coins_earned
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
      mine.coins_earned
    from public.friend_challenge_participants mine
    join public.friend_challenges fc on fc.id = mine.challenge_id
    join public.friend_challenge_participants opponent
      on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
    join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
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
      case
        when legacy_daily_xp.amount is not null then v_daily_workout_coins
        else null
      end as coins_earned
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
  )
  select *
  from combined c
  where
    v_filter = 'all'
    or (v_filter = 'quests' and c.category = 'daily_quest' and c.status = 'completed'::public.challenge_status)
    or (v_filter = 'friend_challenges' and c.category = 'friend_exercise')
    or (v_filter = 'friend_workouts' and c.category = 'friend_workout')
    or (v_filter = 'workouts' and c.category = 'solo_workout')
  order by c.result_at desc
  limit v_limit
  offset v_offset;
end;
$$;
