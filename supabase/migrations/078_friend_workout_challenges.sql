-- Friend workout challenges + flat participation/winner reward model.

do $$ begin
  create type public.friend_challenge_kind as enum ('exercise', 'workout');
exception when duplicate_object then null;
end $$;

alter table public.friend_challenges
  add column if not exists challenge_kind public.friend_challenge_kind not null default 'exercise';

alter table public.friend_challenges
  add column if not exists template_id uuid references public.custom_workout_templates (id) on delete set null;

alter table public.friend_challenges
  add column if not exists workout_title text;

alter table public.friend_challenges
  add column if not exists workout_type public.custom_workout_type;

alter table public.friend_challenges
  add column if not exists structure_config jsonb;

alter table public.friend_challenges
  add column if not exists workout_exercises jsonb;

alter table public.friend_challenges
  alter column exercise_type drop not null;

alter table public.friend_challenges
  drop constraint if exists friend_challenges_target_reps_check;

alter table public.friend_challenges
  add constraint friend_challenges_target_reps_check check (
    target_reps > 0 and target_reps <= 1000
  );

alter table public.friend_challenges
  drop constraint if exists friend_challenges_kind_payload_check;

alter table public.friend_challenges
  add constraint friend_challenges_kind_payload_check check (
    (
      challenge_kind = 'exercise'::public.friend_challenge_kind
      and exercise_type is not null
      and target_reps > 0
    )
    or (
      challenge_kind = 'workout'::public.friend_challenge_kind
      and workout_title is not null
      and workout_type is not null
      and workout_exercises is not null
      and jsonb_typeof(workout_exercises) = 'array'
      and jsonb_array_length(workout_exercises) > 0
    )
  );

alter table public.friend_challenge_participants
  add column if not exists coins_earned integer not null default 0 check (coins_earned >= 0);

alter table public.friend_challenge_participants
  add column if not exists elapsed_seconds integer check (elapsed_seconds is null or elapsed_seconds >= 0);

alter table public.friend_challenge_participants
  add column if not exists completed_rounds integer check (completed_rounds is null or completed_rounds >= 0);

alter table public.friend_challenge_participants
  add column if not exists workout_total_reps integer check (workout_total_reps is null or workout_total_reps >= 0);

alter table public.friend_challenge_participants
  add column if not exists winner_bonus_awarded boolean not null default false;

create or replace function public.friend_challenge_participation_xp()
returns integer
language sql
immutable
as $$
  select 150;
$$;

create or replace function public.friend_challenge_participation_coins()
returns integer
language sql
immutable
as $$
  select 100;
$$;

create or replace function public.friend_challenge_winner_bonus_xp()
returns integer
language sql
immutable
as $$
  select 100;
$$;

create or replace function public.friend_challenge_winner_bonus_coins()
returns integer
language sql
immutable
as $$
  select 50;
$$;

