-- Daily spin wheel: one spin per UTC day, coin rewards plus a "2x coins" buff.
--
-- The 2x buff lives on profiles.coin_multiplier_expires_at and is applied
-- centrally inside award_coins(), so every coin source (daily challenge, friend
-- races, anything added later) respects it without touching each call site.
-- The buff expires at the next UTC midnight, which is the same boundary the
-- daily challenge and the next spin reset on.

-- 1. BUFF COLUMN -------------------------------------------------------------

alter table public.profiles
  add column if not exists coin_multiplier_expires_at timestamptz;

comment on column public.profiles.coin_multiplier_expires_at is
  'While in the future, award_coins() doubles coin payouts. Granted by the daily spin wheel, expires at the next UTC midnight.';

-- Treat the buff like the other protected stats: only RPCs may change it.
create or replace function public.protect_profile_stats()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.bypass_profile_stat_protection', true), '') = 'true' then
    return new;
  end if;

  if new.total_xp is distinct from old.total_xp
     or new.level is distinct from old.level
     or new.current_streak is distinct from old.current_streak
     or new.longest_streak is distinct from old.longest_streak
     or new.coin_balance is distinct from old.coin_balance
     or new.coin_multiplier_expires_at is distinct from old.coin_multiplier_expires_at then
    raise exception 'Profile stats cannot be modified directly';
  end if;

  return new;
end;
$$;

-- 2. COIN AWARDING WITH MULTIPLIER -------------------------------------------

-- Raw increment that ignores any active multiplier. Used by the spin wheel so
-- the payout matches the amount printed on the wheel segment exactly.
create or replace function public.award_coins_exact(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Coin amount must be positive';
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set coin_balance = coin_balance + p_amount
  where id = p_user_id
  returning coin_balance into v_new_balance;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  return coalesce(v_new_balance, 0);
end;
$$;

revoke all on function public.award_coins_exact(uuid, integer) from public;

-- Signature is unchanged so existing callers (complete_challenge,
-- resolve_friend_challenge_race) pick up the multiplier automatically.
create or replace function public.award_coins(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_multiplier integer := 1;
begin
  if p_amount <= 0 then
    raise exception 'Coin amount must be positive';
  end if;

  select case
           when p.coin_multiplier_expires_at is not null
                and p.coin_multiplier_expires_at > now()
             then 2
           else 1
         end
  into v_multiplier
  from public.profiles p
  where p.id = p_user_id;

  return public.award_coins_exact(p_user_id, p_amount * coalesce(v_multiplier, 1));
end;
$$;

-- award_coins mints currency; it must never be callable directly by clients.
revoke all on function public.award_coins(uuid, integer) from public;

-- 3. SPIN HISTORY ------------------------------------------------------------

create table if not exists public.daily_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  spin_date date not null,
  reward_id text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  multiplier_granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, spin_date)
);

create index if not exists daily_spins_user_created_idx
  on public.daily_spins (user_id, created_at desc);

alter table public.daily_spins enable row level security;

drop policy if exists "Users can view own spins" on public.daily_spins;

create policy "Users can view own spins"
  on public.daily_spins
  for select
  using (auth.uid() = user_id);

-- 4. WHEEL DEFINITION --------------------------------------------------------

-- Server-side source of truth for the wheel. Weights sum to 100 so each weight
-- reads directly as a percentage chance.
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
    ('coins_5',       'common',      5, false, 30, 1),
    ('coins_10',      'common',     10, false, 27, 2),
    ('coins_20',      'rare',       20, false, 22, 3),
    ('coins_50',      'epic',       50, false, 12, 4),
    ('multiplier_2x', 'epic',        0,  true,  6, 5),
    ('coins_100',     'legendary', 100, false,  3, 6)
  ) as s(reward_id, rarity, coins, grants_multiplier, weight, sort_order)
  order by s.sort_order;
$$;

revoke all on function public.daily_spin_segments() from public;

create or replace function public.daily_spin_segments_json()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reward_id', s.reward_id,
        'rarity', s.rarity,
        'coins', s.coins,
        'grants_multiplier', s.grants_multiplier,
        'weight', s.weight
      )
      order by s.sort_order
    ),
    '[]'::jsonb
  )
  from public.daily_spin_segments() s;
$$;

revoke all on function public.daily_spin_segments_json() from public;

-- 5. STATUS ------------------------------------------------------------------

create or replace function public.get_daily_spin_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  -- Spins reset on the UTC day boundary, same as the daily challenge.
  v_today date := (timezone('utc', now()))::date;
  v_next_reset timestamptz := ((v_today + 1)::timestamp at time zone 'utc');
  v_last public.daily_spins;
  v_multiplier_expires_at timestamptz;
  v_coin_balance integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.coin_multiplier_expires_at, p.coin_balance
  into v_multiplier_expires_at, v_coin_balance
  from public.profiles p
  where p.id = v_user_id;

  select *
  into v_last
  from public.daily_spins
  where user_id = v_user_id
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'can_spin', not exists (
      select 1
      from public.daily_spins
      where user_id = v_user_id
        and spin_date = v_today
    ),
    'next_spin_at', v_next_reset,
    'coin_balance', coalesce(v_coin_balance, 0),
    'coin_multiplier', case
      when v_multiplier_expires_at is not null and v_multiplier_expires_at > now() then 2
      else 1
    end,
    'coin_multiplier_expires_at', case
      when v_multiplier_expires_at is not null and v_multiplier_expires_at > now()
        then v_multiplier_expires_at
      else null
    end,
    'last_spin', case
      when v_last.id is null then null
      else jsonb_build_object(
        'reward_id', v_last.reward_id,
        'rarity', v_last.rarity,
        'coins_awarded', v_last.coins_awarded,
        'multiplier_granted', v_last.multiplier_granted,
        'spin_date', v_last.spin_date,
        'created_at', v_last.created_at
      )
    end,
    'segments', public.daily_spin_segments_json()
  );
