-- Merge new targets into an existing active goal for the same activity and period.

create or replace function public.create_user_goal(
  p_activity_id text,
  p_period public.goal_period,
  p_target_value numeric
)
returns public.user_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.goal_activity_catalog;
  v_period_start date;
  v_active_count integer;
  v_goal public.user_goals;
  v_new_target numeric(12, 3);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_activity
  from public.goal_activity_catalog
  where id = p_activity_id
    and enabled = true;

  if not found then
    raise exception 'Activity not available';
  end if;

  perform public.validate_goal_target_value(v_activity.kind, p_target_value);

  v_period_start := public.goal_period_start(p_period);

  select *
  into v_goal
  from public.user_goals
  where user_id = v_user_id
    and activity_id = p_activity_id
    and period = p_period
    and period_start = v_period_start
    and status = 'active'
  for update;

  if found then
    v_new_target := v_goal.target_value + p_target_value;
    perform public.validate_goal_target_value(v_activity.kind, v_new_target);

    update public.user_goals
    set
      target_value = v_new_target,
      status = case
        when current_value >= v_new_target then 'completed'::public.goal_status
        else 'active'::public.goal_status
      end,
      completed_at = case
        when current_value >= v_new_target then coalesce(completed_at, now())
        else null
      end,
      updated_at = now()
    where id = v_goal.id
    returning * into v_goal;

    return v_goal;
  end if;

  select count(*)
  into v_active_count
  from public.user_goals
  where user_id = v_user_id
    and period = p_period
    and period_start = v_period_start
    and status = 'active';

  if v_active_count >= 5 then
    raise exception 'You can only have 5 active % goals at a time', p_period;
  end if;

  insert into public.user_goals (
    user_id,
    activity_id,
    period,
    target_value,
    period_start
  )
  values (
    v_user_id,
    p_activity_id,
    p_period,
    p_target_value,
    v_period_start
  )
  returning * into v_goal;

  return v_goal;
end;
$$;
