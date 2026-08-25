-- For Time workouts: elapsed time storage, leaderboard, RPC updates, sample catalog workout.

alter table public.custom_workout_sessions
  add column if not exists elapsed_seconds integer check (elapsed_seconds is null or elapsed_seconds >= 0);

alter table public.custom_workout_templates
  drop constraint if exists custom_workout_templates_time_limit_seconds_check;

alter table public.custom_workout_templates
  add constraint custom_workout_templates_time_limit_seconds_check check (
    (workout_type = 'for_time'::public.custom_workout_type and time_limit_seconds = 0)
    or (
      workout_type <> 'for_time'::public.custom_workout_type
      and time_limit_seconds between 60 and 7200
    )
  );

alter table public.workout_catalog
  drop constraint if exists workout_catalog_time_limit_seconds_check;

-- Normalize existing catalog rows before adding stricter type/metric constraints.
update public.workout_catalog
set leaderboard_metric = 'most_rounds'::public.workout_leaderboard_metric
where workout_type = 'amrap'::public.custom_workout_type
  and (
    leaderboard_metric is null
    or leaderboard_metric <> 'most_rounds'::public.workout_leaderboard_metric
  );

update public.workout_catalog
set leaderboard_metric = null
where workout_type not in ('amrap'::public.custom_workout_type, 'for_time'::public.custom_workout_type)
  and leaderboard_metric is not null;

update public.workout_catalog
set
  leaderboard_metric = 'fastest_time'::public.workout_leaderboard_metric,
  time_limit_seconds = 0
where workout_type = 'for_time'::public.custom_workout_type;

alter table public.workout_catalog
  add constraint workout_catalog_time_limit_seconds_check check (
    (workout_type = 'for_time'::public.custom_workout_type and time_limit_seconds = 0)
    or (
      workout_type <> 'for_time'::public.custom_workout_type
      and time_limit_seconds between 60 and 7200
    )
  );

alter table public.workout_catalog
  drop constraint if exists workout_catalog_leaderboard_metric_check;

alter table public.workout_catalog
  add constraint workout_catalog_leaderboard_metric_check check (
    (
      workout_type = 'amrap'::public.custom_workout_type
      and leaderboard_metric = 'most_rounds'::public.workout_leaderboard_metric
    )
    or (
      workout_type = 'for_time'::public.custom_workout_type
      and leaderboard_metric = 'fastest_time'::public.workout_leaderboard_metric
    )
    or (
      workout_type not in ('amrap'::public.custom_workout_type, 'for_time'::public.custom_workout_type)
      and leaderboard_metric is null
    )
  );

