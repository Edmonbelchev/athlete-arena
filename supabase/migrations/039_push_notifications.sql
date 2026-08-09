-- Push notification tokens, outbox queue, and server-side enqueue hooks.

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text,
  updated_at timestamptz not null default now(),
  constraint user_push_tokens_unique_token unique (user_id, expo_push_token)
);

create index if not exists user_push_tokens_user_id_idx
  on public.user_push_tokens (user_id);

create table if not exists public.push_notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists push_notifications_outbox_created_at_idx
  on public.push_notifications_outbox (created_at desc);

alter table public.user_push_tokens enable row level security;
alter table public.push_notifications_outbox enable row level security;

create or replace function public.format_profile_short_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.display_name), ''), p.username)
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function public.format_exercise_label(p_exercise public.exercise_type)
returns text
language sql
immutable
as $$
  select case p_exercise
    when 'push_ups' then 'push-ups'
    when 'pull_ups' then 'pull-ups'
    else 'squats'
  end;
$$;

create or replace function public.enqueue_push_notification(
  p_user_id uuid,
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
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.push_notifications_outbox (user_id, title, body, data)
  values (p_user_id, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns public.user_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_push_tokens;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_expo_push_token), '') = '' then
    raise exception 'Push token is required';
  end if;

  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'Invalid platform';
  end if;

  insert into public.user_push_tokens (user_id, expo_push_token, platform, device_name, updated_at)
  values (v_user_id, trim(p_expo_push_token), p_platform, nullif(trim(p_device_name), ''), now())
  on conflict (user_id, expo_push_token) do update
  set
    platform = excluded.platform,
    device_name = excluded.device_name,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.unregister_push_token(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_push_tokens
  where user_id = v_user_id
    and expo_push_token = trim(p_expo_push_token);
end;
$$;

create or replace function public.send_friend_request(p_username text)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_addressee_id uuid;
  v_friendship public.friendships;
  v_normalized text := lower(trim(coalesce(p_username, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.id into v_addressee_id
  from public.profiles p
  where lower(p.username) = v_normalized;

  if v_addressee_id is null then
    raise exception 'User not found';
  end if;

  if v_addressee_id = v_user_id then
    raise exception 'Cannot add yourself';
  end if;

  if exists (
    select 1 from public.friendships f
    where (f.requester_id = v_user_id and f.addressee_id = v_addressee_id)
       or (f.requester_id = v_addressee_id and f.addressee_id = v_user_id)
  ) then
    raise exception 'Friend request already exists';
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (v_user_id, v_addressee_id)
  returning * into v_friendship;

  perform public.enqueue_push_notification(
    v_addressee_id,
    'New friend request',
    public.format_profile_short_name(v_user_id) || ' sent you a friend request',
    jsonb_build_object(
      'type', 'friend_request_received',
      'friendshipId', v_friendship.id,
      'url', '/(tabs)/friends'
    )
  );

  return v_friendship;
end;
$$;

create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_friendship public.friendships;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_friendship
  from public.friendships
  where id = p_friendship_id and addressee_id = v_user_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Friend request not found';
  end if;

  update public.friendships
  set status = case when p_accept then 'accepted'::public.friendship_status else 'declined'::public.friendship_status end
  where id = p_friendship_id
  returning * into v_friendship;

  if p_accept then
    perform public.enqueue_push_notification(
      v_friendship.requester_id,
      'Friend request accepted',
      public.format_profile_short_name(v_user_id) || ' accepted your friend request',
      jsonb_build_object(
        'type', 'friend_request_accepted',
        'friendshipId', v_friendship.id,
        'url', '/(tabs)/friends'
      )
    );
  end if;

  return v_friendship;
end;
$$;

create or replace function public.create_friend_challenge(
  p_friend_id uuid,
  p_exercise public.exercise_type,
  p_target_reps integer,
  p_message text default null,
  p_time_limit_seconds integer default null,
  p_emote_id text default null
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
  v_participant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_reps < 1 or p_target_reps > 1000 then
    raise exception 'Target reps must be between 1 and 1000';
  end if;

  if p_time_limit_seconds is not null
     and (p_time_limit_seconds < 60 or p_time_limit_seconds > 5400) then
    raise exception 'Time limit must be between 60 and 5400 seconds';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  if p_emote_id is not null then
    if not exists (
      select 1
      from public.user_inventory ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = v_user_id
        and ui.item_id = p_emote_id
        and si.item_type = 'emote'
    ) then
      raise exception 'Emote not owned';
    end if;
  end if;

  v_xp := public.calculate_friend_challenge_xp(p_exercise, p_target_reps);

  insert into public.friend_challenges (
    creator_id, exercise_type, target_reps, xp_reward, message, time_limit_seconds, creator_emote_id
  )
  values (
    v_user_id, p_exercise, p_target_reps, v_xp, nullif(trim(p_message), ''), p_time_limit_seconds, p_emote_id
  )
  returning id into v_challenge_id;

  insert into public.friend_challenge_participants (challenge_id, user_id, status)
  values
    (v_challenge_id, v_user_id, 'in_progress'),
    (v_challenge_id, p_friend_id, 'pending');

  select p.id
  into v_participant_id
  from public.friend_challenge_participants p
  where p.challenge_id = v_challenge_id
    and p.user_id = p_friend_id;

  perform public.enqueue_push_notification(
    p_friend_id,
    'New speed race',
    public.format_profile_short_name(v_user_id)
      || ' challenged you to '
      || p_target_reps::text
      || ' '
      || public.format_exercise_label(p_exercise),
    jsonb_build_object(
      'type', 'challenge_received',
      'challengeId', v_challenge_id,
      'participantId', v_participant_id,
      'url', '/(tabs)/friends'
    )
  );

  return v_challenge_id;
end;
$$;

create or replace function public.accept_friend_challenge(p_participant_id uuid)
returns public.friend_challenge_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.friend_challenge_participants;
  v_creator_id uuid;
  v_creator_participant_id uuid;
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
  set status = 'in_progress'
  where id = p_participant_id
  returning * into v_participant;

  select fc.creator_id
  into v_creator_id
  from public.friend_challenges fc
  where fc.id = v_participant.challenge_id;

  if v_creator_id is not null and v_creator_id <> v_user_id then
    select p.id
    into v_creator_participant_id
    from public.friend_challenge_participants p
    where p.challenge_id = v_participant.challenge_id
      and p.user_id = v_creator_id;

    perform public.enqueue_push_notification(
      v_creator_id,
      'Challenge accepted',
      public.format_profile_short_name(v_user_id) || ' accepted your speed race',
      jsonb_build_object(
        'type', 'challenge_accepted',
        'challengeId', v_participant.challenge_id,
        'participantId', v_creator_participant_id,
        'url', '/(tabs)/friends'
      )
    );
  end if;

  return v_participant;
end;
$$;

create or replace function public.decline_friend_challenge(p_participant_id uuid)
returns public.friend_challenge_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.friend_challenge_participants;
  v_creator_id uuid;
  v_creator_participant_id uuid;
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

  select fc.creator_id
  into v_creator_id
  from public.friend_challenges fc
  where fc.id = v_participant.challenge_id;

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

  if v_creator_id is not null and v_creator_id <> v_user_id then
    select p.id
    into v_creator_participant_id
    from public.friend_challenge_participants p
    where p.challenge_id = v_participant.challenge_id
      and p.user_id = v_creator_id;

    perform public.enqueue_push_notification(
      v_creator_id,
      'Challenge declined',
      public.format_profile_short_name(v_user_id) || ' declined your speed race',
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

grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
