-- Workout share notifications, sharer metadata on list, and dismiss shared templates.

alter table public.custom_workout_template_shares replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.custom_workout_template_shares;
exception
  when duplicate_object then null;
end $$;

drop function if exists public.get_my_custom_workout_templates();

create or replace function public.get_my_custom_workout_templates()
returns table (
  template_id uuid,
  title text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  exercise_count integer,
  created_at timestamptz,
  is_owner boolean,
  creator_username text,
  creator_display_name text,
  shared_at timestamptz
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
    t.id as template_id,
    t.title,
    t.workout_type,
    t.time_limit_seconds,
    count(e.id)::integer as exercise_count,
    t.created_at,
    (t.creator_id = v_user_id) as is_owner,
    case when t.creator_id = v_user_id then null else p.username end as creator_username,
    case when t.creator_id = v_user_id then null else p.display_name end as creator_display_name,
    s.created_at as shared_at
  from public.custom_workout_templates t
  left join public.custom_workout_template_exercises e on e.template_id = t.id
  left join public.profiles p on p.id = t.creator_id
  left join public.custom_workout_template_shares s
    on s.template_id = t.id
   and s.shared_with_id = v_user_id
  where t.creator_id = v_user_id
     or s.id is not null
  group by
    t.id,
    t.title,
    t.workout_type,
    t.time_limit_seconds,
    t.created_at,
    t.creator_id,
    p.username,
    p.display_name,
    s.created_at
  order by coalesce(s.created_at, t.created_at) desc;
end;
$$;

grant execute on function public.get_my_custom_workout_templates() to authenticated;

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

  select t.title
  into v_template_title
  from public.custom_workout_templates t
  where t.id = p_template_id
    and t.creator_id = v_user_id;

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
        'url', '/workouts'
      )
    );
  end if;
end;
$$;

create or replace function public.dismiss_shared_workout_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.custom_workout_template_shares
  where template_id = p_template_id
    and shared_with_id = v_user_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Shared workout not found';
  end if;
end;
$$;

grant execute on function public.dismiss_shared_workout_template(uuid) to authenticated;
