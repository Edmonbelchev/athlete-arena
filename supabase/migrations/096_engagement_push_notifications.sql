-- Engagement push notifications: streak at risk, friend waiting, daily spin.
-- Respects per-type toggles stored in profiles.preferences.notifications.

create table if not exists public.engagement_push_sent (
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null,
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, notification_type, dedupe_key)
);

create index if not exists engagement_push_sent_sent_at_idx
  on public.engagement_push_sent (sent_at desc);

alter table public.engagement_push_sent enable row level security;

comment on table public.engagement_push_sent is
  'Dedupes scheduled engagement push notifications (one row per user/type/key).';

create or replace function public.user_notification_enabled(
  p_user_id uuid,
  p_preference_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (p.preferences -> 'notifications' ->> p_preference_key)::boolean
      from public.profiles p
      where p.id = p_user_id
    ),
    true
  );
$$;

create or replace function public.profile_timezone(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim((select p.preferences ->> 'timezone' from public.profiles p where p.id = p_user_id)), ''),
    'UTC'
  );
$$;

create or replace function public.enqueue_engagement_push_notification(
  p_user_id uuid,
  p_notification_type text,
  p_preference_key text,
  p_dedupe_key text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_inserted integer;
begin
  if p_user_id is null then
    return null;
  end if;

  if coalesce(trim(p_dedupe_key), '') = '' then
    return null;
  end if;

  if not public.user_notification_enabled(p_user_id, p_preference_key) then
    return null;
  end if;

  if not exists (
    select 1
    from public.user_push_tokens t
    where t.user_id = p_user_id
  ) then
    return null;
  end if;

  insert into public.engagement_push_sent (user_id, notification_type, dedupe_key)
  values (p_user_id, p_notification_type, p_dedupe_key)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return null;
  end if;

  insert into public.push_notifications_outbox (user_id, title, body, data)
  values (p_user_id, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;

  return v_id;
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
      ) = 9
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

create or replace function public.send_streak_at_risk_push_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_count integer := 0;
  v_row record;
  v_streak integer;
begin
  for v_row in
    select
      p.id as user_id,
      p.weekly_mission_streak,
      p.weekly_mission_streak_last_date
    from public.profiles p
    where exists (
      select 1
      from public.user_push_tokens t
      where t.user_id = p.id
    )
      and extract(
        hour from timezone(public.profile_timezone(p.id), now())
      ) = 20
      and not exists (
        select 1
        from public.daily_challenges dc
        where dc.user_id = p.id
          and dc.challenge_date = v_today
          and dc.status = 'completed'
      )
  loop
    v_streak := v_row.weekly_mission_streak;

    if v_row.weekly_mission_streak_last_date is null
       or v_row.weekly_mission_streak_last_date < v_today - 1 then
      v_streak := 0;
    end if;

    if v_streak < 2 then
      continue;
    end if;

    if v_row.weekly_mission_streak_last_date = v_today then
      continue;
    end if;

    if public.enqueue_engagement_push_notification(
      v_row.user_id,
      'streak_at_risk',
      'streakAtRisk',
      v_today::text,
      'Don''t break your streak',
      'Complete a daily mission today to keep your ' || v_streak::text || '-day streak.',
      jsonb_build_object(
        'type', 'streak_at_risk',
        'url', '/profile/quest-log'
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
begin
  v_spin_count := public.send_daily_spin_push_notifications();
  v_streak_count := public.send_streak_at_risk_push_notifications();

  return jsonb_build_object(
    'daily_spin_sent', v_spin_count,
    'streak_at_risk_sent', v_streak_count,
    'ran_at', now()
  );
end;
$$;

-- Notify opponent when a workout challenge is finished first.
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
  v_workout_title text;
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
     and v_opponent.status = 'in_progress'::public.challenge_status then
    v_workout_title := coalesce(
      nullif(trim(v_challenge.workout_title), ''),
      'the workout challenge'
    );

    perform public.enqueue_engagement_push_notification(
      v_opponent.user_id,
      'friend_waiting',
      'friendWaiting',
      v_challenge.id::text,
      'Your turn',
      public.format_profile_short_name(v_user_id)
        || ' finished '
        || v_workout_title
        || ' — submit your score.',
      jsonb_build_object(
        'type', 'friend_challenge_waiting',
        'challengeId', v_challenge.id,
        'participantId', v_opponent.id,
        'url', '/challenge/friend/' || v_opponent.id::text
      )
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

revoke all on function public.user_notification_enabled(uuid, text) from public;
revoke all on function public.profile_timezone(uuid) from public;
revoke all on function public.enqueue_engagement_push_notification(uuid, text, text, text, text, text, jsonb) from public;
revoke all on function public.send_daily_spin_push_notifications() from public;
revoke all on function public.send_streak_at_risk_push_notifications() from public;
revoke all on function public.run_engagement_push_scheduler() from public;

grant execute on function public.run_engagement_push_scheduler() to service_role;
