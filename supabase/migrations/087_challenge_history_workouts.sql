-- Extend challenge history for friend workout challenges (null exercise_type).

drop function if exists public.get_challenge_history(integer);

create or replace function public.get_challenge_history(p_limit integer default 50)
returns table (
  entry_id uuid,
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
  opponent_completed_rounds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  (
    select
      dc.id as entry_id,
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
      null::integer as opponent_completed_rounds
    from public.daily_challenges dc
    where dc.user_id = v_user_id
      and (
        dc.status = 'completed'
        or dc.challenge_date < current_date
      )
  )
  union all
  (
    select
      mine.id as entry_id,
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
      opponent.completed_rounds as opponent_completed_rounds
    from public.friend_challenge_participants mine
    join public.friend_challenges fc on fc.id = mine.challenge_id
    join public.friend_challenge_participants opponent
      on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
    join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
    where mine.user_id = v_user_id
      and mine.status in ('completed', 'expired', 'declined')
  )
  order by result_at desc
  limit v_limit;
end;
$$;

grant execute on function public.get_challenge_history(integer) to authenticated;
