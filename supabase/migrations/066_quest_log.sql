-- Paginated daily quest log for completed vs missed/incomplete quests.

create or replace function public.get_quest_log(
  p_completed boolean,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  entry_id uuid,
  exercise_type public.exercise_type,
  target_reps integer,
  completed_reps integer,
  xp_reward integer,
  status public.challenge_status,
  challenge_date date,
  result_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    dc.id as entry_id,
    dc.exercise_type,
    dc.target_reps,
    dc.completed_reps,
    dc.xp_reward,
    dc.status,
    dc.challenge_date,
    coalesce(dc.completed_at, dc.challenge_date::timestamptz) as result_at
  from public.daily_challenges dc
  where dc.user_id = v_user_id
    and (
      dc.status = 'completed'
      or dc.challenge_date < current_date
    )
    and (
      (p_completed and dc.status = 'completed')
      or (not p_completed and dc.status <> 'completed')
    )
  order by coalesce(dc.completed_at, dc.challenge_date::timestamptz) desc, dc.challenge_date desc
  limit v_limit
  offset v_offset;
end;
$$;

grant execute on function public.get_quest_log(boolean, integer, integer) to authenticated;
