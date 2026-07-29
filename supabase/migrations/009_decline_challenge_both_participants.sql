-- When one player declines a friend challenge, mark both participants declined.

create or replace function public.decline_friend_challenge(p_participant_id uuid)
returns public.friend_challenge_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.friend_challenge_participants;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id and user_id = v_user_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Challenge invitation not found';
  end if;

  update public.friend_challenge_participants
  set status = 'declined'::public.challenge_status
  where challenge_id = v_participant.challenge_id
    and status in ('pending', 'in_progress');

  update public.friend_challenges
  set resolved_at = coalesce(resolved_at, now())
  where id = v_participant.challenge_id;

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id;

  return v_participant;
end;
$$;

grant execute on function public.decline_friend_challenge(uuid) to authenticated;
