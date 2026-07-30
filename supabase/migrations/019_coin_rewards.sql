-- Coin reward amounts (keep in sync with src/constants/coins.ts)
-- Daily challenge: 50 coins
-- Friend speed race win: 20 coins

create or replace function public.complete_challenge(
  p_challenge_id uuid,
  p_completed_reps integer
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
  v_yesterday date := current_date - 1;
  v_yesterday_completed boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.status <> 'in_progress' then
    raise exception 'Challenge is not in progress';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  update public.daily_challenges
  set
    status = 'completed',
    completed_reps = p_completed_reps,
    completed_at = now()
  where id = p_challenge_id
  returning * into v_challenge;

  select exists (
    select 1
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed'
  )
  into v_yesterday_completed;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  if v_yesterday_completed then
    v_new_streak := v_current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  v_new_longest_streak := greatest(v_new_longest_streak, v_new_streak);
  v_new_total_xp := v_new_total_xp + v_challenge.xp_reward;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set
    total_xp = v_new_total_xp,
    level = v_new_level,
    current_streak = v_new_streak,
    longest_streak = v_new_longest_streak
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.award_coins(v_user_id, 50);

  return v_challenge;
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
  v_friend_win_coins constant integer := 20;
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
          perform public.award_coins(v_participant.user_id, v_friend_win_coins);
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
          perform public.award_coins(v_participant.user_id, v_friend_win_coins);
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
      perform public.award_coins(v_participant.user_id, v_friend_win_coins);
      update public.friend_challenge_participants
      set xp_earned = v_challenge.xp_reward
      where id = v_participant.id;
    end if;
  end if;
end;
$$;
