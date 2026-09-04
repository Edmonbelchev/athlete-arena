-- Defer friend workout waiting pushes by 2 hours, batch to avoid stacking,
-- and move daily spin reminder to 12:00 local time.

create table if not exists public.friend_challenge_waiting_pending (
  challenge_id uuid primary key references public.friend_challenges (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  finisher_user_id uuid not null references public.profiles (id) on delete cascade,
  participant_id uuid not null references public.friend_challenge_participants (id) on delete cascade,
  workout_title text not null default 'the workout challenge',
  notify_at timestamptz not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  sent_at timestamptz
);

create index if not exists friend_challenge_waiting_pending_recipient_notify_idx
  on public.friend_challenge_waiting_pending (recipient_user_id, notify_at)
  where sent_at is null and cancelled_at is null;

alter table public.friend_challenge_waiting_pending enable row level security;

comment on table public.friend_challenge_waiting_pending is
  'Delayed friend workout waiting push — one row per challenge, sent once after notify_at.';

create or replace function public.schedule_friend_workout_waiting_push(
  p_challenge_id uuid,
  p_recipient_user_id uuid,
  p_finisher_user_id uuid,
  p_participant_id uuid,
  p_workout_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_challenge_id is null or p_recipient_user_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.engagement_push_sent eps
    where eps.user_id = p_recipient_user_id
      and eps.notification_type = 'friend_waiting'
      and eps.dedupe_key = p_challenge_id::text
  ) then
    return;
  end if;

  insert into public.friend_challenge_waiting_pending (
    challenge_id,
    recipient_user_id,
    finisher_user_id,
    participant_id,
    workout_title,
    notify_at
  )
  values (
    p_challenge_id,
    p_recipient_user_id,
    p_finisher_user_id,
    p_participant_id,
    coalesce(nullif(trim(p_workout_title), ''), 'the workout challenge'),
    now() + interval '2 hours'
  )
  on conflict (challenge_id) do nothing;
end;
$$;

create or replace function public.cancel_friend_workout_waiting_push(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_challenge_id is null then
    return;
  end if;

  update public.friend_challenge_waiting_pending
  set cancelled_at = coalesce(cancelled_at, now())
  where challenge_id = p_challenge_id
    and sent_at is null
    and cancelled_at is null;
end;
$$;

create or replace function public.mark_friend_waiting_challenges_notified(
  p_user_id uuid,
  p_challenge_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge_id uuid;
begin
  if p_user_id is null or p_challenge_ids is null then
    return;
  end if;

  foreach v_challenge_id in array p_challenge_ids
  loop
    insert into public.engagement_push_sent (user_id, notification_type, dedupe_key)
    values (p_user_id, 'friend_waiting', v_challenge_id::text)
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.send_friend_waiting_push_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_recipient record;
  v_pending record;
  v_valid_ids uuid[] := '{}'::uuid[];
  v_valid_titles text[] := '{}'::text[];
  v_valid_participant_ids uuid[] := '{}'::uuid[];
  v_valid_finisher_names text[] := '{}'::text[];
  v_primary_challenge_id uuid;
  v_primary_participant_id uuid;
  v_title text;
  v_body text;
  v_data jsonb;
  v_push_id uuid;
begin
  -- Cancel stale rows where the recipient started, finished, or left the challenge.
  update public.friend_challenge_waiting_pending pending
  set cancelled_at = now()
  where pending.sent_at is null
    and pending.cancelled_at is null
    and (
      not exists (
        select 1
        from public.friend_challenge_participants recipient
        where recipient.id = pending.participant_id
          and recipient.user_id = pending.recipient_user_id
          and recipient.status = 'in_progress'::public.challenge_status
          and recipient.started_at is null
      )
      or exists (
        select 1
        from public.engagement_push_sent eps
        where eps.user_id = pending.recipient_user_id
          and eps.notification_type = 'friend_waiting'
          and eps.dedupe_key = pending.challenge_id::text
      )
    );

  for v_recipient in
    select distinct pending.recipient_user_id as user_id
    from public.friend_challenge_waiting_pending pending
    where pending.sent_at is null
      and pending.cancelled_at is null
      and pending.notify_at <= now()
      and exists (
        select 1
        from public.user_push_tokens t
        where t.user_id = pending.recipient_user_id
      )
  loop
    v_valid_ids := '{}'::uuid[];
    v_valid_titles := '{}'::text[];
    v_valid_participant_ids := '{}'::uuid[];
    v_valid_finisher_names := '{}'::text[];

    for v_pending in
      select
        pending.challenge_id,
        pending.participant_id,
        pending.workout_title,
        public.format_profile_short_name(pending.finisher_user_id) as finisher_name
      from public.friend_challenge_waiting_pending pending
      join public.friend_challenge_participants recipient
        on recipient.id = pending.participant_id
       and recipient.user_id = pending.recipient_user_id
      where pending.recipient_user_id = v_recipient.user_id
        and pending.sent_at is null
        and pending.cancelled_at is null
        and pending.notify_at <= now()
        and recipient.status = 'in_progress'::public.challenge_status
        and recipient.started_at is null
        and not exists (
          select 1
          from public.engagement_push_sent eps
          where eps.user_id = pending.recipient_user_id
            and eps.notification_type = 'friend_waiting'
            and eps.dedupe_key = pending.challenge_id::text
        )
      order by pending.notify_at asc, pending.created_at asc
    loop
      v_valid_ids := array_append(v_valid_ids, v_pending.challenge_id);
      v_valid_titles := array_append(v_valid_titles, v_pending.workout_title);
      v_valid_participant_ids := array_append(v_valid_participant_ids, v_pending.participant_id);
      v_valid_finisher_names := array_append(v_valid_finisher_names, v_pending.finisher_name);
    end loop;

    if coalesce(array_length(v_valid_ids, 1), 0) = 0 then
      continue;
    end if;

    if not public.user_notification_enabled(v_recipient.user_id, 'friendWaiting') then
      update public.friend_challenge_waiting_pending
      set cancelled_at = now()
      where challenge_id = any (v_valid_ids)
        and sent_at is null
        and cancelled_at is null;

      continue;
    end if;

    v_primary_challenge_id := v_valid_ids[1];
    v_primary_participant_id := v_valid_participant_ids[1];

    if array_length(v_valid_ids, 1) = 1 then
      v_title := 'Your turn';
      v_body := v_valid_finisher_names[1]
        || ' finished '
        || v_valid_titles[1]
        || ' — submit your score.';
      v_data := jsonb_build_object(
        'type', 'friend_challenge_waiting',
        'challengeId', v_primary_challenge_id,
        'participantId', v_primary_participant_id,
        'url', '/challenge/friend/' || v_primary_participant_id::text
      );
    else
      v_title := 'Workout challenges waiting';
      v_body := 'You have '
        || array_length(v_valid_ids, 1)::text
        || ' workout challenges waiting. Submit your scores on the Friends tab.';
      v_data := jsonb_build_object(
        'type', 'friend_challenge_waiting',
        'challengeId', v_primary_challenge_id,
        'participantId', v_primary_participant_id,
        'url', '/(tabs)/friends'
      );
    end if;

    insert into public.push_notifications_outbox (user_id, title, body, data)
    values (v_recipient.user_id, v_title, v_body, v_data)
    returning id into v_push_id;

    if v_push_id is not null then
      perform public.mark_friend_waiting_challenges_notified(v_recipient.user_id, v_valid_ids);

      update public.friend_challenge_waiting_pending
      set sent_at = now()
      where challenge_id = any (v_valid_ids)
        and sent_at is null;

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.send_daily_spin_push_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select p.id as user_id
    from public.profiles p
    where exists (
      select 1
      from public.user_push_tokens t
      where t.user_id = p.id
    )
      and extract(
        hour from timezone(public.profile_timezone(p.id), now())
      ) = 12
      and not exists (
        select 1
        from public.daily_spins ds
        where ds.user_id = p.id
          and ds.spin_date = v_today
      )
  loop
    if public.enqueue_engagement_push_notification(
      v_row.user_id,
      'daily_spin',
      'dailySpin',
      v_today::text,
      'Free spin ready',
      'Claim your daily coins on the wheel.',
      jsonb_build_object(
        'type', 'daily_spin',
        'url', '/spin'
      )
    ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

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
begin
  v_friend_waiting_count := public.send_friend_waiting_push_notifications();
  v_spin_count := public.send_daily_spin_push_notifications();
  v_streak_count := public.send_streak_at_risk_push_notifications();

  return jsonb_build_object(
    'friend_waiting_sent', v_friend_waiting_count,
    'daily_spin_sent', v_spin_count,
    'streak_at_risk_sent', v_streak_count,
    'ran_at', now()
  );
end;
$$;

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

create or replace function public.start_friend_challenge(p_participant_id uuid)
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

  perform public.expire_overdue_friend_challenges(v_user_id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_participant.status = 'completed' then
    return v_participant;
  end if;

  if v_participant.status = 'pending' then
    raise exception 'Accept the challenge before starting';
  end if;

  if v_participant.status = 'expired' then
    raise exception 'Challenge expired';
  end if;

  if exists (
    select 1
    from public.friend_challenge_participants opponent
    where opponent.challenge_id = v_participant.challenge_id
      and opponent.user_id <> v_user_id
      and opponent.status = 'pending'
  ) then
    raise exception 'Waiting for opponent to accept the challenge';
  end if;

  if v_participant.started_at is null then
    update public.friend_challenge_participants
    set started_at = now()
    where id = p_participant_id
    returning * into v_participant;

    perform public.cancel_friend_workout_waiting_push(v_participant.challenge_id);
  end if;

  return v_participant;
end;
$$;

revoke all on function public.schedule_friend_workout_waiting_push(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.cancel_friend_workout_waiting_push(uuid) from public;
revoke all on function public.mark_friend_waiting_challenges_notified(uuid, uuid[]) from public;
revoke all on function public.send_friend_waiting_push_notifications() from public;
