-- Avatar becomes head-and-shoulders only: clothing (tops, bottoms, shoes) is
-- removed and wearables are head accessories (headwear, earrings).

alter table public.user_avatars
  rename column outfit to accessories;

-- Equipped clothing ids no longer apply.
update public.user_avatars
set accessories = '{}'::jsonb;

-- Removing the clothing items also removes them from user_inventory (on delete cascade).
delete from public.shop_items
where id in (
  'wear_m_top_arena_tee',
  'wear_m_top_training_tank',
  'wear_m_bottom_gym_shorts',
  'wear_m_bottom_joggers',
  'wear_m_shoes_classic',
  'wear_f_top_arena_tee',
  'wear_f_top_training_tank',
  'wear_f_bottom_gym_shorts',
  'wear_f_bottom_leggings',
  'wear_f_shoes_classic',
  'wear_u_headwear_sweatband'
);

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('wear_headwear_sweatband', 'wearable', 'Sweatband', 'Keep your focus.', 0, true, 10,
    '{"slot":"headwear","bodyType":"unisex","style":"headband","colors":{"primary":"#EF4444","secondary":"#B91C1C"},"starter":true}'::jsonb),
  ('wear_headwear_arena_cap', 'wearable', 'Arena Cap', 'Game-day classic.', 0, true, 20,
    '{"slot":"headwear","bodyType":"unisex","style":"cap","colors":{"primary":"#6366F1","secondary":"#4338CA"},"starter":true}'::jsonb),
  ('wear_headwear_beanie', 'wearable', 'Beanie', 'For cold morning runs.', 0, true, 30,
    '{"slot":"headwear","bodyType":"unisex","style":"beanie","colors":{"primary":"#F97316","secondary":"#C2410C"},"starter":true}'::jsonb),
  ('wear_earrings_silver_studs', 'wearable', 'Silver Studs', 'Small and subtle.', 0, true, 10,
    '{"slot":"earrings","bodyType":"unisex","style":"studs","colors":{"primary":"#CBD5E1","secondary":"#94A3B8"},"starter":true}'::jsonb),
  ('wear_earrings_gold_studs', 'wearable', 'Gold Studs', 'A touch of shine.', 0, true, 20,
    '{"slot":"earrings","bodyType":"unisex","style":"studs","colors":{"primary":"#F5C542","secondary":"#D4A017"},"starter":true}'::jsonb),
  ('wear_earrings_silver_hoops', 'wearable', 'Silver Hoops', 'Everyday hoops.', 0, true, 30,
    '{"slot":"earrings","bodyType":"unisex","style":"hoops","colors":{"primary":"#CBD5E1","secondary":"#94A3B8"},"starter":true}'::jsonb),
  ('wear_earrings_gold_hoops', 'wearable', 'Gold Hoops', 'Bold and bright.', 0, true, 40,
    '{"slot":"earrings","bodyType":"unisex","style":"hoops","colors":{"primary":"#F5C542","secondary":"#D4A017"},"starter":true}'::jsonb),
  ('wear_earrings_sky_drops', 'wearable', 'Sky Drops', 'Gold drops with a blue gem.', 0, true, 50,
    '{"slot":"earrings","bodyType":"unisex","style":"drops","colors":{"primary":"#F5C542","secondary":"#38BDF8"},"starter":true}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- grant_starter_shop_items (109) grants every active starter wearable; rerun it
-- so existing users get the new accessories.
select public.grant_starter_shop_items(id)
from public.profiles;

-- The parameter is renamed, which create or replace cannot do.
drop function if exists public.save_my_avatar(jsonb, jsonb);

create function public.save_my_avatar(p_appearance jsonb, p_accessories jsonb)
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
    if v_key not in ('headwear', 'earrings') then
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
