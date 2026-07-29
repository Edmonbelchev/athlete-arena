-- Optional time limit for friend challenges

do $$ begin
  alter type public.challenge_status add value if not exists 'expired';
exception when others then null;
end $$;

alter table public.friend_challenges
  add column if not exists time_limit_seconds integer
    check (time_limit_seconds is null or (time_limit_seconds >= 60 and time_limit_seconds <= 5400));

alter table public.friend_challenges
  add column if not exists deadline_at timestamptz;

-- Return type / signature changes require drop before recreate
drop function if exists public.get_my_friend_challenges();
drop function if exists public.create_friend_challenge(uuid, public.exercise_type, integer, text);

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

create or replace function public.expire_overdue_friend_challenges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friend_challenge_participants p
  set status = 'expired'::public.challenge_status
  from public.friend_challenges fc
  where p.challenge_id = fc.id
    and p.user_id = p_user_id
    and fc.deadline_at is not null
    and fc.deadline_at < now()
    and p.status in ('pending', 'in_progress');
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
  time_limit_seconds integer,
  deadline_at timestamptz,
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

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    fc.time_limit_seconds,
    fc.deadline_at,
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
    and mine.status not in ('completed', 'declined', 'expired')
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
  v_challenge public.friend_challenges;
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

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id
  for update;

  update public.friend_challenge_participants
  set status = 'in_progress'
  where id = p_participant_id
  returning * into v_participant;

  if v_challenge.time_limit_seconds is not null and v_challenge.deadline_at is null then
    update public.friend_challenges
    set deadline_at = now() + make_interval(secs => v_challenge.time_limit_seconds)
    where id = v_challenge.id;
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

  if v_challenge.deadline_at is not null and now() > v_challenge.deadline_at then
    update public.friend_challenge_participants
    set status = 'expired'::public.challenge_status
    where id = p_participant_id;

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

revoke all on function public.expire_overdue_friend_challenges(uuid) from public;

grant execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text, integer) to authenticated;
grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.expire_overdue_friend_challenges(uuid) to authenticated;

-- Old 4-arg overload removed above; revoke defensively if it still exists
do $$ begin
  revoke execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text) from authenticated;
exception when undefined_function then null;
end $$;
