-- Friend challenge speed races: fastest to complete target reps wins

alter table public.friend_challenge_participants
  add column if not exists started_at timestamptz,
  add column if not exists xp_earned integer;

alter table public.friend_challenges
  add column if not exists winner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;

create or replace function public.participant_race_seconds(
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns integer
language sql
immutable
as $$
  select case
    when p_started_at is null or p_completed_at is null then null
    else greatest(0, floor(extract(epoch from (p_completed_at - p_started_at)))::integer)
  end;
$$;

create or replace function public.award_friend_challenge_xp(
  p_user_id uuid,
  p_xp integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_total_xp integer;
  v_new_level integer;
begin
  if p_xp <= 0 then
    return;
  end if;

  select total_xp into v_new_total_xp from public.profiles where id = p_user_id;
  v_new_total_xp := v_new_total_xp + p_xp;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set total_xp = v_new_total_xp, level = v_new_level
  where id = p_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);
end;
$$;

create or replace function public.resolve_friend_challenge_race(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.friend_challenges;
  v_winner_id uuid;
  v_winner_seconds integer;
  v_loser_seconds integer;
  v_participant record;
  v_opponent record;
  v_consolation_xp integer;
begin
  select * into v_challenge
  from public.friend_challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.resolved_at is not null then
    return;
  end if;

  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_participant
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.status = 'completed'
  order by public.participant_race_seconds(p.started_at, p.completed_at) asc nulls last,
           p.completed_at asc nulls last
  limit 1;

  if not found then
    return;
  end if;

  select p.*,
         public.participant_race_seconds(p.started_at, p.completed_at) as race_seconds
  into v_opponent
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.id <> v_participant.id;

  if v_opponent.status = 'completed' then
    v_winner_seconds := v_participant.race_seconds;
    v_loser_seconds := v_opponent.race_seconds;

    if v_winner_seconds is not null
       and v_loser_seconds is not null
       and v_loser_seconds < v_winner_seconds then
      v_winner_id := v_opponent.user_id;
    elsif v_winner_seconds is not null
          and v_loser_seconds is not null
          and v_loser_seconds = v_winner_seconds then
      update public.friend_challenges
      set resolved_at = now()
      where id = p_challenge_id;

      for v_participant in
        select * from public.friend_challenge_participants
        where challenge_id = p_challenge_id and status = 'completed'
      loop
        if coalesce(v_participant.xp_earned, 0) = 0 then
          perform public.award_friend_challenge_xp(v_participant.user_id, v_challenge.xp_reward);
          update public.friend_challenge_participants
          set xp_earned = v_challenge.xp_reward
          where id = v_participant.id;
        end if;
      end loop;

      return;
    else
      v_winner_id := v_participant.user_id;
    end if;

    v_consolation_xp := greatest(1, floor(v_challenge.xp_reward * 0.25)::integer);

    update public.friend_challenges
    set winner_user_id = v_winner_id, resolved_at = now()
    where id = p_challenge_id;

    for v_participant in
      select * from public.friend_challenge_participants
      where challenge_id = p_challenge_id and status = 'completed'
    loop
      if coalesce(v_participant.xp_earned, 0) = 0 then
        if v_participant.user_id = v_winner_id then
          perform public.award_friend_challenge_xp(v_participant.user_id, v_challenge.xp_reward);
          update public.friend_challenge_participants
          set xp_earned = v_challenge.xp_reward
          where id = v_participant.id;
        else
          perform public.award_friend_challenge_xp(v_participant.user_id, v_consolation_xp);
          update public.friend_challenge_participants
          set xp_earned = v_consolation_xp
          where id = v_participant.id;
        end if;
      end if;
    end loop;

    return;
  end if;

  if v_opponent.status in ('expired', 'declined') then
    update public.friend_challenges
    set winner_user_id = v_participant.user_id, resolved_at = now()
    where id = p_challenge_id;

    if coalesce(v_participant.xp_earned, 0) = 0 then
      perform public.award_friend_challenge_xp(v_participant.user_id, v_challenge.xp_reward);
      update public.friend_challenge_participants
      set xp_earned = v_challenge.xp_reward
      where id = v_participant.id;
    end if;
  end if;
end;
$$;

create or replace function public.expire_overdue_friend_challenges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_participant_id uuid;
  v_challenge_id uuid;
begin
  for v_expired_participant_id, v_challenge_id in
    select p.id, p.challenge_id
    from public.friend_challenge_participants p
    join public.friend_challenges fc on fc.id = p.challenge_id
    where p.user_id = p_user_id
      and p.status = 'in_progress'
      and p.started_at is not null
      and fc.time_limit_seconds is not null
      and p.started_at + make_interval(secs => fc.time_limit_seconds) < now()
  loop
    update public.friend_challenge_participants
    set status = 'expired'::public.challenge_status
    where id = v_expired_participant_id;

    perform public.resolve_friend_challenge_race(v_challenge_id);
  end loop;
end;
$$;

drop function if exists public.get_my_friend_challenges();

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
  resolved_at timestamptz
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
    fc.resolved_at
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  where mine.user_id = v_user_id
    and mine.status not in ('declined', 'expired')
    and (
      mine.status in ('pending', 'in_progress')
      or fc.resolved_at is null
    )
  order by fc.created_at desc;
end;
$$;

create or replace function public.get_friend_challenge_detail(p_participant_id uuid)
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
  resolved_at timestamptz
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
  select *
  from public.get_my_friend_challenges() g
  where g.participant_id = p_participant_id;
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
    raise exception 'Start the challenge before counting reps';
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

drop function if exists public.get_challenge_history(integer);

create or replace function public.get_challenge_history(p_limit integer default 50)
returns table (
  entry_id uuid,
  kind text,
  exercise_type public.exercise_type,
  target_reps integer,
  completed_reps integer,
  xp_reward integer,
  status public.challenge_status,
  result_at timestamptz,
  opponent_username text,
  opponent_display_name text,
  opponent_completed_reps integer,
  opponent_status public.challenge_status,
  race_seconds integer,
  opponent_race_seconds integer,
  winner_user_id uuid,
  xp_earned integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  (
    select
      dc.id as entry_id,
      'daily'::text as kind,
      dc.exercise_type,
      dc.target_reps,
      dc.completed_reps,
      dc.xp_reward,
      dc.status,
      coalesce(dc.completed_at, dc.challenge_date::timestamptz) as result_at,
      null::text as opponent_username,
      null::text as opponent_display_name,
      null::integer as opponent_completed_reps,
      null::public.challenge_status as opponent_status,
      null::integer as race_seconds,
      null::integer as opponent_race_seconds,
      null::uuid as winner_user_id,
      null::integer as xp_earned
    from public.daily_challenges dc
    where dc.user_id = v_user_id
      and (
        dc.status = 'completed'
        or dc.challenge_date < current_date
      )
  )
  union all
  (
    select
      mine.id as entry_id,
      'friend'::text as kind,
      fc.exercise_type,
      fc.target_reps,
      mine.completed_reps,
      fc.xp_reward,
      mine.status,
      coalesce(mine.completed_at, fc.resolved_at, fc.created_at) as result_at,
      opponent_profile.username as opponent_username,
      opponent_profile.display_name as opponent_display_name,
      opponent.completed_reps as opponent_completed_reps,
      opponent.status as opponent_status,
      public.participant_race_seconds(mine.started_at, mine.completed_at) as race_seconds,
      public.participant_race_seconds(opponent.started_at, opponent.completed_at) as opponent_race_seconds,
      fc.winner_user_id,
      mine.xp_earned
    from public.friend_challenge_participants mine
    join public.friend_challenges fc on fc.id = mine.challenge_id
    join public.friend_challenge_participants opponent
      on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
    join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
    where mine.user_id = v_user_id
      and mine.status in ('completed', 'expired', 'declined')
  )
  order by result_at desc
  limit v_limit;
end;
$$;

revoke all on function public.participant_race_seconds(timestamptz, timestamptz) from public;
revoke all on function public.award_friend_challenge_xp(uuid, integer) from public;
revoke all on function public.resolve_friend_challenge_race(uuid) from public;

grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.get_friend_challenge_detail(uuid) to authenticated;
grant execute on function public.start_friend_challenge(uuid) to authenticated;
grant execute on function public.complete_friend_challenge(uuid, integer) to authenticated;
grant execute on function public.accept_friend_challenge(uuid) to authenticated;
grant execute on function public.get_challenge_history(integer) to authenticated;
