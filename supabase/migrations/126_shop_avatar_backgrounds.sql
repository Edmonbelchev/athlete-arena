-- Shop: avatar backgrounds (new 'background' accessory slot). Illustrated scenes are drawn
-- by the app behind the avatar; colors set the sky gradient (primary = top, secondary = horizon).

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('shop_bg_mountains', 'wearable', 'Mountain Range', 'Green peaks under a clear sky.', 400, true, 900,
    '{"slot":"background","bodyType":"unisex","style":"scene_mountains","tier":"basic","colors":{"primary":"#7DD3FC","secondary":"#E0F2FE"}}'::jsonb),
  ('shop_bg_forest', 'wearable', 'Pine Forest', 'Fresh air between the pines.', 400, true, 910,
    '{"slot":"background","bodyType":"unisex","style":"scene_forest","tier":"basic","colors":{"primary":"#86EFAC","secondary":"#DCFCE7"}}'::jsonb),
  ('shop_bg_beach', 'wearable', 'Tropical Beach', 'Sun, sea and a lonely palm.', 700, true, 920,
    '{"slot":"background","bodyType":"unisex","style":"scene_beach","tier":"rare","colors":{"primary":"#38BDF8","secondary":"#BAE6FD"}}'::jsonb),
  ('shop_bg_snowy_mountains', 'wearable', 'Snowy Peaks', 'Train like it is altitude camp.', 700, true, 930,
    '{"slot":"background","bodyType":"unisex","style":"scene_snowy_mountains","tier":"rare","colors":{"primary":"#93C5FD","secondary":"#EFF6FF"}}'::jsonb),
  ('shop_bg_sunset', 'wearable', 'Desert Sunset', 'Golden hour, every hour.', 700, true, 940,
    '{"slot":"background","bodyType":"unisex","style":"scene_sunset","tier":"rare","colors":{"primary":"#7C3AED","secondary":"#FB923C"}}'::jsonb),
  ('shop_bg_city', 'wearable', 'City Nights', 'The city never sleeps - neither do your gains.', 1200, true, 950,
    '{"slot":"background","bodyType":"unisex","style":"scene_city","tier":"legendary","colors":{"primary":"#0F172A","secondary":"#312E81"}}'::jsonb),
  ('shop_bg_space', 'wearable', 'Deep Space', 'Out of this world.', 1500, true, 960,
    '{"slot":"background","bodyType":"unisex","style":"scene_space","tier":"legendary","colors":{"primary":"#020617","secondary":"#1E1B4B"}}'::jsonb),
  ('shop_bg_aurora', 'wearable', 'Northern Lights', 'Rare skies for rare athletes.', 1500, true, 970,
    '{"slot":"background","bodyType":"unisex","style":"scene_aurora","tier":"legendary","colors":{"primary":"#0B1026","secondary":"#1E3A5F"}}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Same as 117, with 'background' added to the accepted accessory slots.
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
    if v_key not in ('top', 'headwear', 'glasses', 'earrings', 'background') then
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
