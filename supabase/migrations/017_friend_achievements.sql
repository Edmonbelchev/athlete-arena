-- Friend-visible unlocked achievements.

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

  if p_user_id <> v_user_id and not public.users_are_friends(v_user_id, p_user_id) then
    raise exception 'You can only view friend achievements';
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

grant execute on function public.get_friend_achievements(uuid) to authenticated;
