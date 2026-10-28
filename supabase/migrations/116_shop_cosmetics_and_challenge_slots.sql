-- Shop opening: avatar cosmetics (tops, headwear, earrings) in three price tiers,
-- and challenge slots - extra friend challenge requests for free users once the
-- monthly limit (10) is used. Premium members are unlimited and cannot buy slots.
--
-- Tiers (metadata.tier) are priced against ~200-350 coins/day for an active player:
--   basic      150-250    about a day of play
--   rare       450-750    a few days
--   legendary  1500-3000  a week or more

alter table public.shop_items
  drop constraint if exists shop_items_item_type_check;

alter table public.shop_items
  add constraint shop_items_item_type_check
  check (item_type in ('avatar', 'frame', 'emote', 'wearable', 'challenge_slots'));

-- Challenge slots ------------------------------------------------------------

create table if not exists public.user_challenge_slots (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_challenge_slots enable row level security;

drop policy if exists "Users can read own challenge slots" on public.user_challenge_slots;
create policy "Users can read own challenge slots"
  on public.user_challenge_slots
  for select
  using (auth.uid() = user_id);

-- Writes go through purchase_shop_item and the challenge insert trigger only.

-- Over the monthly limit, each new challenge uses one purchased slot.
create or replace function public.assert_can_create_friend_challenge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if p_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.user_has_premium_access(p_user_id) then
    return;
  end if;

  v_limit := public.friend_challenge_monthly_request_limit();
  v_used := public.count_friend_challenge_requests_this_month(p_user_id);

  if v_used < v_limit then
    return;
  end if;

  update public.user_challenge_slots
  set balance = balance - 1, updated_at = now()
  where user_id = p_user_id
    and balance > 0;

  if not found then
    raise exception
      'Monthly challenge request limit reached (% of %). Buy challenge slots in the Shop or upgrade to Premium for unlimited requests.',
      v_used,
      v_limit;
  end if;
end;
$$;

-- The return type gains bonus_slots, so drop first.
drop function if exists public.get_my_friend_challenge_request_quota();

create function public.get_my_friend_challenge_request_quota()
returns table (
  used_count integer,
  monthly_limit integer,
  is_premium boolean,
  can_create boolean,
  bonus_slots integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_used integer;
  v_is_premium boolean;
  v_bonus integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.user_has_premium_access(v_user_id);
  v_used := public.count_friend_challenge_requests_this_month(v_user_id);

  select coalesce(max(s.balance), 0) into v_bonus
  from public.user_challenge_slots s
  where s.user_id = v_user_id;

  return query
  select
    v_used,
    case when v_is_premium then null else public.friend_challenge_monthly_request_limit() end,
    v_is_premium,
    v_is_premium or v_used < public.friend_challenge_monthly_request_limit() or v_bonus > 0,
    v_bonus;
end;
$$;

grant execute on function public.get_my_friend_challenge_request_quota() to authenticated;

-- Shop items -------------------------------------------------------------------

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  -- Challenge slots (consumable)
  ('slots_1', 'challenge_slots', '1 Challenge Slot', 'One extra friend challenge request.', 75, true, 10,
    '{"slots":1}'::jsonb),
  ('slots_5', 'challenge_slots', '5 Challenge Slots', 'Five extra friend challenge requests.', 325, true, 20,
    '{"slots":5,"savings":50}'::jsonb),
  ('slots_10', 'challenge_slots', '10 Challenge Slots', 'Ten extra friend challenge requests.', 600, true, 30,
    '{"slots":10,"savings":150}'::jsonb),

  -- Tops: basic tees
  ('shop_top_black_tee', 'wearable', 'Black Tee', 'Goes with everything.', 150, true, 110,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"basic","colors":{"primary":"#1F2937","secondary":"#4B5563"}}'::jsonb),
  ('shop_top_white_tee', 'wearable', 'White Tee', 'Fresh and clean.', 150, true, 120,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"basic","colors":{"primary":"#F8FAFC","secondary":"#CBD5E1"}}'::jsonb),
  ('shop_top_red_tee', 'wearable', 'Red Tee', 'Bring the intensity.', 150, true, 130,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"basic","colors":{"primary":"#EF4444","secondary":"#B91C1C"}}'::jsonb),
  ('shop_top_green_tee', 'wearable', 'Green Tee', 'Fresh legs, fresh tee.', 150, true, 140,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"basic","colors":{"primary":"#10B981","secondary":"#047857"}}'::jsonb),
  -- Tops: rare
  ('shop_top_racing_tee', 'wearable', 'Racing Stripe Tee', 'Built for speed races.', 450, true, 150,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"rare","pattern":"stripe","colors":{"primary":"#0F172A","secondary":"#F97316"}}'::jsonb),
  ('shop_top_navy_hoodie', 'wearable', 'Navy Hoodie', 'Cozy cool-down classic.', 500, true, 160,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","tier":"rare","colors":{"primary":"#1E3A8A","secondary":"#1E40AF"}}'::jsonb),
  ('shop_top_red_hoodie', 'wearable', 'Red Hoodie', 'Warm-up in style.', 500, true, 170,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","tier":"rare","colors":{"primary":"#DC2626","secondary":"#991B1B"}}'::jsonb),
  ('shop_top_violet_hoodie', 'wearable', 'Violet Hoodie', 'For late-night sessions.', 500, true, 180,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","tier":"rare","colors":{"primary":"#7C3AED","secondary":"#5B21B6"}}'::jsonb),
  -- Tops: legendary
  ('shop_top_champion_tee', 'wearable', 'Champion Tee', 'Gold stripe for podium finishers.', 1500, true, 190,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"legendary","pattern":"stripe","colors":{"primary":"#111827","secondary":"#FACC15"}}'::jsonb),
  ('shop_top_gold_hoodie', 'wearable', 'Gold Star Hoodie', 'Only for arena legends.', 2000, true, 200,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","tier":"legendary","pattern":"star","colors":{"primary":"#EAB308","secondary":"#A16207"}}'::jsonb),

  -- Headwear: basic
  ('shop_headwear_blue_sweatband', 'wearable', 'Blue Sweatband', 'Keep the sweat out of your eyes.', 150, true, 310,
    '{"slot":"headwear","bodyType":"unisex","style":"headband","tier":"basic","colors":{"primary":"#3B82F6","secondary":"#1D4ED8"}}'::jsonb),
  ('shop_headwear_black_sweatband', 'wearable', 'Black Sweatband', 'All business.', 150, true, 320,
    '{"slot":"headwear","bodyType":"unisex","style":"headband","tier":"basic","colors":{"primary":"#1F2937","secondary":"#F8FAFC"}}'::jsonb),
  -- Headwear: rare
  ('shop_headwear_black_cap', 'wearable', 'Black Cap', 'Low-key game day.', 450, true, 330,
    '{"slot":"headwear","bodyType":"unisex","style":"cap","tier":"rare","colors":{"primary":"#1F2937","secondary":"#111827"}}'::jsonb),
  ('shop_headwear_red_cap', 'wearable', 'Red Cap', 'Spotted on every leaderboard.', 450, true, 340,
    '{"slot":"headwear","bodyType":"unisex","style":"cap","tier":"rare","colors":{"primary":"#EF4444","secondary":"#B91C1C"}}'::jsonb),
  ('shop_headwear_green_beanie', 'wearable', 'Green Beanie', 'Trail run ready.', 500, true, 350,
    '{"slot":"headwear","bodyType":"unisex","style":"beanie","tier":"rare","colors":{"primary":"#16A34A","secondary":"#14532D"}}'::jsonb),
  ('shop_headwear_pink_beanie', 'wearable', 'Pink Beanie', 'Soft but tough.', 500, true, 360,
    '{"slot":"headwear","bodyType":"unisex","style":"beanie","tier":"rare","colors":{"primary":"#EC4899","secondary":"#9D174D"}}'::jsonb),
  -- Headwear: legendary
  ('shop_headwear_gold_cap', 'wearable', 'Gold Cap', 'Shines brighter than your streak.', 1500, true, 370,
    '{"slot":"headwear","bodyType":"unisex","style":"cap","tier":"legendary","colors":{"primary":"#FACC15","secondary":"#CA8A04"}}'::jsonb),
  ('shop_headwear_crown', 'wearable', 'Arena Crown', 'Rule the arena.', 3000, true, 380,
    '{"slot":"headwear","bodyType":"unisex","style":"crown","tier":"legendary","colors":{"primary":"#FACC15","secondary":"#EF4444"}}'::jsonb),

  -- Earrings (female avatars)
  ('shop_earrings_rose_hoops', 'wearable', 'Rose Gold Hoops', 'Warm rose gold.', 450, true, 410,
    '{"slot":"earrings","bodyType":"female","style":"hoops","tier":"rare","colors":{"primary":"#F9A8A8","secondary":"#E07A7A"}}'::jsonb),
  ('shop_earrings_emerald_drops', 'wearable', 'Emerald Drops', 'Gold drops with an emerald.', 600, true, 420,
    '{"slot":"earrings","bodyType":"female","style":"drops","tier":"rare","colors":{"primary":"#F5C542","secondary":"#10B981"}}'::jsonb),
  ('shop_earrings_diamond_studs', 'wearable', 'Diamond Studs', 'A legendary sparkle.', 1500, true, 430,
    '{"slot":"earrings","bodyType":"female","style":"studs","tier":"legendary","colors":{"primary":"#E0F2FE","secondary":"#7DD3FC"}}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Catalog: active emotes (except the trophy), wearables and challenge slots, plus anything owned.
create or replace function public.get_shop_catalog(p_item_type text default null)
returns table (
  id text,
  item_type text,
  title text,
  description text,
  image_url text,
  price_coins integer,
  sort_order integer,
  metadata jsonb,
  owned boolean,
  equipped boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    si.id,
    si.item_type,
    si.title,
    si.description,
    si.image_url,
    si.price_coins,
    si.sort_order,
    si.metadata,
    ui.item_id is not null as owned,
    uei.item_id is not null as equipped
  from public.shop_items si
  left join public.user_inventory ui
    on ui.item_id = si.id and ui.user_id = v_user_id
  left join public.user_equipped_items uei
    on uei.item_id = si.id and uei.user_id = v_user_id
  where (
      (
        si.is_active = true
        and (
          (si.item_type = 'emote' and si.id <> 'emote_trophy')
          or si.item_type in ('wearable', 'challenge_slots')
        )
      )
      or ui.item_id is not null
    )
    and (p_item_type is null or si.item_type = p_item_type)
  order by si.sort_order asc, si.title asc;
end;
$$;

-- Purchases: emotes and wearables are owned once; challenge slots add to a balance.
create or replace function public.purchase_shop_item(p_item_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_balance integer;
  v_slots integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item
  from public.shop_items
  where id = p_item_id
    and is_active = true
    and (
      (item_type = 'emote' and id <> 'emote_trophy')
      or item_type in ('wearable', 'challenge_slots')
    );

  if not found then
    raise exception 'Item not found';
  end if;

  if v_item.item_type = 'challenge_slots' then
    if public.user_has_premium_access(v_user_id) then
      raise exception 'Premium members already have unlimited challenge requests';
    end if;

    v_slots := coalesce((v_item.metadata->>'slots')::integer, 0);
    if v_slots <= 0 then
      raise exception 'Item not found';
    end if;
  elsif exists (
    select 1 from public.user_inventory where user_id = v_user_id and item_id = p_item_id
  ) then
    return 'already_owned';
  end if;

  -- Lock the balance so two purchases at once cannot both spend the same coins.
  select coin_balance into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if coalesce(v_balance, 0) < v_item.price_coins then
    raise exception 'Not enough coins';
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set coin_balance = coin_balance - v_item.price_coins
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  if v_item.item_type = 'challenge_slots' then
    insert into public.user_challenge_slots (user_id, balance)
    values (v_user_id, v_slots)
    on conflict (user_id) do update
    set balance = public.user_challenge_slots.balance + excluded.balance, updated_at = now();
  else
    insert into public.user_inventory (user_id, item_id, source)
    values (v_user_id, p_item_id, 'purchase');
  end if;

  return 'purchased';
end;
$$;