create or replace function public.award_friend_challenge_participation(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.friend_challenge_participants;
  v_participation_xp integer := public.friend_challenge_participation_xp();
  v_participation_coins integer := public.friend_challenge_participation_coins();
begin
  select *
  into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id
  for update;

  if not found or v_participant.status <> 'completed'::public.challenge_status then
    return;
  end if;

  if coalesce(v_participant.xp_earned, 0) > 0 or coalesce(v_participant.coins_earned, 0) > 0 then
    return;
  end if;

  perform public.award_friend_challenge_xp(v_participant.user_id, v_participation_xp);
  perform public.award_coins(v_participant.user_id, v_participation_coins);

  update public.friend_challenge_participants
  set
    xp_earned = v_participation_xp,
    coins_earned = v_participation_coins
  where id = p_participant_id;
end;
$$;

create or replace function public.award_friend_challenge_winner_bonus(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.friend_challenge_participants;
  v_bonus_xp integer := public.friend_challenge_winner_bonus_xp();
  v_bonus_coins integer := public.friend_challenge_winner_bonus_coins();
begin
  select *
  into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id
  for update;

  if not found or v_participant.winner_bonus_awarded then
    return;
  end if;

  perform public.award_friend_challenge_xp(v_participant.user_id, v_bonus_xp);
  perform public.award_coins(v_participant.user_id, v_bonus_coins);

  update public.friend_challenge_participants
  set
    xp_earned = coalesce(xp_earned, 0) + v_bonus_xp,
    coins_earned = coalesce(coins_earned, 0) + v_bonus_coins,
    winner_bonus_awarded = true
  where id = p_participant_id;
end;
$$;

create or replace function public.compare_friend_workout_results(
  p_left_rounds integer,
  p_left_reps integer,
  p_left_elapsed integer,
  p_right_rounds integer,
  p_right_reps integer,
  p_right_elapsed integer,
  p_workout_type public.custom_workout_type
)
returns integer
language plpgsql
immutable
as $$
begin
  if p_workout_type = 'for_time'::public.custom_workout_type then
    if p_left_elapsed is null and p_right_elapsed is null then
      return 0;
    end if;

    if p_left_elapsed is null then
      return 1;
    end if;

    if p_right_elapsed is null then
      return -1;
    end if;

    if p_left_elapsed < p_right_elapsed then
      return -1;
    elsif p_left_elapsed > p_right_elapsed then
      return 1;
    end if;

    return 0;
  end if;

  if coalesce(p_left_rounds, 0) <> coalesce(p_right_rounds, 0) then
    return case when coalesce(p_left_rounds, 0) > coalesce(p_right_rounds, 0) then -1 else 1 end;
  end if;

  if coalesce(p_left_reps, 0) <> coalesce(p_right_reps, 0) then
    return case when coalesce(p_left_reps, 0) > coalesce(p_right_reps, 0) then -1 else 1 end;
  end if;

  if p_left_elapsed is null or p_right_elapsed is null then
    return 0;
  end if;

  if p_left_elapsed < p_right_elapsed then
    return -1;
  elsif p_left_elapsed > p_right_elapsed then
    return 1;
  end if;

  return 0;
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
  v_winner_participant_id uuid;
  v_participant record;
  v_opponent record;
  v_compare integer;
begin
  select * into v_challenge
  from public.friend_challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.resolved_at is not null then
    return;
  end if;

  select p.*
  into v_participant
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.status = 'completed'::public.challenge_status
  order by p.completed_at asc nulls last
  limit 1;

  if not found then
    return;
  end if;

  select p.*
  into v_opponent
  from public.friend_challenge_participants p
  where p.challenge_id = p_challenge_id
    and p.id <> v_participant.id;

  if v_opponent.status = 'completed'::public.challenge_status then
    if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
      v_compare := public.compare_friend_workout_results(
        v_participant.completed_rounds,
        v_participant.workout_total_reps,
        v_participant.elapsed_seconds,
        v_opponent.completed_rounds,
        v_opponent.workout_total_reps,
        v_opponent.elapsed_seconds,
        v_challenge.workout_type
      );
    else
      v_compare := case
        when public.participant_race_seconds(v_participant.started_at, v_participant.completed_at)
             < public.participant_race_seconds(v_opponent.started_at, v_opponent.completed_at) then -1
        when public.participant_race_seconds(v_participant.started_at, v_participant.completed_at)
             > public.participant_race_seconds(v_opponent.started_at, v_opponent.completed_at) then 1
        else 0
      end;
    end if;

    update public.friend_challenges
    set resolved_at = now()
    where id = p_challenge_id;

    if v_compare = 0 then
      for v_participant in
        select * from public.friend_challenge_participants
        where challenge_id = p_challenge_id and status = 'completed'::public.challenge_status
      loop
        perform public.award_friend_challenge_winner_bonus(v_participant.id);
      end loop;

      return;
    end if;

    if v_compare > 0 then
      v_winner_id := v_opponent.user_id;
      v_winner_participant_id := v_opponent.id;
    else
      v_winner_id := v_participant.user_id;
      v_winner_participant_id := v_participant.id;
    end if;

    update public.friend_challenges
    set winner_user_id = v_winner_id
    where id = p_challenge_id;

    perform public.award_friend_challenge_winner_bonus(v_winner_participant_id);
    return;
  end if;

  if v_opponent.status in ('expired'::public.challenge_status, 'declined'::public.challenge_status) then
    update public.friend_challenges
    set winner_user_id = v_participant.user_id, resolved_at = now()
    where id = p_challenge_id;

    perform public.award_friend_challenge_winner_bonus(v_participant.id);
  end if;
end;
$$;

create or replace function public.create_friend_workout_challenge(
  p_friend_id uuid,
  p_template_id uuid,
  p_message text default null,
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
  v_participant_id uuid;
  v_template public.custom_workout_templates;
  v_exercises jsonb := '[]'::jsonb;
  v_exercise record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  select *
  into v_template
  from public.custom_workout_templates t
  where t.id = p_template_id
    and t.deleted_at is null
    and (
      t.creator_id = v_user_id
      or exists (
        select 1
        from public.custom_workout_template_shares s
        where s.template_id = t.id
          and s.shared_with_id = v_user_id
      )
    );

  if not found then
    raise exception 'Workout template not found';
  end if;

  if v_template.workout_type not in ('amrap'::public.custom_workout_type, 'for_time'::public.custom_workout_type) then
    raise exception 'Unsupported workout type for friend challenges';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exercise_type', e.exercise_type,
        'target_reps', e.target_reps
      )
      order by e.sort_order asc
    ),
    '[]'::jsonb
  )
  into v_exercises
  from public.custom_workout_template_exercises e
  where e.template_id = p_template_id;

  if jsonb_array_length(v_exercises) = 0 then
    raise exception 'Workout must include at least one exercise';
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

  insert into public.friend_challenges (
    creator_id,
    challenge_kind,
    exercise_type,
    target_reps,
    xp_reward,
    message,
    creator_emote_id,
    template_id,
    workout_title,
    workout_type,
    structure_config,
    workout_exercises,
    time_limit_seconds
  )
  values (
    v_user_id,
    'workout'::public.friend_challenge_kind,
    null,
    1,
    public.friend_challenge_participation_xp(),
    nullif(trim(p_message), ''),
    p_emote_id,
    p_template_id,
    v_template.title,
    v_template.workout_type,
    v_template.structure_config,
    v_exercises,
    case
      when v_template.workout_type = 'for_time'::public.custom_workout_type then 0
      else v_template.time_limit_seconds
    end
  )
  returning id into v_challenge_id;

  insert into public.friend_challenge_participants (challenge_id, user_id, status)
  values
    (v_challenge_id, v_user_id, 'in_progress'::public.challenge_status),
    (v_challenge_id, p_friend_id, 'pending'::public.challenge_status);

  select p.id
  into v_participant_id
  from public.friend_challenge_participants p
  where p.challenge_id = v_challenge_id
    and p.user_id = p_friend_id;

  perform public.enqueue_push_notification(
    p_friend_id,
    'Workout challenge',
    public.format_profile_short_name(v_user_id)
      || ' challenged you to '
      || v_template.title,
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
      when v_challenge.workout_type = 'for_time'::public.custom_workout_type then greatest(coalesce(p_elapsed_seconds, 0), 0)
      else elapsed_seconds
    end,
    completed_reps = greatest(coalesce(p_total_reps, 0), 0)
  where id = p_participant_id
  returning * into v_participant;

  perform public.award_friend_challenge_participation(p_participant_id);
  perform public.resolve_friend_challenge_race(v_challenge.id);

  select * into v_participant
  from public.friend_challenge_participants
  where id = p_participant_id;

  return v_participant;
end;
$$;

-- Patch exercise completion to award participation rewards.
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
  v_previous_reps integer;
  v_new_reps integer;
  v_delta integer;
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

  if v_participant.status = 'expired'::public.challenge_status then
    raise exception 'Challenge expired';
  end if;

  select * into v_challenge
  from public.friend_challenges
  where id = v_participant.challenge_id;

  if v_challenge.challenge_kind = 'workout'::public.friend_challenge_kind then
    raise exception 'Use workout completion for this challenge';
  end if;

  if v_participant.status = 'completed'::public.challenge_status then
    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
    return v_participant;
  end if;

  if v_participant.status = 'pending'::public.challenge_status then
    raise exception 'Accept the challenge before completing reps';
  end if;

  v_previous_reps := v_participant.completed_reps;

  if v_participant.started_at is null then
    if p_completed_reps < 1 then
      raise exception 'Complete at least one rep to start the timer';
    end if;

    update public.friend_challenge_participants
    set
      started_at = now(),
      completed_reps = greatest(p_completed_reps, completed_reps)
    where id = p_participant_id
    returning * into v_participant;

    v_new_reps := v_participant.completed_reps;
    v_delta := greatest(v_new_reps - v_previous_reps, 0);

    if v_delta > 0 then
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );

      perform public.credit_daily_mission_reps(
        v_challenge.exercise_type,
        'friend_challenge',
        p_participant_id::text,
        v_participant.completed_reps
      );
    end if;

    if p_completed_reps >= v_challenge.target_reps then
      update public.friend_challenge_participants
      set
        completed_reps = v_challenge.target_reps,
        status = 'completed'::public.challenge_status,
        completed_at = coalesce(completed_at, now())
      where id = p_participant_id
      returning * into v_participant;

      perform public.award_friend_challenge_participation(p_participant_id);
      perform public.resolve_friend_challenge_race(v_challenge.id);
    end if;

    return v_participant;
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

    v_new_reps := v_participant.completed_reps;
    v_delta := greatest(v_new_reps - v_previous_reps, 0);

    if v_delta > 0 then
      perform public.credit_user_goal_progress_for_exercise(
        v_user_id,
        v_challenge.exercise_type,
        v_delta,
        'friend_challenge',
        p_participant_id::text
      );

      perform public.credit_daily_mission_reps(
        v_challenge.exercise_type,
        'friend_challenge',
        p_participant_id::text,
        v_participant.completed_reps
      );
    end if;

    return v_participant;
  end if;

  update public.friend_challenge_participants
  set
    completed_reps = v_challenge.target_reps,
    status = 'completed'::public.challenge_status,
    completed_at = coalesce(completed_at, now())
  where id = p_participant_id
  returning * into v_participant;

  v_new_reps := v_participant.completed_reps;
  v_delta := greatest(v_new_reps - v_previous_reps, 0);

  if v_delta > 0 then
    perform public.credit_user_goal_progress_for_exercise(
      v_user_id,
      v_challenge.exercise_type,
      v_delta,
      'friend_challenge',
      p_participant_id::text
    );

    perform public.credit_daily_mission_reps(
      v_challenge.exercise_type,
      'friend_challenge',
      p_participant_id::text,
      v_participant.completed_reps
    );
  end if;

  perform public.award_friend_challenge_participation(p_participant_id);
  perform public.resolve_friend_challenge_race(v_challenge.id);

  return v_participant;
