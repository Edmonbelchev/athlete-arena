-- Progressive level curve: 500 XP for level 1→2, +50 XP per subsequent level.

create or replace function public.xp_required_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select 500 + greatest(p_level - 1, 0) * 50;
$$;

create or replace function public.xp_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select case
    when p_level <= 1 then 0
    else (p_level - 1) * (500 + 25 * (p_level - 2))
  end;
$$;

create or replace function public.calculate_level(p_total_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_level integer := 1;
begin
  while public.xp_for_level(v_level + 1) <= greatest(p_total_xp, 0) loop
    v_level := v_level + 1;
  end loop;

  return v_level;
end;
$$;

-- Recalculate stored levels to match the new curve.
do $$
begin
  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set level = public.calculate_level(total_xp)
  where level is distinct from public.calculate_level(total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'false', true);
end;
$$;

grant execute on function public.xp_required_for_level(integer) to authenticated;
grant execute on function public.xp_for_level(integer) to authenticated;
