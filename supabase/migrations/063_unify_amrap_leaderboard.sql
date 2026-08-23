-- Unify catalog AMRAP into Cindy AMRAP (20 min), ranked by rounds then reps.
-- Uses existing enum value most_rounds (no new enum values in this migration).

update public.workout_catalog
set is_active = false
where title in (
  'Arena AMRAP · Reps',
  'Arena AMRAP · Rounds',
  'Arena AMRAP'
);

update public.workout_catalog
set
  title = 'Cindy AMRAP',
  description = 'CrossFit benchmark: 5 pull-ups, 10 push-ups, 15 squats. Ranked by completed rounds, then reps when rounds are tied.',
  time_limit_seconds = 1200,
  leaderboard_metric = 'most_rounds'::public.workout_leaderboard_metric,
  sort_order = 1,
  is_active = true
where title in ('Arena AMRAP · Rounds', 'Arena AMRAP');

insert into public.workout_catalog (
  title,
  description,
  workout_type,
  time_limit_seconds,
  leaderboard_metric,
  sort_order
)
select
  'Cindy AMRAP',
  'CrossFit benchmark: 5 pull-ups, 10 push-ups, 15 squats. Ranked by completed rounds, then reps when rounds are tied.',
  'amrap',
  1200,
  'most_rounds'::public.workout_leaderboard_metric,
  1
where not exists (
  select 1
  from public.workout_catalog wc
  where wc.title = 'Cindy AMRAP'
    and wc.is_active = true
);

update public.workout_catalog
set
  description = 'CrossFit benchmark: 5 pull-ups, 10 push-ups, 15 squats. Ranked by completed rounds, then reps when rounds are tied.',
  time_limit_seconds = 1200,
  leaderboard_metric = 'most_rounds'::public.workout_leaderboard_metric,
  sort_order = 1,
  is_active = true
where title = 'Cindy AMRAP';

insert into public.workout_catalog_exercises (catalog_workout_id, sort_order, exercise_type, target_reps)
select wc.id, exercise.sort_order, exercise.exercise_type, exercise.target_reps
from public.workout_catalog wc
cross join (
  values
    (0, 'pull_ups'::public.exercise_type, 5),
    (1, 'push_ups'::public.exercise_type, 10),
    (2, 'squats'::public.exercise_type, 15)
) as exercise(sort_order, exercise_type, target_reps)
where wc.title = 'Cindy AMRAP'
  and wc.is_active = true
  and not exists (
    select 1
    from public.workout_catalog_exercises wce
    where wce.catalog_workout_id = wc.id
  );