create or replace function public.create_custom_workout_template(
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb,
  p_workout_type text default 'amrap'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_exercise jsonb;
  v_sort_order integer := 0;
  v_time_limit integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.user_has_premium_access(v_user_id) then
    raise exception 'Premium subscription required to create workouts';
  end if;

  if p_workout_type not in ('amrap', 'for_time') then
    raise exception 'Unsupported workout type';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  v_time_limit := case
    when p_workout_type = 'for_time' then 0
    else p_time_limit_seconds
  end;

  insert into public.custom_workout_templates (creator_id, title, workout_type, time_limit_seconds)
  values (
    v_user_id,
    trim(p_title),
    p_workout_type::public.custom_workout_type,
    v_time_limit
  )
  returning id into v_template_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    insert into public.custom_workout_template_exercises (
      template_id,
      sort_order,
      exercise_type,
      target_reps
    )
    values (
      v_template_id,
      v_sort_order,
      (v_exercise->>'exercise_type')::public.exercise_type,
      (v_exercise->>'target_reps')::integer
    );

    v_sort_order := v_sort_order + 1;
  end loop;

  return v_template_id;
end;
$$;

create or replace function public.update_custom_workout_template(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb,
  p_workout_type text default 'amrap'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise jsonb;
  v_sort_order integer := 0;
  v_time_limit integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.user_has_premium_access(v_user_id) then
    raise exception 'Premium subscription required to edit workouts';
  end if;

  if p_workout_type not in ('amrap', 'for_time') then
    raise exception 'Unsupported workout type';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  v_time_limit := case
    when p_workout_type = 'for_time' then 0
    else p_time_limit_seconds
  end;

  update public.custom_workout_templates
  set
    title = trim(p_title),
    workout_type = p_workout_type::public.custom_workout_type,
    time_limit_seconds = v_time_limit
  where id = p_template_id
    and creator_id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception 'Workout template not found';
  end if;

  delete from public.custom_workout_template_exercises
  where template_id = p_template_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    insert into public.custom_workout_template_exercises (
      template_id,
      sort_order,
      exercise_type,
      target_reps
    )
    values (
      p_template_id,
      v_sort_order,
      (v_exercise->>'exercise_type')::public.exercise_type,
      (v_exercise->>'target_reps')::integer
    );

    v_sort_order := v_sort_order + 1;
  end loop;
end;
$$;

drop function if exists public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz, uuid);

create or replace function public.save_custom_workout_session(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_total_reps integer,
  p_exercise_breakdown jsonb,
  p_started_at timestamptz,
  p_catalog_workout_id uuid default null,
  p_elapsed_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_total_reps integer;
  v_has_template_access boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (p_template_id is null and p_catalog_workout_id is null)
     or (p_template_id is not null and p_catalog_workout_id is not null) then
    raise exception 'Provide exactly one workout reference';
  end if;

  if p_catalog_workout_id is not null then
    if not exists (
      select 1
      from public.workout_catalog wc
      where wc.id = p_catalog_workout_id
        and wc.is_active = true
    ) then
      raise exception 'Workout not found';
    end if;
  end if;

  if p_template_id is not null then
    select exists (
      select 1
      from public.custom_workout_templates t
      where t.id = p_template_id
        and t.deleted_at is null
        and (
          t.creator_id = v_user_id
          or exists (
            select 1
            from public.custom_workout_template_shares s
            where s.template_id = p_template_id
              and s.shared_with_id = v_user_id
          )
        )
    )
    into v_has_template_access;

    if not v_has_template_access then
      raise exception 'Workout template not found';
    end if;
  end if;

  insert into public.custom_workout_sessions (
    user_id,
    template_id,
    catalog_workout_id,
    title,
    time_limit_seconds,
    completed_rounds,
    total_reps,
    exercise_breakdown,
    started_at,
    elapsed_seconds
  )
  values (
    v_user_id,
    p_template_id,
    p_catalog_workout_id,
    trim(p_title),
    p_time_limit_seconds,
    p_completed_rounds,
    p_total_reps,
    coalesce(p_exercise_breakdown, '[]'::jsonb),
    p_started_at,
    p_elapsed_seconds
  )
  returning id into v_session_id;

  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_exercise_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    v_total_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);

    if v_exercise is not null and v_total_reps > 0 then
      perform public.credit_daily_mission_reps(
        v_exercise,
        'custom_workout',
        v_session_id::text,
        v_total_reps
      );
    end if;
  end loop;

  return v_session_id;
end;
$$;

drop function if exists public.get_my_workout_sessions(uuid, uuid, integer);

create or replace function public.get_my_workout_sessions(
  p_catalog_workout_id uuid default null,
  p_template_id uuid default null,
  p_limit integer default 20
)
returns table (
  session_id uuid,
  title text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  completed_rounds integer,
  total_reps integer,
  elapsed_seconds integer,
  exercise_breakdown jsonb,
  started_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (p_catalog_workout_id is null and p_template_id is null)
     or (p_catalog_workout_id is not null and p_template_id is not null) then
    raise exception 'Provide exactly one workout reference';
  end if;

  return query
  select
    s.id,
    s.title,
    coalesce(wc.workout_type, t.workout_type, 'amrap'::public.custom_workout_type) as workout_type,
    s.time_limit_seconds,
    s.completed_rounds,
    s.total_reps,
    s.elapsed_seconds,
    s.exercise_breakdown,
    s.started_at,
    s.completed_at
  from public.custom_workout_sessions s
  left join public.workout_catalog wc on wc.id = s.catalog_workout_id
  left join public.custom_workout_templates t on t.id = s.template_id
  where s.user_id = v_user_id
    and (
      (p_catalog_workout_id is not null and s.catalog_workout_id = p_catalog_workout_id)
      or (p_template_id is not null and s.template_id = p_template_id)
    )
  order by s.completed_at desc
  limit v_limit;
end;
$$;

drop function if exists public.get_workout_catalog_detail(uuid);

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
  my_best_elapsed_seconds integer,
  my_session_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_metric public.workout_leaderboard_metric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select wc.leaderboard_metric
  into v_metric
  from public.workout_catalog wc
  where wc.id = p_catalog_workout_id
    and wc.is_active = true;

  if not found then
    raise exception 'Workout not found';
  end if;

  return query
  with my_stats as (
    select
      case
        when v_metric = 'fastest_time'::public.workout_leaderboard_metric then null::integer
        else best.completed_rounds::integer
      end as best_rounds,
      case
        when v_metric = 'fastest_time'::public.workout_leaderboard_metric then null::integer
        else best.total_reps::integer
      end as best_reps,
      case
        when v_metric = 'fastest_time'::public.workout_leaderboard_metric then best.elapsed_seconds::integer
        else null::integer
      end as best_elapsed,
      stats.session_count
    from (
      select count(*)::integer as session_count
      from public.custom_workout_sessions s
      where s.user_id = v_user_id
        and s.catalog_workout_id = p_catalog_workout_id
    ) stats
    left join lateral (
      select s.completed_rounds, s.total_reps, s.elapsed_seconds
      from public.custom_workout_sessions s
      where s.user_id = v_user_id
        and s.catalog_workout_id = p_catalog_workout_id
        and (
          (v_metric = 'fastest_time'::public.workout_leaderboard_metric and s.elapsed_seconds is not null)
          or v_metric <> 'fastest_time'::public.workout_leaderboard_metric
        )
      order by
        case
          when v_metric = 'fastest_time'::public.workout_leaderboard_metric then s.elapsed_seconds
          else null
        end asc nulls last,
        case
          when v_metric <> 'fastest_time'::public.workout_leaderboard_metric then s.completed_rounds
          else null
        end desc nulls last,
        case
          when v_metric <> 'fastest_time'::public.workout_leaderboard_metric then s.total_reps
          else null
        end desc nulls last,
        s.completed_at desc
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
    ms.best_elapsed,
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
  v_metric public.workout_leaderboard_metric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_period not in ('weekly', 'all_time') then
    raise exception 'Invalid leaderboard period';
  end if;

  select wc.leaderboard_metric
  into v_metric
  from public.workout_catalog wc
  where wc.id = p_catalog_workout_id
    and wc.is_active = true
    and wc.leaderboard_metric is not null;

  if not found then
    raise exception 'Leaderboard not available for this workout';
  end if;

  if v_metric = 'fastest_time'::public.workout_leaderboard_metric then
    if p_period = 'weekly' then
      return query
      with week_start as (
        select date_trunc('week', timezone('utc', now())) as starts_at
      ),
      session_scores as (
        select
          s.user_id,
          s.elapsed_seconds,
          s.completed_at
        from public.custom_workout_sessions s
        cross join week_start w
        where s.catalog_workout_id = p_catalog_workout_id
          and s.completed_at >= w.starts_at
          and s.elapsed_seconds is not null
      ),
      best_per_user as (
        select distinct on (ss.user_id)
          ss.user_id,
          ss.elapsed_seconds as score_amount,
          0 as tiebreak_amount
        from session_scores ss
        order by ss.user_id, ss.elapsed_seconds asc, ss.completed_at asc
      ),
      ranked as (
        select
          row_number() over (
            order by b.score_amount asc, p.username asc
          ) as rank,
          p.id as user_id,
          p.username,
          p.display_name,
          p.level,
          b.score_amount,
          b.tiebreak_amount,
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
        s.elapsed_seconds,
        s.completed_at
      from public.custom_workout_sessions s
      where s.catalog_workout_id = p_catalog_workout_id
        and s.elapsed_seconds is not null
    ),
    best_per_user as (
      select distinct on (ss.user_id)
        ss.user_id,
        ss.elapsed_seconds as score_amount,
        0 as tiebreak_amount
      from session_scores ss
      order by ss.user_id, ss.elapsed_seconds asc, ss.completed_at asc
    ),
    ranked as (
      select
        row_number() over (
          order by b.score_amount asc, p.username asc
        ) as rank,
        p.id as user_id,
        p.username,
        p.display_name,
        p.level,
        b.score_amount,
        b.tiebreak_amount,
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

insert into public.workout_catalog (
  title,
  description,
  workout_type,
  time_limit_seconds,
  leaderboard_metric,
  sort_order
)
select
  'Living Room Mash 96',
  'Complete 50 burpees, 50 push-ups, 250 squats, 50 push-ups, and 50 burpees. Fastest finish wins.',
  'for_time',
  0,
  'fastest_time'::public.workout_leaderboard_metric,
  2
where not exists (
  select 1
  from public.workout_catalog wc
  where wc.title = 'Living Room Mash 96'
    and wc.is_active = true
);

insert into public.workout_catalog_exercises (catalog_workout_id, sort_order, exercise_type, target_reps)
select wc.id, exercise.sort_order, exercise.exercise_type, exercise.target_reps
from public.workout_catalog wc
cross join (
  values
    (0, 'burpees'::public.exercise_type, 50),
    (1, 'push_ups'::public.exercise_type, 50),
    (2, 'squats'::public.exercise_type, 250),
    (3, 'push_ups'::public.exercise_type, 50),
    (4, 'burpees'::public.exercise_type, 50)
) as exercise(sort_order, exercise_type, target_reps)
where wc.title = 'Living Room Mash 96'
  and wc.is_active = true
  and not exists (
    select 1
    from public.workout_catalog_exercises wce
    where wce.catalog_workout_id = wc.id
  );

grant execute on function public.create_custom_workout_template(text, integer, jsonb, text) to authenticated;
grant execute on function public.update_custom_workout_template(uuid, text, integer, jsonb, text) to authenticated;
grant execute on function public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz, uuid, integer) to authenticated;
grant execute on function public.get_my_workout_sessions(uuid, uuid, integer) to authenticated;
grant execute on function public.get_workout_catalog_detail(uuid) to authenticated;
grant execute on function public.get_catalog_workout_leaderboard(uuid, text, integer) to authenticated;
