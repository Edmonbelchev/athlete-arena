-- Fix weekly leaderboard returning all-time rows as well (missing return after weekly query).

create or replace function public.get_xp_leaderboard(
  p_period text default 'weekly',
  p_limit integer default 50
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  level integer,
  xp_amount bigint,
  avatar_url text,
  avatar_icon text,
  avatar_background text,
  frame_border_color text,
  frame_border_width integer,
  is_current_user boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_period not in ('weekly', 'all_time') then
    raise exception 'Invalid leaderboard period';
  end if;

  if p_period = 'weekly' then
    return query
    with week_start as (
      select date_trunc('week', timezone('utc', now())) as starts_at
    ),
    weekly_totals as (
      select
        e.user_id,
        sum(e.amount)::bigint as xp_amount
      from public.xp_events e
      cross join week_start w
      where e.created_at >= w.starts_at
      group by e.user_id
      having sum(e.amount) > 0
    ),
    ranked as (
      select
        row_number() over (order by wt.xp_amount desc, p.username asc) as rank,
        p.id as user_id,
        p.username,
        p.display_name,
        p.level,
        wt.xp_amount,
        p.avatar_url,
        avatar_item.metadata->>'icon' as avatar_icon,
        avatar_item.metadata->>'backgroundColor' as avatar_background,
        frame_item.metadata->>'borderColor' as frame_border_color,
        nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
        (p.id = v_user_id) as is_current_user
      from weekly_totals wt
      join public.profiles p on p.id = wt.user_id
      left join public.user_equipped_items uei_avatar
        on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
      left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
      left join public.user_equipped_items uei_frame
        on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
      left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
    )
    select *
    from ranked r
    where r.rank <= v_limit or r.is_current_user
    order by r.rank;

    return;
  end if;

  return query
  with ranked as (
    select
      row_number() over (order by p.total_xp desc, p.username asc) as rank,
      p.id as user_id,
      p.username,
      p.display_name,
      p.level,
      p.total_xp::bigint as xp_amount,
      p.avatar_url,
      avatar_item.metadata->>'icon' as avatar_icon,
      avatar_item.metadata->>'backgroundColor' as avatar_background,
      frame_item.metadata->>'borderColor' as frame_border_color,
      nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
      (p.id = v_user_id) as is_current_user
    from public.profiles p
    left join public.user_equipped_items uei_avatar
      on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
    left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
    left join public.user_equipped_items uei_frame
      on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
    left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
    where p.total_xp > 0
  )
  select *
  from ranked r
  where r.rank <= v_limit or r.is_current_user
  order by r.rank;
end;
$$;

grant execute on function public.get_xp_leaderboard(text, integer) to authenticated;
