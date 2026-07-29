-- Friends, friend requests, and custom friend challenges

do $$ begin
  alter type public.challenge_status add value if not exists 'declined';
exception when others then null;
end $$;

do $$ begin
  create type public.friendship_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null;
end $$;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
  before update on public.friendships
  for each row
  execute function public.set_updated_at();

alter table public.friendships enable row level security;

drop policy if exists "Users can view own friendships" on public.friendships;
create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));

-- Inserts/updates only via RPC (security definer)

create table if not exists public.friend_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  exercise_type public.exercise_type not null,
  target_reps integer not null check (target_reps > 0 and target_reps <= 100),
  xp_reward integer not null check (xp_reward > 0),
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.friend_challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.challenge_status not null default 'pending',
  completed_reps integer not null default 0 check (completed_reps >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists friend_challenge_participants_user_idx
  on public.friend_challenge_participants (user_id, status);

alter table public.friend_challenges enable row level security;
alter table public.friend_challenge_participants enable row level security;

drop policy if exists "Participants can view friend challenges" on public.friend_challenges;
create policy "Participants can view friend challenges"
  on public.friend_challenges for select
  using (
    exists (
      select 1 from public.friend_challenge_participants p
      where p.challenge_id = friend_challenges.id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view own friend challenge participation" on public.friend_challenge_participants;
create policy "Users can view own friend challenge participation"
  on public.friend_challenge_participants for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view co-participants" on public.friend_challenge_participants;
create policy "Users can view co-participants"
  on public.friend_challenge_participants for select
  using (
    exists (
      select 1 from public.friend_challenge_participants mine
      where mine.challenge_id = friend_challenge_participants.challenge_id
        and mine.user_id = auth.uid()
    )
  );

-- Allow reading friend profiles (limited via views in RPCs; broaden select for accepted friends)
drop policy if exists "Users can view friend profiles" on public.profiles;
create policy "Users can view friend profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
          or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
        )
    )
  );

create or replace function public.calculate_friend_challenge_xp(p_target_reps integer)
returns integer
language sql
immutable
as $$
  select greatest(25, least(200, p_target_reps * 5));
$$;

create or replace function public.users_are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = p_user_a and f.addressee_id = p_user_b)
        or (f.requester_id = p_user_b and f.addressee_id = p_user_a)
      )
  );
$$;

create or replace function public.search_users_by_username(p_query text)
returns table (
  id uuid,
  username text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := lower(trim(coalesce(p_query, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_query) < 2 then
    raise exception 'Search query must be at least 2 characters';
  end if;

  return query
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.id <> v_user_id
    and lower(p.username) like v_query || '%'
    and not exists (
      select 1 from public.friendships f
      where (f.requester_id = v_user_id and f.addressee_id = p.id)
         or (f.addressee_id = v_user_id and f.requester_id = p.id)
    )
  order by p.username
  limit 10;
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

  return v_friendship;
end;
$$;

create or replace function public.get_friends_list()
returns table (
  friendship_id uuid,
  friend_id uuid,
  username text,
  display_name text,
  level integer,
  current_streak integer
)
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

  return query
  select
    f.id as friendship_id,
    case when f.requester_id = v_user_id then f.addressee_id else f.requester_id end as friend_id,
    p.username,
    p.display_name,
    p.level,
    p.current_streak
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = v_user_id then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and v_user_id in (f.requester_id, f.addressee_id)
  order by p.username;
end;
$$;

create or replace function public.get_incoming_friend_requests()
returns table (
  friendship_id uuid,
  requester_id uuid,
  username text,
  display_name text,
  created_at timestamptz
)
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

  return query
  select f.id, f.requester_id, p.username, p.display_name, f.created_at
  from public.friendships f
  join public.profiles p on p.id = f.requester_id
  where f.addressee_id = v_user_id and f.status = 'pending'
  order by f.created_at desc;
end;
$$;

create or replace function public.create_friend_challenge(
  p_friend_id uuid,
  p_exercise public.exercise_type,
  p_target_reps integer,
  p_message text default null
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

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  v_xp := public.calculate_friend_challenge_xp(p_target_reps);

  insert into public.friend_challenges (creator_id, exercise_type, target_reps, xp_reward, message)
  values (v_user_id, p_exercise, p_target_reps, v_xp, nullif(trim(p_message), ''))
  returning id into v_challenge_id;

  insert into public.friend_challenge_participants (challenge_id, user_id, status)
  values
    (v_challenge_id, v_user_id, 'in_progress'),
    (v_challenge_id, p_friend_id, 'pending');

  return v_challenge_id;
end;
$$;

create or replace function public.get_my_friend_challenges()
returns table (
  participant_id uuid,
  challenge_id uuid,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  message text,
  status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer
)
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

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    mine.status,
    mine.completed_reps,
    mine.completed_at,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  where mine.user_id = v_user_id
    and mine.status not in ('completed', 'declined')
  order by fc.created_at desc;
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
  where id = p_participant_id
  returning * into v_participant;

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

  if v_participant.status = 'in_progress' then
    return v_participant;
  end if;

  return v_participant;
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
  v_new_total_xp integer;
  v_new_level integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_completed_reps < 0 then
    raise exception 'Completed reps must be non-negative';
  end if;

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
    raise exception 'Accept the challenge before completing reps';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

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

  select total_xp into v_new_total_xp from public.profiles where id = v_user_id;
  v_new_total_xp := v_new_total_xp + v_challenge.xp_reward;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set total_xp = v_new_total_xp, level = v_new_level
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  return v_participant;
end;
$$;

revoke all on function public.calculate_friend_challenge_xp(integer) from public;
revoke all on function public.users_are_friends(uuid, uuid) from public;

grant execute on function public.search_users_by_username(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.get_friends_list() to authenticated;
grant execute on function public.get_incoming_friend_requests() to authenticated;
grant execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text) to authenticated;
grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.accept_friend_challenge(uuid) to authenticated;
grant execute on function public.decline_friend_challenge(uuid) to authenticated;
grant execute on function public.start_friend_challenge(uuid) to authenticated;
grant execute on function public.complete_friend_challenge(uuid, integer) to authenticated;
