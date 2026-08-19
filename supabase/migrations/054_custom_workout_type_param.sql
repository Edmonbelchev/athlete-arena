-- Allow create_custom_workout_template to persist the selected workout style.

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

  insert into public.custom_workout_templates (creator_id, title, workout_type, time_limit_seconds)
  values (
    v_user_id,
    trim(p_title),
    p_workout_type::public.custom_workout_type,
    p_time_limit_seconds
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

grant execute on function public.create_custom_workout_template(text, integer, jsonb, text) to authenticated;
