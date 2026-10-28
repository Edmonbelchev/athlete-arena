-- Shop update: avatar frames (borders) and more emotes are for sale, soldier
-- (camo) tees and hoodies are added, and the hood-up hoodies are removed.

-- Hood-up hoodies: refund anyone who bought one, unequip, then remove ----------

do $$
declare
  v_hood_ids text[] := array[
    'shop_top_gray_hood_up',
    'shop_top_black_hood_up',
    'shop_top_red_hood_up',
    'shop_top_phantom_hood_up'
  ];
begin
  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles p
  set coin_balance = p.coin_balance + refund.total
  from (
    select ui.user_id, sum(si.price_coins)::integer as total
    from public.user_inventory ui
    join public.shop_items si on si.id = ui.item_id
    where ui.item_id = any (v_hood_ids)
      and ui.source = 'purchase'
    group by ui.user_id
  ) refund
  where p.id = refund.user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  update public.user_avatars
  set accessories = accessories - 'top'
  where accessories->>'top' = any (v_hood_ids);

  -- Also removes them from user_inventory (on delete cascade).
  delete from public.shop_items where id = any (v_hood_ids);
end;
$$;

-- Frames, emotes and camo tops ------------------------------------------------------

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  -- Frames (border around the avatar everywhere it is shown)
  ('frame_basic', 'frame', 'Silver Frame', 'A clean silver border.', 200, true, 10,
    '{"borderColor":"#CBD5E1","borderWidth":3,"tier":"basic"}'::jsonb),
  ('frame_sky', 'frame', 'Sky Frame', 'Calm blue border.', 200, true, 20,
    '{"borderColor":"#38BDF8","borderWidth":3,"tier":"basic"}'::jsonb),
  ('frame_neon', 'frame', 'Neon Frame', 'Electric cyan for night owls.', 500, true, 30,
    '{"borderColor":"#22D3EE","borderWidth":4,"tier":"rare"}'::jsonb),
  ('frame_emerald', 'frame', 'Emerald Frame', 'Deep green, fresh energy.', 500, true, 40,
    '{"borderColor":"#10B981","borderWidth":4,"tier":"rare"}'::jsonb),
  ('frame_rose', 'frame', 'Rose Frame', 'Bold pink border.', 500, true, 50,
    '{"borderColor":"#F43F5E","borderWidth":4,"tier":"rare"}'::jsonb),
  ('frame_fire', 'frame', 'Fire Frame', 'For hot streaks.', 650, true, 60,
    '{"borderColor":"#F97316","borderWidth":5,"tier":"rare"}'::jsonb),
  ('frame_gold', 'frame', 'Gold Frame', 'Premium gold trim.', 1500, true, 70,
    '{"borderColor":"#FACC15","borderWidth":5,"tier":"legendary"}'::jsonb),
  ('frame_royal', 'frame', 'Royal Frame', 'Deep violet, fit for a champion.', 1800, true, 80,
    '{"borderColor":"#8B5CF6","borderWidth":6,"tier":"legendary"}'::jsonb),

  -- Emotes (existing ones get a tier; the trophy stays retired)
  ('emote_wave', 'emote', 'Wave', 'Say hello before a challenge.', 0, true, 10,
    '{"emoji":"👋","tier":"basic"}'::jsonb),
  ('emote_fire', 'emote', 'On Fire', 'Celebrate a hot streak.', 150, true, 20,
    '{"emoji":"🔥","tier":"basic"}'::jsonb),
  ('emote_muscle', 'emote', 'Flex', 'Show off after a win.', 150, true, 30,
    '{"emoji":"💪","tier":"basic"}'::jsonb),
  ('emote_cool', 'emote', 'Too Cool', 'Unbothered by the competition.', 150, true, 40,
    '{"emoji":"😎","tier":"basic"}'::jsonb),
  ('emote_hands', 'emote', 'Hype', 'Raise the roof.', 150, true, 50,
    '{"emoji":"🙌","tier":"basic"}'::jsonb),
  ('emote_salute', 'emote', 'Salute', 'Respect to your rival.', 150, true, 60,
    '{"emoji":"🫡","tier":"basic"}'::jsonb),
  ('emote_target', 'emote', 'Bullseye', 'Hit the target every time.', 300, true, 70,
    '{"emoji":"🎯","tier":"rare"}'::jsonb),
  ('emote_bolt', 'emote', 'Lightning', 'Faster than everyone else.', 300, true, 80,
    '{"emoji":"⚡","tier":"rare"}'::jsonb),
  ('emote_hundred', 'emote', 'Hundred', 'Perfect form, every rep.', 300, true, 90,
    '{"emoji":"💯","tier":"rare"}'::jsonb),
  ('emote_rocket', 'emote', 'Launch', 'Blasting past the leaderboard.', 400, true, 100,
    '{"emoji":"🚀","tier":"rare"}'::jsonb),
  ('emote_determined', 'emote', 'Locked In', 'Nothing breaks your focus.', 400, true, 110,
    '{"emoji":"😤","tier":"rare"}'::jsonb),
  ('emote_medal', 'emote', 'Gold Medal', 'First place, again.', 1000, true, 120,
    '{"emoji":"🥇","tier":"legendary"}'::jsonb),
  ('emote_crown', 'emote', 'King of the Arena', 'Rule every race.', 1200, true, 130,
    '{"emoji":"👑","tier":"legendary"}'::jsonb),
  ('emote_goat', 'emote', 'GOAT', 'Greatest of all time.', 1500, true, 140,
    '{"emoji":"🐐","tier":"legendary"}'::jsonb),

  -- Soldier (camo) tops
  ('shop_top_soldier_tee', 'wearable', 'Soldier Tee', 'Woodland camo for drill day.', 450, true, 155,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"rare","pattern":"camo","colors":{"primary":"#556B2F","secondary":"#8F9E6B"}}'::jsonb),
  ('shop_top_desert_tee', 'wearable', 'Desert Camo Tee', 'Sand-toned camo.', 450, true, 156,
    '{"slot":"top","bodyType":"unisex","style":"tee","tier":"rare","pattern":"camo","colors":{"primary":"#C2A878","secondary":"#8B7355"}}'::jsonb),
  ('shop_top_soldier_hoodie', 'wearable', 'Soldier Hoodie', 'Woodland camo, warm and ready.', 600, true, 185,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","tier":"rare","pattern":"camo","colors":{"primary":"#4B5D2A","secondary":"#7D8C5A"}}'::jsonb),
  ('shop_top_arctic_hoodie', 'wearable', 'Arctic Camo Hoodie', 'Winter ops camo.', 1500, true, 195,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","tier":"legendary","pattern":"camo","colors":{"primary":"#E2E8F0","secondary":"#94A3B8"}}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Catalog and purchases now include frames -------------------------------------------

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
          or si.item_type in ('wearable', 'challenge_slots', 'frame')
        )
      )
      or ui.item_id is not null
    )
    and (p_item_type is null or si.item_type = p_item_type)
  order by si.sort_order asc, si.title asc;
end;
$$;

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
      or item_type in ('wearable', 'challenge_slots', 'frame')
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

-- Equipped frames can be taken off again.
create or replace function public.unequip_shop_slot(p_slot text)
returns text
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

  if p_slot <> 'frame' then
    raise exception 'This slot cannot be emptied';
  end if;

  delete from public.user_equipped_items
  where user_id = v_user_id and slot = p_slot;

  return 'unequipped';
end;
$$;

grant execute on function public.unequip_shop_slot(text) to authenticated;
