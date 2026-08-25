-- Restore rep-scaled rewards for single-exercise friend challenges.
-- Workout challenges keep the flat participation + winner bonus model from 078.

create or replace function public.award_friend_challenge_participation(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.friend_challenge_participants;
  v_challenge public.friend_challenges;
  v_participation_xp integer := public.friend_challenge_participation_xp();
  v_participation_coins integer := public.friend_challenge_participation_coins();
begin
  select p.*
  into v_participant
  from public.friend_challenge_participants p
  where p.id = p_participant_id
  for update;

  if not found or v_participant.status <> 'completed'::public.challenge_status then
    return;
  end if;

  select *
  into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  if v_challenge.challenge_kind <> 'workout'::public.friend_challenge_kind then
    return;
  end if;

  if coalesce(v_participant.xp_earned, 0) > 0 or coalesce(v_participant.coins_earned, 0) > 0 then
    return;
  end if;

  perform public.award_friend_challenge_xp(v_participant.user_id, v_participation_xp);
  perform public.award_coins(v_participant.user_id, v_participation_coins);

  update public.friend_challenge_participants
  set
    xp_earned = v_participation_xp,
    coins_earned = v_participation_coins
  where id = p_participant_id;
end;
$$;

create or replace function public.resolve_friend_challenge_race(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.friend_challenges;
  v_winner_id uuid;
  v_winner_participant_id uuid;
  v_winner_seconds integer;
  v_loser_seconds integer;
  v_participant record;
  v_opponent record;
  v_compare integer;
  v_reward_xp integer;
  v_reward_coins integer;
  v_consolation_xp integer;
begin
  select * into v_challenge
  from public.friend_challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.resolved_at is not null then
    return;
  end if;

  if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
    select p.*
    into v_participant
    from public.friend_challenge_participants p
    where p.challenge_id = p_challenge_id
      and p.status = 'completed'::public.challenge_status
    order by p.completed_at asc nulls last
    limit 1;

    if not found then
      return;
    end if;

    select p.*
    into v_opponent
    from public.friend_challenge_participants p
    where p.challenge_id = p_challenge_id
      and p.id <> v_participant.id;

    if v_opponent.status = 'completed'::public.challenge_status then
      v_compare := public.compare_friend_workout_results(
        v_participant.completed_rounds,
        v_participant.workout_total_reps,
        v_participant.elapsed_seconds,
        v_opponent.completed_rounds,
        v_opponent.workout_total_reps,
        v_opponent.elapsed_seconds,
        v_challenge.workout_type
      );

      update public.friend_challenges
      set resolved_at = now()
      where id = p_challenge_id;

      if v_compare = 0 then
        for v_participant in
          select * from public.friend_challenge_participants
          where challenge_id = p_challenge_id and status = 'completed'::public.challenge_status
        loop
          perform public.award_friend_challenge_winner_bonus(v_participant.id);
        end loop;

        return;
      end if;

      if v_compare > 0 then
        v_winner_id := v_opponent.user_id;
        v_winner_participant_id := v_opponent.id;
      else
        v_winner_id := v_participant.user_id;
        v_winner_participant_id := v_participant.id;
      end if;

      update public.friend_challenges
      set winner_user_id = v_winner_id
      where id = p_challenge_id;

      perform public.award_friend_challenge_winner_bonus(v_winner_participant_id);
      return;
    end if;

    if v_opponent.status in ('expired'::public.challenge_status, 'declined'::public.challenge_status) then
      update public.friend_challenges
      set winner_user_id = v_participant.user_id, resolved_at = now()
      where id = p_challenge_id;

      perform public.award_friend_challenge_winner_bonus(v_participant.id);
    end if;

    return;
  end if;

  v_reward_xp := public.calculate_friend_challenge_xp(v_challenge.exercise_type, v_challenge.target_reps);
  v_reward_coins := public.calculate_friend_challenge_coins(v_challenge.exercise_type, v_challenge.target_reps);
  v_consolation_xp := greatest(1, floor(v_reward_xp * 0.25)::integer);

  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_participant
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.status = 'completed'::public.challenge_status
  order by public.participant_race_seconds(p.started_at, p.completed_at) asc nulls last,
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
    and p.id <> v_participant.id;

  if v_opponent.status = 'completed'::public.challenge_status then
    v_winner_seconds := v_participant.race_seconds;
    v_loser_seconds := v_opponent.race_seconds;

    if v_winner_seconds is not null
       and v_loser_seconds is not null
       and v_loser_seconds < v_winner_seconds then
      v_winner_id := v_opponent.user_id;
    elsif v_winner_seconds is not null
          and v_loser_seconds is not null
          and v_loser_seconds = v_winner_seconds then
      update public.friend_challenges
      set resolved_at = now()
      where id = p_challenge_id;

      for v_participant in
        select * from public.friend_challenge_participants
        where challenge_id = p_challenge_id and status = 'completed'::public.challenge_status
      loop
        if coalesce(v_participant.xp_earned, 0) = 0 then
          perform public.award_friend_challenge_xp(v_participant.user_id, v_reward_xp);
          perform public.award_coins(v_participant.user_id, v_reward_coins);
          update public.friend_challenge_participants
          set xp_earned = v_reward_xp, coins_earned = v_reward_coins
          where id = v_participant.id;
        end if;
      end loop;

      return;
    else
      v_winner_id := v_participant.user_id;
    end if;

    update public.friend_challenges
    set winner_user_id = v_winner_id, resolved_at = now()
    where id = p_challenge_id;

    for v_participant in
      select * from public.friend_challenge_participants
      where challenge_id = p_challenge_id and status = 'completed'::public.challenge_status
    loop
      if coalesce(v_participant.xp_earned, 0) = 0 then
        if v_participant.user_id = v_winner_id then
          perform public.award_friend_challenge_xp(v_participant.user_id, v_reward_xp);
          perform public.award_coins(v_participant.user_id, v_reward_coins);
          update public.friend_challenge_participants
          set xp_earned = v_reward_xp, coins_earned = v_reward_coins
          where id = v_participant.id;
        else
          perform public.award_friend_challenge_xp(v_participant.user_id, v_consolation_xp);
          update public.friend_challenge_participants
          set xp_earned = v_consolation_xp
          where id = v_participant.id;
        end if;
      end if;
    end loop;

    return;
  end if;

  if v_opponent.status in ('expired'::public.challenge_status, 'declined'::public.challenge_status) then
    update public.friend_challenges
    set winner_user_id = v_participant.user_id, resolved_at = now()
    where id = p_challenge_id;

    if coalesce(v_participant.xp_earned, 0) = 0 then
      perform public.award_friend_challenge_xp(v_participant.user_id, v_reward_xp);
      perform public.award_coins(v_participant.user_id, v_reward_coins);
      update public.friend_challenge_participants
      set xp_earned = v_reward_xp, coins_earned = v_reward_coins
      where id = v_participant.id;
    end if;
  end if;
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

  if v_participant.status = 'expired'::public.challenge_status then
    raise exception 'Challenge expired';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
    raise exception 'Use workout completion for this challenge';
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
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );

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
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );

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
    perform public.credit_user_goal_progress_for_exercise(
      v_user_id,
      v_challenge.exercise_type,
      v_delta,
      'friend_challenge',
      p_participant_id::text
    );

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