create or replace function public.get_workout_catalog_detail(p_catalog_workout_id uuid)
returns table (
  catalog_workout_id uuid,
  title text,
  description text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  leaderboard_metric public.workout_leaderboard_metric,
  exercise_id uuid,
  sort_order integer,
  exercise_type public.exercise_type,
  target_reps integer,
  my_best_rounds integer,
  my_best_reps integer,
  my_session_count integer
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

  if not exists (
    select 1
    from public.workout_catalog wc
    where wc.id = p_catalog_workout_id
      and wc.is_active = true
  ) then
    raise exception 'Workout not found';
  end if;

  return query
  with my_stats as (
    select
      best.completed_rounds::integer as best_rounds,
      best.total_reps::integer as best_reps,
      stats.session_count
    from (
      select count(*)::integer as session_count
      from public.custom_workout_sessions s
      where s.user_id = v_user_id
        and s.catalog_workout_id = p_catalog_workout_id
    ) stats
    left join lateral (
      select s.completed_rounds, s.total_reps
      from public.custom_workout_sessions s
      where s.user_id = v_user_id
        and s.catalog_workout_id = p_catalog_workout_id
      order by s.completed_rounds desc, s.total_reps desc, s.completed_at desc
      limit 1
    ) best on true
  )
  select
    wc.id,
    wc.title,
    wc.description,
    wc.workout_type,
    wc.time_limit_seconds,
    wc.leaderboard_metric,
    wce.id,
    wce.sort_order,
    wce.exercise_type,
    wce.target_reps,
    ms.best_rounds,
    ms.best_reps,
    ms.session_count
  from public.workout_catalog wc
  cross join my_stats ms
  join public.workout_catalog_exercises wce on wce.catalog_workout_id = wc.id
  where wc.id = p_catalog_workout_id
  order by wce.sort_order asc;
end;
$$;

create or replace function public.get_catalog_workout_leaderboard(
  p_catalog_workout_id uuid,
  p_period text default 'all_time',
  p_limit integer default 50
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  level integer,
  score_amount integer,
  tiebreak_amount integer,
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

  if not exists (
    select 1
    from public.workout_catalog wc
    where wc.id = p_catalog_workout_id
      and wc.is_active = true
      and wc.leaderboard_metric is not null
  ) then
    raise exception 'Leaderboard not available for this workout';
  end if;

  if p_period = 'weekly' then
    return query
    with week_start as (
      select date_trunc('week', timezone('utc', now())) as starts_at
    ),
    session_scores as (
      select
        s.user_id,
        s.completed_rounds,
        s.total_reps,
        s.completed_at
      from public.custom_workout_sessions s
      cross join week_start w
      where s.catalog_workout_id = p_catalog_workout_id
        and s.completed_at >= w.starts_at
    ),
    best_per_user as (
      select distinct on (ss.user_id)
        ss.user_id,
        ss.completed_rounds as score_amount,
        ss.total_reps as tiebreak_amount
      from session_scores ss
      order by ss.user_id, ss.completed_rounds desc, ss.total_reps desc, ss.completed_at desc
    ),
    ranked as (
      select
        row_number() over (
          order by b.score_amount desc, coalesce(b.tiebreak_amount, 0) desc, p.username asc
        ) as rank,
        p.id as user_id,
        p.username,
        p.display_name,
        p.level,
        b.score_amount,
        coalesce(b.tiebreak_amount, 0) as tiebreak_amount,
        p.avatar_url,
        avatar_item.metadata->>'icon' as avatar_icon,
        avatar_item.metadata->>'backgroundColor' as avatar_background,
        frame_item.metadata->>'borderColor' as frame_border_color,
        nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
        (p.id = v_user_id) as is_current_user
      from best_per_user b
      join public.profiles p on p.id = b.user_id
      left join public.user_equipped_items uei_avatar
        on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
      left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
      left join public.user_equipped_items uei_frame
        on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
      left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
      where b.score_amount > 0
    )
    select *
    from ranked r
    where r.rank <= v_limit or r.is_current_user
    order by r.rank;

    return;
  end if;

  return query
  with session_scores as (
    select
      s.user_id,
      s.completed_rounds,
      s.total_reps,
      s.completed_at
    from public.custom_workout_sessions s
    where s.catalog_workout_id = p_catalog_workout_id
  ),
  best_per_user as (
    select distinct on (ss.user_id)
      ss.user_id,
      ss.completed_rounds as score_amount,
      ss.total_reps as tiebreak_amount
    from session_scores ss
    order by ss.user_id, ss.completed_rounds desc, ss.total_reps desc, ss.completed_at desc
  ),
  ranked as (
    select
      row_number() over (
        order by b.score_amount desc, coalesce(b.tiebreak_amount, 0) desc, p.username asc
      ) as rank,
      p.id as user_id,
      p.username,
      p.display_name,
      p.level,
      b.score_amount,
      coalesce(b.tiebreak_amount, 0) as tiebreak_amount,
      p.avatar_url,
      avatar_item.metadata->>'icon' as avatar_icon,
      avatar_item.metadata->>'backgroundColor' as avatar_background,
      frame_item.metadata->>'borderColor' as frame_border_color,
      nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
      (p.id = v_user_id) as is_current_user
    from best_per_user b
    join public.profiles p on p.id = b.user_id
    left join public.user_equipped_items uei_avatar
      on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
    left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
    left join public.user_equipped_items uei_frame
      on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
    left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
    where b.score_amount > 0
  )
  select *
  from ranked r
  where r.rank <= v_limit or r.is_current_user
  order by r.rank;
end;
$$;

grant execute on function public.get_workout_catalog_detail(uuid) to authenticated;
grant execute on function public.get_catalog_workout_leaderboard(uuid, text, integer) to authenticated;
