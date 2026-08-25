-- Allow friend workout challenges from Arena catalog workouts.

alter table public.friend_challenges
  add column if not exists catalog_workout_id uuid references public.workout_catalog (id) on delete set null;

create or replace function public.create_friend_catalog_workout_challenge(
  p_friend_id uuid,
  p_catalog_workout_id uuid,
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
  v_catalog public.workout_catalog;
  v_exercises jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  select *
  into v_catalog
  from public.workout_catalog wc
  where wc.id = p_catalog_workout_id
    and wc.is_active = true;

  if not found then
    raise exception 'Arena workout not found';
  end if;

  if v_catalog.workout_type not in ('amrap'::public.custom_workout_type, 'for_time'::public.custom_workout_type) then
    raise exception 'Unsupported workout type for friend challenges';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exercise_type', wce.exercise_type,
        'target_reps', wce.target_reps
      )
      order by wce.sort_order asc
    ),
    '[]'::jsonb
  )
  into v_exercises
  from public.workout_catalog_exercises wce
  where wce.catalog_workout_id = p_catalog_workout_id;

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
    catalog_workout_id,
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
    null,
    p_catalog_workout_id,
    v_catalog.title,
    v_catalog.workout_type,
    v_catalog.structure_config,
    v_exercises,
    case
      when v_catalog.workout_type = 'for_time'::public.custom_workout_type then 0
      else v_catalog.time_limit_seconds
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
      || v_catalog.title,
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
  catalog_workout_id uuid,
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
    fc.catalog_workout_id,
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
  catalog_workout_id uuid,
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
    fc.catalog_workout_id,
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
  where mine.id = p_participant_id
    and mine.user_id = v_user_id;
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
  catalog_workout_id uuid,
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

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'Not friends';
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
    fc.catalog_workout_id,
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
    and opponent.user_id = p_friend_id
  order by fc.created_at desc;
end;
$$;

grant execute on function public.create_friend_catalog_workout_challenge(uuid, uuid, text, text) to authenticated;
grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.get_friend_challenge_detail(uuid) to authenticated;
grant execute on function public.get_friend_challenges_with_user(uuid) to authenticated;
