-- For Time rep ladder structure: compact authoring config stored on templates and catalog workouts.

alter table public.custom_workout_templates
  add column if not exists structure_config jsonb;

alter table public.workout_catalog
  add column if not exists structure_config jsonb;

alter table public.custom_workout_templates
  drop constraint if exists custom_workout_templates_structure_config_check;

alter table public.custom_workout_templates
  add constraint custom_workout_templates_structure_config_check check (
    structure_config is null
    or (
      structure_config->>'structure' = 'ladder'
      and jsonb_typeof(structure_config->'repScheme') = 'array'
      and jsonb_array_length(structure_config->'repScheme') > 0
    )
    or structure_config->>'structure' = 'linear'
  );

alter table public.workout_catalog
  drop constraint if exists workout_catalog_structure_config_check;

alter table public.workout_catalog
  add constraint workout_catalog_structure_config_check check (
    structure_config is null
    or (
      structure_config->>'structure' = 'ladder'
      and jsonb_typeof(structure_config->'repScheme') = 'array'
      and jsonb_array_length(structure_config->'repScheme') > 0
    )
    or structure_config->>'structure' = 'linear'
  );

drop function if exists public.create_custom_workout_template(text, integer, jsonb, text);

create or replace function public.create_custom_workout_template(
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb,
  p_workout_type text default 'amrap',
  p_structure_config jsonb default null
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

  insert into public.custom_workout_templates (
    creator_id,
    title,
    workout_type,
    time_limit_seconds,
    structure_config
  )
  values (
    v_user_id,
    trim(p_title),
    p_workout_type::public.custom_workout_type,
    v_time_limit,
    p_structure_config
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

drop function if exists public.update_custom_workout_template(uuid, text, integer, jsonb, text);

create or replace function public.update_custom_workout_template(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_exercises jsonb,
  p_workout_type text default 'amrap',
  p_structure_config jsonb default null
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
    time_limit_seconds = v_time_limit,
    structure_config = p_structure_config
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

drop function if exists public.get_custom_workout_template_detail(uuid);

create or replace function public.get_custom_workout_template_detail(p_template_id uuid)
returns table (
  template_id uuid,
  title text,
  workout_type public.custom_workout_type,
  time_limit_seconds integer,
  structure_config jsonb,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_owner boolean,
  exercise_id uuid,
  sort_order integer,
  exercise_type public.exercise_type,
  target_reps integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_id uuid;
  v_is_owner boolean;
  v_has_share boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select t.creator_id
  into v_creator_id
  from public.custom_workout_templates t
  where t.id = p_template_id;

  if not found then
    raise exception 'Workout template not found';
  end if;

  v_is_owner := v_creator_id = v_user_id;
  v_has_share := exists (
    select 1
    from public.custom_workout_template_shares s
    where s.template_id = p_template_id
      and s.shared_with_id = v_user_id
  );

  if v_is_owner then
    if not exists (
      select 1
      from public.custom_workout_templates t
      where t.id = p_template_id
        and t.creator_id = v_user_id
        and t.deleted_at is null
    ) then
      raise exception 'Workout template not found';
    end if;
  elsif not v_has_share then
    raise exception 'Workout template not found';
  end if;

  return query
  select
    t.id as template_id,
    t.title,
    t.workout_type,
    t.time_limit_seconds,
    t.structure_config,
    t.creator_id,
    p.username as creator_username,
    p.display_name as creator_display_name,
    v_is_owner as is_owner,
    e.id as exercise_id,
    e.sort_order,
    e.exercise_type,
    e.target_reps
  from public.custom_workout_templates t
  join public.profiles p on p.id = t.creator_id
  join public.custom_workout_template_exercises e on e.template_id = t.id
  where t.id = p_template_id
  order by e.sort_order asc;
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
  structure_config jsonb,
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
    wc.structure_config,
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

grant execute on function public.create_custom_workout_template(text, integer, jsonb, text, jsonb) to authenticated;
grant execute on function public.update_custom_workout_template(uuid, text, integer, jsonb, text, jsonb) to authenticated;
grant execute on function public.get_custom_workout_template_detail(uuid) to authenticated;
grant execute on function public.get_workout_catalog_detail(uuid) to authenticated;
