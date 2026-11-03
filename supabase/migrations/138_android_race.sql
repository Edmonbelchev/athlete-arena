-- Android race, and Premium now includes only Android.
--   * Android: a legendary race item (metal skin, glowing eyes, receptor ears). Its options are
--     stored in the avatar appearance (androidEyes / androidPlating); its hairstyles reuse 'hair'.
--   * Premium includes the Android race only. Elf and Orc are bought with coins, by everyone.
--     Members wearing Elf or Orc through Premium keep that race (it is added to their inventory),
--     so nobody's avatar changes.
-- Keep in sync with isIncludedWithPremium (src/features/avatar/avatarWardrobe.ts).

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('shop_race_android', 'wearable', 'Android', 'Metal plating, glowing eyes and receptor ears. Keeps your whole look.', 5000, true, 1120,
    '{"slot":"race","bodyType":"unisex","style":"race_android","tier":"legendary","colors":{"primary":"#AFB8C4","secondary":"#3EE2FF"}}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Items Premium includes: the Android race.
create or replace function public.premium_includes_item(p_metadata jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(p_metadata->>'style', '') = 'race_android';
$$;

-- Keep Elf / Orc for members already wearing them through Premium.
insert into public.user_inventory (user_id, item_id, source)
select a.user_id, a.accessories->>'race', 'premium_grandfathered'
from public.user_avatars a
where a.accessories->>'race' in ('shop_race_elf', 'shop_race_orc')
  and not exists (
    select 1 from public.user_inventory i
    where i.user_id = a.user_id and i.item_id = a.accessories->>'race'
  )
on conflict (user_id, item_id) do nothing;

-- Same as 133, with the Android appearance keys accepted.
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
      'mouth', 'hair', 'hairColor', 'facialHair', 'background',
      'elfEars', 'orcEars', 'tusks',
      'androidEyes', 'androidPlating'
    ) then
      raise exception 'Unknown avatar attribute: %', v_key;
    end if;

    if jsonb_typeof(v_value) <> 'string' or (v_value #>> '{}') !~ '^[a-z0-9_]{1,40}$' then
      raise exception 'Invalid value for avatar attribute: %', v_key;
    end if;
  end loop;

  for v_key, v_value in select key, value from jsonb_each(p_accessories) loop
    if v_key not in ('top', 'headwear', 'glasses', 'earrings', 'background', 'race') then
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

    if not public.user_has_shop_item(v_user_id, v_item.id) then
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
