-- Daily quest rep targets:
-- push_ups / squats: 20–50 reps (tiers 20, 30, 40, 50)
-- pull_ups / burpees: 10–30 reps (tiers 10, 15, 20, 30)

create or replace function public.pick_daily_mission_tier(
  p_exercise public.exercise_type,
  p_tier_roll integer
)
returns table (
  target_reps integer,
  xp_reward integer
)
language plpgsql
immutable
as $$
begin
  if p_tier_roll < 0 or p_tier_roll > 3 then
    raise exception 'tier roll must be between 0 and 3';
  end if;

  case p_exercise
    when 'push_ups' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'squats' then
      case p_tier_roll
        when 0 then return query select 20, 50;
        when 1 then return query select 30, 50;
        when 2 then return query select 40, 50;
        else return query select 50, 50;
      end case;
    when 'pull_ups' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    when 'burpees' then
      case p_tier_roll
        when 0 then return query select 10, 50;
        when 1 then return query select 15, 50;
        when 2 then return query select 20, 50;
        else return query select 30, 50;
      end case;
    else
      raise exception 'Unsupported exercise for daily missions: %', p_exercise;
  end case;
end;
$$;

select public.ensure_daily_mission_templates(current_date);

update public.daily_challenges dc
set target_reps = (
  select tier.target_reps
  from public.pick_daily_mission_tier(
    dc.exercise_type,
    (
      (
        (extract(epoch from dc.challenge_date::timestamptz)::bigint / 86400)::bigint
        + dc.mission_index * 17
      ) % 4
    )::integer
  ) as tier
)
where dc.challenge_date = current_date
  and dc.status <> 'completed';
