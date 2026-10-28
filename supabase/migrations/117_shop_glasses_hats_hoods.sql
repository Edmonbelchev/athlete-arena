-- Shop expansion: glasses (new 'glasses' accessory slot), more hat types and
-- colors, and hoodies worn with the hood up (covers hair, hats and earrings).

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  -- Glasses: basic
  ('shop_glasses_round_black', 'wearable', 'Round Glasses', 'Classic round frames.', 200, true, 510,
    '{"slot":"glasses","bodyType":"unisex","style":"round_glasses","tier":"basic","colors":{"primary":"#1F2937","secondary":"#BFDBFE"}}'::jsonb),
  ('shop_glasses_round_tortoise', 'wearable', 'Tortoise Round Glasses', 'Warm tortoiseshell frames.', 200, true, 520,
    '{"slot":"glasses","bodyType":"unisex","style":"round_glasses","tier":"basic","colors":{"primary":"#92400E","secondary":"#FDE68A"}}'::jsonb),
  ('shop_glasses_square_black', 'wearable', 'Square Glasses', 'Sharp and studious.', 200, true, 530,
    '{"slot":"glasses","bodyType":"unisex","style":"square_glasses","tier":"basic","colors":{"primary":"#111827","secondary":"#BFDBFE"}}'::jsonb),
  ('shop_glasses_square_red', 'wearable', 'Red Square Glasses', 'A bold pop of color.', 250, true, 540,
    '{"slot":"glasses","bodyType":"unisex","style":"square_glasses","tier":"basic","colors":{"primary":"#DC2626","secondary":"#FECACA"}}'::jsonb),
  ('shop_glasses_round_blue', 'wearable', 'Blue Round Glasses', 'Cool blue frames.', 250, true, 550,
    '{"slot":"glasses","bodyType":"unisex","style":"round_glasses","tier":"basic","colors":{"primary":"#2563EB","secondary":"#BFDBFE"}}'::jsonb),
  -- Glasses: rare
  ('shop_glasses_sun_black', 'wearable', 'Black Sunglasses', 'Too cool for the leaderboard.', 500, true, 560,
    '{"slot":"glasses","bodyType":"unisex","style":"sunglasses","tier":"rare","colors":{"primary":"#111827","secondary":"#1F2937"}}'::jsonb),
  ('shop_glasses_sun_white', 'wearable', 'White Sunglasses', 'Summer training vibes.', 500, true, 570,
    '{"slot":"glasses","bodyType":"unisex","style":"sunglasses","tier":"rare","colors":{"primary":"#F8FAFC","secondary":"#334155"}}'::jsonb),
  ('shop_glasses_sun_pink', 'wearable', 'Pink Sunglasses', 'Bright frames, dark lenses.', 500, true, 580,
    '{"slot":"glasses","bodyType":"unisex","style":"sunglasses","tier":"rare","colors":{"primary":"#EC4899","secondary":"#4C1D95"}}'::jsonb),
  ('shop_glasses_aviator_silver', 'wearable', 'Silver Aviators', 'Mirrored blue lenses.', 650, true, 590,
    '{"slot":"glasses","bodyType":"unisex","style":"aviators","tier":"rare","colors":{"primary":"#94A3B8","secondary":"#38BDF8"}}'::jsonb),
  -- Glasses: legendary
  ('shop_glasses_aviator_gold', 'wearable', 'Gold Aviators', 'Gold frames, amber lenses.', 1500, true, 600,
    '{"slot":"glasses","bodyType":"unisex","style":"aviators","tier":"legendary","colors":{"primary":"#CA8A04","secondary":"#F59E0B"}}'::jsonb),

  -- Hats: basic visors
  ('shop_headwear_white_visor', 'wearable', 'White Visor', 'Shade for outdoor sessions.', 200, true, 311,
    '{"slot":"headwear","bodyType":"unisex","style":"visor","tier":"basic","colors":{"primary":"#F8FAFC","secondary":"#3B82F6"}}'::jsonb),
  ('shop_headwear_pink_visor', 'wearable', 'Pink Visor', 'Court-ready.', 200, true, 312,
    '{"slot":"headwear","bodyType":"unisex","style":"visor","tier":"basic","colors":{"primary":"#F472B6","secondary":"#F8FAFC"}}'::jsonb),
  -- Hats: rare bucket hats and backwards caps
  ('shop_headwear_khaki_bucket', 'wearable', 'Khaki Bucket Hat', 'Trail run essential.', 500, true, 351,
    '{"slot":"headwear","bodyType":"unisex","style":"bucket","tier":"rare","colors":{"primary":"#A3B18A","secondary":"#588157"}}'::jsonb),
  ('shop_headwear_black_bucket', 'wearable', 'Black Bucket Hat', 'Streetwear on rest days.', 500, true, 352,
    '{"slot":"headwear","bodyType":"unisex","style":"bucket","tier":"rare","colors":{"primary":"#1F2937","secondary":"#F8FAFC"}}'::jsonb),
  ('shop_headwear_orange_bucket', 'wearable', 'Orange Bucket Hat', 'Impossible to miss.', 500, true, 353,
    '{"slot":"headwear","bodyType":"unisex","style":"bucket","tier":"rare","colors":{"primary":"#F97316","secondary":"#C2410C"}}'::jsonb),
  ('shop_headwear_red_cap_back', 'wearable', 'Red Backwards Cap', 'Game face on.', 450, true, 341,
    '{"slot":"headwear","bodyType":"unisex","style":"cap_back","tier":"rare","colors":{"primary":"#EF4444","secondary":"#F8FAFC"}}'::jsonb),
  ('shop_headwear_navy_cap_back', 'wearable', 'Navy Backwards Cap', 'Laid back, locked in.', 450, true, 342,
    '{"slot":"headwear","bodyType":"unisex","style":"cap_back","tier":"rare","colors":{"primary":"#1E3A8A","secondary":"#F8FAFC"}}'::jsonb),
  ('shop_headwear_green_cap', 'wearable', 'Green Cap', 'Fresh legs, fresh cap.', 450, true, 343,
    '{"slot":"headwear","bodyType":"unisex","style":"cap","tier":"rare","colors":{"primary":"#16A34A","secondary":"#14532D"}}'::jsonb),
  ('shop_headwear_white_beanie', 'wearable', 'White Beanie', 'Snow day runner.', 500, true, 361,
    '{"slot":"headwear","bodyType":"unisex","style":"beanie","tier":"rare","colors":{"primary":"#F1F5F9","secondary":"#94A3B8"}}'::jsonb),

  -- Hooded tops (hood up)
  ('shop_top_gray_hood_up', 'wearable', 'Gray Hood Up', 'Hood up, headphones in.', 550, true, 181,
    '{"slot":"top","bodyType":"unisex","style":"hoodie_up","tier":"rare","colors":{"primary":"#9CA3AF","secondary":"#6B7280"}}'::jsonb),
  ('shop_top_black_hood_up', 'wearable', 'Black Hood Up', 'Early morning mode.', 600, true, 182,
    '{"slot":"top","bodyType":"unisex","style":"hoodie_up","tier":"rare","colors":{"primary":"#1F2937","secondary":"#374151"}}'::jsonb),
  ('shop_top_red_hood_up', 'wearable', 'Red Hood Up', 'Fight-night entrance.', 600, true, 183,
    '{"slot":"top","bodyType":"unisex","style":"hoodie_up","tier":"rare","colors":{"primary":"#B91C1C","secondary":"#7F1D1D"}}'::jsonb),
  ('shop_top_phantom_hood_up', 'wearable', 'Phantom Hood', 'Dark hood with a neon trim.', 1800, true, 201,
    '{"slot":"top","bodyType":"unisex","style":"hoodie_up","tier":"legendary","colors":{"primary":"#0F172A","secondary":"#22D3EE"}}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Same as 111, with 'glasses' added to the accepted accessory slots.
create or replace function public.save_my_avatar(p_appearance jsonb, p_accessories jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body_type text;
  v_key text;
  v_value jsonb;
  v_item public.shop_items%rowtype;
  v_version integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_appearance is null or jsonb_typeof(p_appearance) <> 'object' then
    raise exception 'Invalid avatar appearance';
  end if;

  if p_accessories is null or jsonb_typeof(p_accessories) <> 'object' then
    raise exception 'Invalid avatar accessories';
  end if;

  v_body_type := p_appearance->>'bodyType';
  if v_body_type is null or v_body_type not in ('male', 'female') then
    raise exception 'Invalid body type';
  end if;

  -- Appearance values are option ids resolved by the app; only shape-check them here.
  for v_key, v_value in select key, value from jsonb_each(p_appearance) loop
    if v_key not in (
      'bodyType', 'headShape', 'skinColor', 'eyes', 'eyeColor', 'brows', 'nose',
      'mouth', 'hair', 'hairColor', 'facialHair', 'background'
    ) then
      raise exception 'Unknown avatar attribute: %', v_key;
    end if;

    if jsonb_typeof(v_value) <> 'string' or (v_value #>> '{}') !~ '^[a-z0-9_]{1,40}$' then
      raise exception 'Invalid value for avatar attribute: %', v_key;
    end if;
  end loop;

  for v_key, v_value in select key, value from jsonb_each(p_accessories) loop
    if v_key not in ('top', 'headwear', 'glasses', 'earrings') then
      raise exception 'Unknown accessory slot: %', v_key;
    end if;

    if jsonb_typeof(v_value) <> 'string' then
      raise exception 'Invalid item for accessory slot: %', v_key;
    end if;

    select * into v_item
    from public.shop_items
    where id = v_value #>> '{}'
      and item_type = 'wearable';

    if not found then
      raise exception 'Item not found';
    end if;

    if not exists (
      select 1 from public.user_inventory
      where user_id = v_user_id and item_id = v_item.id
    ) then
      raise exception 'Item not owned';
    end if;

    if v_item.metadata->>'slot' is distinct from v_key then
      raise exception 'Item does not fit accessory slot: %', v_key;
    end if;

    if v_item.metadata->>'bodyType' not in (v_body_type, 'unisex') then
      raise exception 'Item does not fit this body type';
    end if;
  end loop;

  insert into public.user_avatars (user_id, appearance, accessories)
  values (v_user_id, p_appearance, p_accessories)
  on conflict (user_id) do update
  set
    appearance = excluded.appearance,
    accessories = excluded.accessories,
    version = public.user_avatars.version + 1,
    updated_at = now()
  returning version into v_version;

  return v_version;
end;
$$;
