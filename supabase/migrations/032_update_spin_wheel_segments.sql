-- Full spin wheel: 5/10/15 common, 20/30 rare, 50/100 epic, 2x legendary.

create or replace function public.daily_spin_segments()
returns table (
  reward_id text,
  rarity text,
  coins integer,
  grants_multiplier boolean,
  weight integer,
  sort_order integer
)
language sql
immutable
set search_path = public
as $$
  select
    s.reward_id::text,
    s.rarity::text,
    s.coins::integer,
    s.grants_multiplier::boolean,
    s.weight::integer,
    s.sort_order::integer
  from (values
    ('coins_5',       'common',      5, false, 18, 1),
    ('coins_10',      'common',     10, false, 16, 2),
    ('coins_15',      'common',     15, false, 14, 3),
    ('coins_20',      'rare',       20, false, 14, 4),
    ('coins_30',      'rare',       30, false, 12, 5),
    ('coins_50',      'epic',       50, false, 10, 6),
    ('coins_100',     'epic',      100, false,  8, 7),
    ('multiplier_2x', 'legendary',   0,  true,  8, 8)
  ) as s(reward_id, rarity, coins, grants_multiplier, weight, sort_order)
  order by s.sort_order;
$$;

revoke all on function public.daily_spin_segments() from public;
