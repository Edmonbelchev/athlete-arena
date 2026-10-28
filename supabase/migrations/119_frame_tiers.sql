-- Royal frame moves from legendary to rare; brown and black frames are added as basic.

update public.shop_items
set
  price_coins = 650,
  metadata = jsonb_set(metadata, '{tier}', '"rare"')
where id = 'frame_royal';

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('frame_brown', 'frame', 'Brown Frame', 'Warm, earthy border.', 200, true, 25,
    '{"borderColor":"#8B5A2B","borderWidth":3,"tier":"basic"}'::jsonb),
  ('frame_black', 'frame', 'Black Frame', 'Sleek and simple.', 200, true, 26,
    '{"borderColor":"#111827","borderWidth":3,"tier":"basic"}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;
