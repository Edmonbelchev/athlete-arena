-- Extend friend challenge timer max to 90 minutes (5400 seconds)

alter table public.friend_challenges
  drop constraint if exists friend_challenges_time_limit_seconds_check;

alter table public.friend_challenges
  add constraint friend_challenges_time_limit_seconds_check
  check (time_limit_seconds is null or (time_limit_seconds >= 60 and time_limit_seconds <= 5400));

create or replace function public.create_friend_challenge(
  p_friend_id uuid,
  p_exercise public.exercise_type,
  p_target_reps integer,
  p_message text default null,
  p_time_limit_seconds integer default null
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_reps < 1 or p_target_reps > 100 then
    raise exception 'Target reps must be between 1 and 100';
  end if;

  if p_time_limit_seconds is not null
     and (p_time_limit_seconds < 60 or p_time_limit_seconds > 5400) then
    raise exception 'Time limit must be between 60 and 5400 seconds';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  v_xp := public.calculate_friend_challenge_xp(p_target_reps);

  insert into public.friend_challenges (
    creator_id, exercise_type, target_reps, xp_reward, message, time_limit_seconds
  )
  values (
    v_user_id, p_exercise, p_target_reps, v_xp, nullif(trim(p_message), ''), p_time_limit_seconds
  )
  returning id into v_challenge_id;

  insert into public.friend_challenge_participants (challenge_id, user_id, status)
  values
    (v_challenge_id, v_user_id, 'in_progress'),
    (v_challenge_id, p_friend_id, 'pending');

  return v_challenge_id;
end;
$$;

grant execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text, integer) to authenticated;
