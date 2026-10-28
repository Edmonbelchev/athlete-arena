-- Avatar tops (tee / hoodie) shown on the shoulders. A new 'top' accessory slot
-- with free starter items; tops can be sold in the shop later like other wearables.

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('wear_top_arena_tee', 'wearable', 'Arena Tee', 'The classic training tee.', 0, true, 10,
    '{"slot":"top","bodyType":"unisex","style":"tee","colors":{"primary":"#6366F1","secondary":"#4338CA"},"starter":true}'::jsonb),
  ('wear_top_white_tee', 'wearable', 'White Tee', 'Clean and simple.', 0, true, 20,
    '{"slot":"top","bodyType":"unisex","style":"tee","colors":{"primary":"#F8FAFC","secondary":"#CBD5E1"},"starter":true}'::jsonb),
  ('wear_top_gray_hoodie', 'wearable', 'Gray Hoodie', 'Warm-up essential.', 0, true, 30,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","colors":{"primary":"#9CA3AF","secondary":"#6B7280"},"starter":true}'::jsonb),
  ('wear_top_black_hoodie', 'wearable', 'Black Hoodie', 'For early morning sessions.', 0, true, 40,
    '{"slot":"top","bodyType":"unisex","style":"hoodie","colors":{"primary":"#1F2937","secondary":"#111827"},"starter":true}'::jsonb)
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

-- Same as 110, with 'top' added to the accepted accessory slots.
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
    if v_key not in ('top', 'headwear', 'earrings') then
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
