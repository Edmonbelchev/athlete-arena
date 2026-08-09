-- Daily missions: flat 50 XP + 20 coins per completion.
-- Friend races: per-exercise rep scaling, max 200 XP and 50 coins.

drop function if exists public.calculate_friend_challenge_xp(integer);

create or replace function public.calculate_friend_challenge_xp(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_reps integer := greatest(coalesce(p_reps, 0), 0);
  v_xp integer;
begin
  case p_exercise
    when 'push_ups' then
      v_xp := v_reps * 2;
    when 'squats' then
      v_xp := v_reps * 1;
    when 'pull_ups' then
      v_xp := v_reps * 3;
    else
      raise exception 'Unsupported exercise for friend challenge XP: %', p_exercise;
  end case;

  return least(v_xp, 200);
end;
$$;

create or replace function public.calculate_friend_challenge_coins(
  p_exercise public.exercise_type,
  p_reps integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_reps integer := greatest(coalesce(p_reps, 0), 0);
  v_coins integer;
begin
  case p_exercise
    when 'push_ups' then
      v_coins := v_reps / 5;
    when 'squats' then
      v_coins := v_reps / 10;
    when 'pull_ups' then
      v_coins := v_reps / 3;
    else
      raise exception 'Unsupported exercise for friend challenge coins: %', p_exercise;
  end case;

  return least(v_coins, 50);
end;
$$;

create or replace function public.ensure_daily_mission_templates(
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_number bigint;
  v_mission_index integer;
  v_exercise public.exercise_type;
  v_tier_roll integer;
  v_target_reps integer;
  v_exercises public.exercise_type[] := array[
    'push_ups'::public.exercise_type,
    'squats'::public.exercise_type,
    'pull_ups'::public.exercise_type
  ];
begin
  v_day_number := (extract(epoch from p_date::timestamptz)::bigint / 86400)::bigint;

  for v_mission_index in 0..2 loop
    v_exercise := v_exercises[v_mission_index + 1];
    v_tier_roll := ((v_day_number + v_mission_index * 17) % 4)::integer;

    select tier.target_reps
    into v_target_reps
    from public.pick_daily_mission_tier(v_exercise, v_tier_roll) as tier;

    insert into public.daily_challenge_templates (
      challenge_date,
      exercise_type,
      target_reps,
      xp_reward,
      mission_index,
      catalog_slot
    )
    values (
      p_date,
      v_exercise,
      v_target_reps,
      50,
      v_mission_index,
      null
    )
    on conflict (challenge_date, mission_index) do update
    set
      exercise_type = excluded.exercise_type,
      target_reps = excluded.target_reps,
      xp_reward = 50;
  end loop;
end;
$$;

create or replace function public.get_or_create_daily_challenge(
  p_mission_index integer default 0
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_template public.daily_challenge_templates;
  v_challenge public.daily_challenges;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today
    and mission_index = p_mission_index;

  if found then
    return v_challenge;
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = v_today
    and mission_index = p_mission_index;

  if not found then
    raise exception 'Daily mission template not found';
  end if;

  insert into public.daily_challenges (
    user_id,
    exercise_type,
    target_reps,
    xp_reward,
    challenge_date,
    mission_index
  )
  values (
    v_user_id,
    v_template.exercise_type,
    v_template.target_reps,
    50,
    v_today,
    p_mission_index
  )
  on conflict (user_id, challenge_date, mission_index) do nothing
  returning * into v_challenge;

  if v_challenge.id is null then
    select *
    into v_challenge
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_today
      and mission_index = p_mission_index;
  end if;

  return v_challenge;
end;
$$;

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
  v_yesterday_all_complete boolean;
  v_all_missions_complete boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
  v_earned_xp constant integer := 50;
  v_earned_coins constant integer := 20;
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
    xp_reward = v_earned_xp,
    completed_at = now()
  where id = p_challenge_id
  returning * into v_challenge;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  v_new_total_xp := v_new_total_xp + v_earned_xp;
  v_new_level := public.calculate_level(v_new_total_xp);

  select count(*) = 3
  into v_all_missions_complete
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_challenge.challenge_date
    and status = 'completed';

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  if v_all_missions_complete then
    select count(*) = 3
    into v_yesterday_all_complete
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed';

    if v_yesterday_all_complete then
      v_new_streak := v_current_streak + 1;
    else
      v_new_streak := 1;
    end if;

    v_new_longest_streak := greatest(v_new_longest_streak, v_new_streak);

    update public.profiles
    set
      total_xp = v_new_total_xp,
      level = v_new_level,
      current_streak = v_new_streak,
      longest_streak = v_new_longest_streak
    where id = v_user_id;
  else
    update public.profiles
    set
      total_xp = v_new_total_xp,
      level = v_new_level
    where id = v_user_id;
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.log_xp_event(
    v_user_id,
    v_earned_xp,
    'daily_challenge',
    v_challenge.id::text
  );

  perform public.award_coins(v_user_id, v_earned_coins);

  return v_challenge;
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

  return v_challenge_id;
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
  v_reward_xp integer;
  v_reward_coins integer;
  v_consolation_xp integer;
begin
  select * into v_challenge
  from public.friend_challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.resolved_at is not null then
    return;
  end if;

  v_reward_xp := public.calculate_friend_challenge_xp(v_challenge.exercise_type, v_challenge.target_reps);
  v_reward_coins := public.calculate_friend_challenge_coins(v_challenge.exercise_type, v_challenge.target_reps);
  v_consolation_xp := greatest(1, floor(v_reward_xp * 0.25)::integer);

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
          perform public.award_friend_challenge_xp(v_participant.user_id, v_reward_xp);
          perform public.award_coins(v_participant.user_id, v_reward_coins);
          update public.friend_challenge_participants
          set xp_earned = v_reward_xp
          where id = v_participant.id;
        end if;
      end loop;

      return;
    else
      v_winner_id := v_participant.user_id;
    end if;

    update public.friend_challenges
    set winner_user_id = v_winner_id, resolved_at = now()
    where id = p_challenge_id;

    for v_participant in
      select * from public.friend_challenge_participants
      where challenge_id = p_challenge_id and status = 'completed'
    loop
      if coalesce(v_participant.xp_earned, 0) = 0 then
        if v_participant.user_id = v_winner_id then
          perform public.award_friend_challenge_xp(v_participant.user_id, v_reward_xp);
          perform public.award_coins(v_participant.user_id, v_reward_coins);
          update public.friend_challenge_participants
          set xp_earned = v_reward_xp
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
      perform public.award_friend_challenge_xp(v_participant.user_id, v_reward_xp);
      perform public.award_coins(v_participant.user_id, v_reward_coins);
      update public.friend_challenge_participants
      set xp_earned = v_reward_xp
      where id = v_participant.id;
    end if;
  end if;
end;
$$;

update public.daily_challenge_templates
set xp_reward = 50
where challenge_date >= current_date;

update public.daily_challenges
set xp_reward = 50
where challenge_date >= current_date
  and status <> 'completed';

grant execute on function public.calculate_friend_challenge_xp(public.exercise_type, integer) to authenticated;
grant execute on function public.calculate_friend_challenge_coins(public.exercise_type, integer) to authenticated;
