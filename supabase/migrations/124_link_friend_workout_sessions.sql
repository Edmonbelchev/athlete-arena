-- Friend workout challenges and the workout run behind them show as one history entry.
-- 1. Sessions can point at the friend challenge participant they were run for.
-- 2. complete_friend_workout_challenge accepts the saved session id and links it.
-- 3. Existing runs are linked by matching title and completion time.
-- 4. Activity history hides linked runs from the solo list and attaches their rewards to the challenge.

alter table public.custom_workout_sessions
  add column if not exists friend_challenge_participant_id uuid
    references public.friend_challenge_participants (id) on delete set null;

create index if not exists custom_workout_sessions_friend_participant_idx
  on public.custom_workout_sessions (friend_challenge_participant_id)
  where friend_challenge_participant_id is not null;

-- Backfill: the run saved right before each completed friend workout, same user and title.
update public.custom_workout_sessions s
set friend_challenge_participant_id = match.participant_id
from (
  select distinct on (mine.id)
    mine.id as participant_id,
    s2.id as session_id
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.custom_workout_sessions s2
    on s2.user_id = mine.user_id
   and trim(s2.title) = trim(fc.workout_title)
   and s2.friend_challenge_participant_id is null
   and abs(extract(epoch from (s2.completed_at - mine.completed_at))) <= 600
  where fc.challenge_kind = 'workout'::public.friend_challenge_kind
    and mine.status = 'completed'::public.challenge_status
    and mine.completed_at is not null
  order by mine.id, abs(extract(epoch from (s2.completed_at - mine.completed_at)))
) match
where s.id = match.session_id;

drop function if exists public.complete_friend_workout_challenge(uuid, timestamptz, integer, integer, integer);

create or replace function public.complete_friend_workout_challenge(
  p_participant_id uuid,
  p_started_at timestamptz,
  p_completed_rounds integer,
  p_total_reps integer,
  p_elapsed_seconds integer default null,
  p_session_id uuid default null
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

  -- The workout run that produced this result shows up in history as part of the challenge.
  if p_session_id is not null then
    update public.custom_workout_sessions
    set friend_challenge_participant_id = p_participant_id
    where id = p_session_id
      and user_id = v_user_id
      and friend_challenge_participant_id is null;
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

grant execute on function public.complete_friend_workout_challenge(uuid, timestamptz, integer, integer, integer, uuid) to authenticated;

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
  workout_session_coins integer
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
      null::integer as workout_session_coins
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
      linked_session.coins_earned as workout_session_coins
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
      null::integer as workout_session_coins
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
  order by c.result_at desc
  limit v_limit
  offset v_offset;
end;
$$;

grant execute on function public.get_activity_history(text, integer, integer) to authenticated;
