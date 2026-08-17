-- Smarter friend challenge decline:
-- - No one started (no started_at): decline both participants
-- - Opponent already finished: forfeit win via resolve_friend_challenge_race
-- - Otherwise: only decline the invitee

create or replace function public.decline_friend_challenge(p_participant_id uuid)
returns public.friend_challenge_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.friend_challenge_participants;
  v_challenge_id uuid;
  v_creator_id uuid;
  v_creator_participant_id uuid;
  v_any_started boolean;
  v_other_completed boolean;
  v_notification_title text;
  v_notification_body text;
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

  v_challenge_id := v_participant.challenge_id;

  select fc.creator_id
  into v_creator_id
  from public.friend_challenges fc
  where fc.id = v_challenge_id;

  select exists (
    select 1
    from public.friend_challenge_participants p
    where p.challenge_id = v_challenge_id
      and p.started_at is not null
  ) into v_any_started;

  select exists (
    select 1
    from public.friend_challenge_participants p
    where p.challenge_id = v_challenge_id
      and p.user_id <> v_user_id
      and p.status = 'completed'
  ) into v_other_completed;

  if not v_any_started then
    update public.friend_challenge_participants
    set status = 'declined'::public.challenge_status
    where challenge_id = v_challenge_id
      and status in ('pending', 'in_progress');

    v_notification_title := 'Challenge declined';
    v_notification_body := public.format_profile_short_name(v_user_id) || ' declined your speed race';
  else
    update public.friend_challenge_participants
    set status = 'declined'::public.challenge_status
    where id = p_participant_id;

    if v_other_completed then
      perform public.resolve_friend_challenge_race(v_challenge_id);
      v_notification_title := 'Opponent forfeited';
      v_notification_body := public.format_profile_short_name(v_user_id) || ' forfeited your speed race';
    else
      v_notification_title := 'Challenge declined';
      v_notification_body := public.format_profile_short_name(v_user_id) || ' declined your speed race';
    end if;
  end if;

  update public.friend_challenges
  set resolved_at = coalesce(resolved_at, now())
  where id = v_challenge_id;

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id;

  if v_creator_id is not null and v_creator_id <> v_user_id then
    select p.id
    into v_creator_participant_id
    from public.friend_challenge_participants p
    where p.challenge_id = v_participant.challenge_id
      and p.user_id = v_creator_id;

    perform public.enqueue_push_notification(
      v_creator_id,
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'type', 'challenge_declined',
        'challengeId', v_participant.challenge_id,
        'participantId', v_creator_participant_id,
        'url', '/(tabs)/friends'
      )
    );
  end if;

  return v_participant;
end;
$$;

grant execute on function public.decline_friend_challenge(uuid) to authenticated;