end;
$$;

-- Extend list/detail RPC return shapes.
drop function if exists public.get_my_friend_challenges();
drop function if exists public.get_friend_challenge_detail(uuid);
drop function if exists public.get_friend_challenges_with_user(uuid);

create or replace function public.get_my_friend_challenges()
returns table (
  participant_id uuid,
  challenge_id uuid,
  challenge_kind public.friend_challenge_kind,
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
  coins_earned integer,
  elapsed_seconds integer,
  completed_rounds integer,
  workout_total_reps integer,
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
  opponent_elapsed_seconds integer,
  opponent_completed_rounds integer,
  opponent_workout_total_reps integer,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text,
  template_id uuid,
  workout_title text,
  workout_type public.custom_workout_type,
  structure_config jsonb,
  workout_exercises jsonb
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
    fc.challenge_kind,
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
    mine.coins_earned,
    mine.elapsed_seconds,
    mine.completed_rounds,
    mine.workout_total_reps,
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
    opponent.elapsed_seconds as opponent_elapsed_seconds,
    opponent.completed_rounds as opponent_completed_rounds,
    opponent.workout_total_reps as opponent_workout_total_reps,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji,
    fc.template_id,
    fc.workout_title,
    fc.workout_type,
    fc.structure_config,
    fc.workout_exercises
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.user_id = v_user_id
  order by fc.created_at desc;
end;
$$;

create or replace function public.get_friend_challenge_detail(p_participant_id uuid)
returns table (
  participant_id uuid,
  challenge_id uuid,
  challenge_kind public.friend_challenge_kind,
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
  coins_earned integer,
  elapsed_seconds integer,
  completed_rounds integer,
  workout_total_reps integer,
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
  opponent_elapsed_seconds integer,
  opponent_completed_rounds integer,
  opponent_workout_total_reps integer,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text,
  template_id uuid,
  workout_title text,
  workout_type public.custom_workout_type,
  structure_config jsonb,
  workout_exercises jsonb
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
    fc.challenge_kind,
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
    mine.coins_earned,
    mine.elapsed_seconds,
    mine.completed_rounds,
    mine.workout_total_reps,
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
    opponent.elapsed_seconds as opponent_elapsed_seconds,
    opponent.completed_rounds as opponent_completed_rounds,
    opponent.workout_total_reps as opponent_workout_total_reps,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji,
    fc.template_id,
    fc.workout_title,
    fc.workout_type,
    fc.structure_config,
    fc.workout_exercises
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.id = p_participant_id and mine.user_id = v_user_id;
end;
$$;

create or replace function public.get_friend_challenges_with_user(p_friend_id uuid)
returns table (
  participant_id uuid,
  challenge_id uuid,
  challenge_kind public.friend_challenge_kind,
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
  coins_earned integer,
  elapsed_seconds integer,
  completed_rounds integer,
  workout_total_reps integer,
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
  opponent_elapsed_seconds integer,
  opponent_completed_rounds integer,
  opponent_workout_total_reps integer,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text,
  template_id uuid,
  workout_title text,
  workout_type public.custom_workout_type,
  structure_config jsonb,
  workout_exercises jsonb
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
  where g.opponent_id = p_friend_id;
end;
$$;

grant execute on function public.create_friend_workout_challenge(uuid, uuid, text, text) to authenticated;
grant execute on function public.complete_friend_workout_challenge(uuid, timestamptz, integer, integer, integer) to authenticated;
grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.get_friend_challenge_detail(uuid) to authenticated;
grant execute on function public.get_friend_challenges_with_user(uuid) to authenticated;
