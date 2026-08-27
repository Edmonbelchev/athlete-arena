-- For Time friend workout challenges stored time_limit_seconds = 0 as a sentinel,
-- but friend_challenges_time_limit_seconds_check only allows null or 60-5400.
-- Use null for uncapped For Time races (fastest finish wins).

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
      when v_template.workout_type = 'for_time'::public.custom_workout_type then null
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
      when v_catalog.workout_type = 'for_time'::public.custom_workout_type then null
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

grant execute on function public.create_friend_workout_challenge(uuid, uuid, text, text) to authenticated;
grant execute on function public.create_friend_catalog_workout_challenge(uuid, uuid, text, text) to authenticated;
