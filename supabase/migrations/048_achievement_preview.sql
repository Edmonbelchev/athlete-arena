-- Lightweight achievement preview for home/profile (recent unlocked only + counts).

create or replace function public.get_my_achievement_preview(p_limit integer default 3)
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'unlocked_count', (
      select count(*)::int
      from public.user_achievements ua
      join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = auth.uid()
        and a.is_active = true
    ),
    'total_count', (
      select count(*)::int
      from public.achievements a
      where a.is_active = true
    ),
    'recent_unlocked', coalesce(
      (
        select json_agg(preview order by preview.unlocked_at desc nulls last, preview.sort_order asc)
        from (
          select
            a.id,
            a.title,
            a.description,
            a.image_url,
            a.icon,
            a.requirements,
            a.xp_reward,
            a.coin_reward,
            a.sort_order,
            true as unlocked,
            ua.unlocked_at
          from public.user_achievements ua
          join public.achievements a on a.id = ua.achievement_id
          where ua.user_id = auth.uid()
            and a.is_active = true
          order by ua.unlocked_at desc nulls last, a.sort_order asc
          limit greatest(coalesce(p_limit, 3), 0)
        ) preview
      ),
      '[]'::json
    )
  );
$$;

grant execute on function public.get_my_achievement_preview(integer) to authenticated;
