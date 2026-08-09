-- Allow authenticated users to view any user's public profile and achievements
-- (not limited to accepted friendships).

create or replace function public.get_friend_profile(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  level integer,
  total_xp integer,
  current_streak integer,
  longest_streak integer,
  avatar_url text,
  avatar_icon text,
  avatar_background text,
  frame_border_color text,
  frame_border_width integer
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

  if p_user_id is null then
    raise exception 'User not found';
  end if;

  return query
  select
    p.id as user_id,
    p.username,
    p.display_name,
    p.level,
    p.total_xp,
    p.current_streak,
    p.longest_streak,
    p.avatar_url,
    avatar_item.metadata->>'icon' as avatar_icon,
    avatar_item.metadata->>'backgroundColor' as avatar_background,
    frame_item.metadata->>'borderColor' as frame_border_color,
    nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width
  from public.profiles p
  left join public.user_equipped_items uei_avatar
    on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
  left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
  left join public.user_equipped_items uei_frame
    on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
  left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
  where p.id = p_user_id;
end;
$$;

create or replace function public.get_friend_achievements(p_user_id uuid)
returns table (
  id text,
  title text,
  description text,
  image_url text,
  icon text,
  xp_reward integer,
  sort_order integer,
  unlocked_at timestamptz
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

  if p_user_id is null then
    raise exception 'User not found';
  end if;

  return query
  select
    a.id,
    a.title,
    a.description,
    a.image_url,
    a.icon,
    a.xp_reward,
    a.sort_order,
    ua.unlocked_at
  from public.user_achievements ua
  join public.achievements a on a.id = ua.achievement_id
  where ua.user_id = p_user_id
    and a.is_active = true
  order by ua.unlocked_at desc, a.sort_order asc;
end;
$$;

grant execute on function public.get_friend_profile(uuid) to authenticated;
grant execute on function public.get_friend_achievements(uuid) to authenticated;