end;
$$;

grant execute on function public.get_daily_spin_status() to authenticated;

-- 6. SPIN --------------------------------------------------------------------

create or replace function public.spin_daily_wheel()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('utc', now()))::date;
  v_next_reset timestamptz := ((v_today + 1)::timestamp at time zone 'utc');
  v_total_weight integer;
  v_roll integer;
  v_segment record;
  v_balance integer;
  v_multiplier_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select sum(weight)::integer into v_total_weight from public.daily_spin_segments();
  v_roll := floor(random() * v_total_weight)::integer + 1;

  select c.reward_id, c.rarity, c.coins, c.grants_multiplier
  into v_segment
  from (
    select
      d.*,
      sum(d.weight) over (
        order by d.sort_order
        rows between unbounded preceding and current row
      ) as cumulative_weight
    from public.daily_spin_segments() d
  ) c
  where v_roll <= c.cumulative_weight
  order by c.sort_order
  limit 1;

  if v_segment.reward_id is null then
    raise exception 'Failed to pick a spin reward';
  end if;

  -- Claim today's spin first. The unique constraint is what actually enforces
  -- one spin per day, so concurrent calls cannot both be awarded.
  insert into public.daily_spins (
    user_id, spin_date, reward_id, rarity, coins_awarded, multiplier_granted
  )
  values (
    v_user_id, v_today, v_segment.reward_id, v_segment.rarity,
    v_segment.coins, v_segment.grants_multiplier
  )
  on conflict (user_id, spin_date) do nothing;

  if not found then
    raise exception 'You have already spun today';
  end if;

  if v_segment.grants_multiplier then
    v_multiplier_expires_at := v_next_reset;

    perform set_config('app.bypass_profile_stat_protection', 'true', true);

    update public.profiles
    set coin_multiplier_expires_at = greatest(
      coalesce(coin_multiplier_expires_at, v_multiplier_expires_at),
      v_multiplier_expires_at
    )
    where id = v_user_id
    returning coin_balance, coin_multiplier_expires_at
    into v_balance, v_multiplier_expires_at;

    perform set_config('app.bypass_profile_stat_protection', 'false', true);
  elsif v_segment.coins > 0 then
    -- Pay exactly what the wheel shows; the 2x buff never applies to itself.
    v_balance := public.award_coins_exact(v_user_id, v_segment.coins);
  end if;

  if v_balance is null then
    select coin_balance into v_balance from public.profiles where id = v_user_id;
  end if;

  return jsonb_build_object(
    'reward_id', v_segment.reward_id,
    'rarity', v_segment.rarity,
    'coins_awarded', case when v_segment.grants_multiplier then 0 else v_segment.coins end,
    'multiplier_granted', v_segment.grants_multiplier,
    'coin_balance', coalesce(v_balance, 0),
    'coin_multiplier', case
      when v_multiplier_expires_at is not null and v_multiplier_expires_at > now() then 2
      else 1
    end,
    'coin_multiplier_expires_at', v_multiplier_expires_at,
    'next_spin_at', v_next_reset
  );
end;
$$;

grant execute on function public.spin_daily_wheel() to authenticated;

-- 7. EXPOSE BUFF ON THE SHOP SUMMARY -----------------------------------------

create or replace function public.get_my_shop_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_coin_balance integer;
  v_multiplier_expires_at timestamptz;
  v_inventory jsonb;
  v_equipped jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coin_balance, coin_multiplier_expires_at
  into v_coin_balance, v_multiplier_expires_at
  from public.profiles
  where id = v_user_id;

  select coalesce(jsonb_agg(item_id order by acquired_at), '[]'::jsonb)
  into v_inventory
  from public.user_inventory
  where user_id = v_user_id;

  select coalesce(jsonb_object_agg(slot, item_id), '{}'::jsonb)
  into v_equipped
  from public.user_equipped_items
  where user_id = v_user_id;

  return jsonb_build_object(
    'coin_balance', coalesce(v_coin_balance, 0),
    'inventory', v_inventory,
    'equipped', v_equipped,
    'coin_multiplier', case
      when v_multiplier_expires_at is not null and v_multiplier_expires_at > now() then 2
      else 1
    end,
    'coin_multiplier_expires_at', case
      when v_multiplier_expires_at is not null and v_multiplier_expires_at > now()
        then v_multiplier_expires_at
      else null
    end
  );
end;
$$;

grant execute on function public.get_my_shop_summary() to authenticated;
