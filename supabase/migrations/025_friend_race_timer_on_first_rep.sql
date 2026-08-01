-- Start friend race timers when the first rep is recorded, not when the camera opens.

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

  if v_participant.status = 'expired' then
    raise exception 'Challenge expired';
  end if;

  if v_participant.status = 'completed' then
    return v_participant;
  end if;

  if v_participant.status = 'pending' then
    raise exception 'Accept the challenge before completing reps';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

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

    if p_completed_reps >= v_challenge.target_reps then
      update public.friend_challenge_participants
      set
        completed_reps = v_challenge.target_reps,
        status = 'completed',
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

    return v_participant;
  end if;

  update public.friend_challenge_participants
  set
    completed_reps = v_challenge.target_reps,
    status = 'completed',
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id
  returning * into v_participant;

  perform public.resolve_friend_challenge_race(v_challenge.id);

  return v_participant;
end;
$$;
