-- Fix workout share push deep link to open My Workouts library with preview.

create or replace function public.share_custom_workout_template(
  p_template_id uuid,
  p_friend_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_title text;
  v_share_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.user_has_premium_access(v_user_id) then
    raise exception 'Premium subscription required to share workouts';
  end if;

  select t.title
  into v_template_title
  from public.custom_workout_templates t
  where t.id = p_template_id
    and t.creator_id = v_user_id
    and t.deleted_at is null;

  if not found then
    raise exception 'Workout template not found';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only share workouts with friends';
  end if;

  insert into public.custom_workout_template_shares (template_id, owner_id, shared_with_id)
  values (p_template_id, v_user_id, p_friend_id)
  on conflict (template_id, shared_with_id) do nothing
  returning id into v_share_id;

  if v_share_id is not null then
    perform public.enqueue_push_notification(
      p_friend_id,
      'Workout shared with you',
      public.format_profile_short_name(v_user_id) || ' shared "' || v_template_title || '" with you',
      jsonb_build_object(
        'type', 'workout_shared',
        'templateId', p_template_id,
        'url', '/(tabs)/workouts/library?templateId=' || p_template_id::text
      )
    );
  end if;
end;
$$;
