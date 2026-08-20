-- Update an owned workout template in place so shared copies stay in sync.

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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_workout_type not in ('amrap') then
    raise exception 'Unsupported workout type';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  update public.custom_workout_templates
  set
    title = trim(p_title),
    workout_type = p_workout_type::public.custom_workout_type,
    time_limit_seconds = p_time_limit_seconds
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

grant execute on function public.update_custom_workout_template(uuid, text, integer, jsonb, text) to authenticated;
