-- Solo workout rewards in history + workout session detail.
-- 1. Sessions remember the coins they paid (first workout of the day bonus), so history can show them.
-- 2. Activity history reads those coins for solo workouts.
-- 3. get_workout_session_detail returns one of the caller's sessions with its exercise breakdown.

alter table public.custom_workout_sessions
  add column if not exists coins_earned integer;

-- Same signature as before; now records the coins actually paid (including any coin multiplier).
create or replace function public.award_daily_workout_completion(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_claimed_on date;
  v_balance_before integer;
  v_balance_after integer;
  v_daily_coins constant integer := 125;
  v_paid integer;
begin
  if p_user_id is null then
    return null;
  end if;

  select daily_workout_reward_claimed_on, coin_balance
  into v_claimed_on, v_balance_before
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return null;
  end if;

  if v_claimed_on = v_today then
    return null;
  end if;

  update public.profiles
  set daily_workout_reward_claimed_on = v_today
  where id = p_user_id;

  v_balance_after := public.award_coins(p_user_id, v_daily_coins);
  v_paid := greatest(coalesce(v_balance_after, 0) - coalesce(v_balance_before, 0), v_daily_coins);

  update public.custom_workout_sessions
  set coins_earned = v_paid
  where id = p_session_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'xp', 0,
    'coins', v_paid
  );
end;
$$;

-- History shows the coins each solo workout paid.
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
      coalesce(
        s.coins_earned,
        case
          when legacy_daily_xp.amount is not null then v_daily_workout_coins
          else null
        end
      ) as coins_earned
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

create or replace function public.get_workout_session_detail(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'session_id', s.id,
    'title', s.title,
    'workout_type', coalesce(wc.workout_type, t.workout_type, 'amrap'::public.custom_workout_type),
    'time_limit_seconds', s.time_limit_seconds,
    'completed_rounds', s.completed_rounds,
    'total_reps', s.total_reps,
    'elapsed_seconds', s.elapsed_seconds,
    'exercise_breakdown', s.exercise_breakdown,
    'started_at', s.started_at,
    'completed_at', s.completed_at,
    'xp_earned', coalesce(session_xp.amount, legacy_daily_xp.amount),
    'coins_earned', coalesce(s.coins_earned, case when legacy_daily_xp.amount is not null then 125 end)
  )
  into v_result
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
  where s.id = p_session_id
    and s.user_id = v_user_id;

  if v_result is null then
    raise exception 'Workout session not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_workout_session_detail(uuid) from public;
grant execute on function public.get_workout_session_detail(uuid) to authenticated;
