-- Earrings become female-only, and the starter tops become a blue tee, a pink tee
-- and one hoodie.

update public.shop_items
set metadata = jsonb_set(metadata, '{bodyType}', '"female"')
where item_type = 'wearable'
  and metadata->>'slot' = 'earrings';

-- Male avatars can no longer wear earrings.
update public.user_avatars
set accessories = accessories - 'earrings'
where appearance->>'bodyType' = 'male'
  and accessories ? 'earrings';

-- Unequip tops that are being retired; the app falls back to the first owned top.
update public.user_avatars
set accessories = accessories - 'top'
where accessories->>'top' in ('wear_top_arena_tee', 'wear_top_white_tee', 'wear_top_black_hoodie');

-- Removing the items also removes them from user_inventory (on delete cascade).
delete from public.shop_items
where id in ('wear_top_arena_tee', 'wear_top_white_tee', 'wear_top_black_hoodie');

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('wear_top_blue_tee', 'wearable', 'Blue Tee', 'The classic training tee.', 0, true, 10,
    '{"slot":"top","bodyType":"unisex","style":"tee","colors":{"primary":"#3B82F6","secondary":"#1D4ED8"},"starter":true}'::jsonb),
  ('wear_top_pink_tee', 'wearable', 'Pink Tee', 'The classic training tee.', 0, true, 20,
    '{"slot":"top","bodyType":"unisex","style":"tee","colors":{"primary":"#EC4899","secondary":"#BE185D"},"starter":true}'::jsonb),
  ('wear_top_gray_hoodie', 'wearable', 'Hoodie', 'Warm-up essential.', 0, true, 30,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","colors":{"primary":"#9CA3AF","secondary":"#6B7280"},"starter":true}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- grant_starter_shop_items (109) grants every active starter wearable.
select public.grant_starter_shop_items(id)
from public.profiles;
