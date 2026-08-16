-- Lightweight friend challenge queries for home/challenges list/detail views.

create or replace function public.get_active_friend_challenge_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  select count(*)::int
  into v_count
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  where mine.user_id = v_user_id
    and mine.status not in ('declined', 'expired')
    and (
      mine.status in ('pending', 'in_progress')
      or fc.resolved_at is null
    );

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.get_friends_with_active_friend_challenges()
returns table (
  friend_id uuid,
  friend_username text,
  friend_display_name text,
  active_count integer,
  latest_created_at timestamptz
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
    opponent.user_id as friend_id,
    opponent_profile.username as friend_username,
    opponent_profile.display_name as friend_display_name,
    count(*)::int as active_count,
    max(fc.created_at) as latest_created_at
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id
   and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  where mine.user_id = v_user_id
    and mine.status not in ('declined', 'expired')
    and (
      mine.status in ('pending', 'in_progress')
      or fc.resolved_at is null
    )
  group by opponent.user_id, opponent_profile.username, opponent_profile.display_name
  order by latest_created_at desc;
end;
$$;

create or replace function public.get_friend_challenges_with_user(p_friend_id uuid)
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
  started_at timestamptz,
  xp_earned integer,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer,
  opponent_completed_at timestamptz,
  opponent_started_at timestamptz,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text
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

  if p_friend_id is null then
    raise exception 'Friend not found';
  end if;

  if p_friend_id = v_user_id then
    raise exception 'Invalid friend';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only view challenges with friends';
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
    mine.started_at,
    mine.xp_earned,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps,
    opponent.completed_at as opponent_completed_at,
    opponent.started_at as opponent_started_at,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id
   and opponent.user_id = p_friend_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.user_id = v_user_id
  order by fc.created_at desc
  limit 100;
end;
$$;

grant execute on function public.get_active_friend_challenge_count() to authenticated;
grant execute on function public.get_friends_with_active_friend_challenges() to authenticated;
grant execute on function public.get_friend_challenges_with_user(uuid) to authenticated;
