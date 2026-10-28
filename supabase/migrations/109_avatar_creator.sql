-- Avatar creator: per-user appearance + outfit, wearable shop items, starter wardrobe.
--
-- Appearance (body type, face, hair, colors) is free and stored as option ids that
-- the app maps to SVG parts. Wearables are shop_items with item_type = 'wearable'
-- and metadata {slot, bodyType, style, colors, starter}. Ownership reuses user_inventory.

alter table public.shop_items
  drop constraint if exists shop_items_item_type_check;

alter table public.shop_items
  add constraint shop_items_item_type_check
  check (item_type in ('avatar', 'frame', 'emote', 'wearable'));

create table if not exists public.user_avatars (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  appearance jsonb not null,
  outfit jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_avatars enable row level security;

drop policy if exists "Users can read own avatar" on public.user_avatars;
create policy "Users can read own avatar"
  on public.user_avatars
  for select
  using (auth.uid() = user_id);

-- Writes go through save_my_avatar only.

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('wear_m_top_arena_tee', 'wearable', 'Arena Tee', 'The classic training tee.', 0, true, 10,
    '{"slot":"top","bodyType":"male","style":"tee","colors":{"primary":"#6366F1","secondary":"#4338CA"},"starter":true}'::jsonb),
  ('wear_m_top_training_tank', 'wearable', 'Training Tank', 'Freedom for the shoulders.', 0, true, 20,
    '{"slot":"top","bodyType":"male","style":"tank","colors":{"primary":"#64748B","secondary":"#334155"},"starter":true}'::jsonb),
  ('wear_m_bottom_gym_shorts', 'wearable', 'Gym Shorts', 'Ready for leg day.', 0, true, 10,
    '{"slot":"bottom","bodyType":"male","style":"shorts","colors":{"primary":"#1F2937","secondary":"#6366F1"},"starter":true}'::jsonb),
  ('wear_m_bottom_joggers', 'wearable', 'Joggers', 'Warm-up to cool-down.', 0, true, 20,
    '{"slot":"bottom","bodyType":"male","style":"joggers","colors":{"primary":"#374151","secondary":"#111827"},"starter":true}'::jsonb),
  ('wear_m_shoes_classic', 'wearable', 'Classic Sneakers', 'Clean and simple.', 0, true, 10,
    '{"slot":"shoes","bodyType":"male","style":"sneakers","colors":{"primary":"#F8FAFC","secondary":"#94A3B8"},"starter":true}'::jsonb),
  ('wear_f_top_arena_tee', 'wearable', 'Arena Tee', 'The classic training tee.', 0, true, 10,
    '{"slot":"top","bodyType":"female","style":"tee","colors":{"primary":"#6366F1","secondary":"#4338CA"},"starter":true}'::jsonb),
  ('wear_f_top_training_tank', 'wearable', 'Training Tank', 'Light and breathable.', 0, true, 20,
    '{"slot":"top","bodyType":"female","style":"tank","colors":{"primary":"#EC4899","secondary":"#BE185D"},"starter":true}'::jsonb),
  ('wear_f_bottom_gym_shorts', 'wearable', 'Gym Shorts', 'Ready for leg day.', 0, true, 10,
    '{"slot":"bottom","bodyType":"female","style":"shorts","colors":{"primary":"#1F2937","secondary":"#EC4899"},"starter":true}'::jsonb),
  ('wear_f_bottom_leggings', 'wearable', 'Leggings', 'Move without limits.', 0, true, 20,
    '{"slot":"bottom","bodyType":"female","style":"leggings","colors":{"primary":"#111827","secondary":"#6366F1"},"starter":true}'::jsonb),
  ('wear_f_shoes_classic', 'wearable', 'Classic Sneakers', 'Clean and simple.', 0, true, 10,
    '{"slot":"shoes","bodyType":"female","style":"sneakers","colors":{"primary":"#F8FAFC","secondary":"#94A3B8"},"starter":true}'::jsonb),
  ('wear_u_headwear_sweatband', 'wearable', 'Sweatband', 'Keep your focus.', 0, true, 10,
    '{"slot":"headwear","bodyType":"unisex","style":"headband","colors":{"primary":"#EF4444","secondary":"#B91C1C"},"starter":true}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

create or replace function public.grant_starter_shop_items(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_inventory (user_id, item_id, source)
  values
    (p_user_id, 'avatar_rookie', 'default'),
    (p_user_id, 'emote_wave', 'default')
  on conflict do nothing;

  insert into public.user_inventory (user_id, item_id, source)
  select p_user_id, si.id, 'default'
  from public.shop_items si
  where si.item_type = 'wearable'
    and si.is_active = true
    and coalesce((si.metadata->>'starter')::boolean, false)
  on conflict do nothing;

  insert into public.user_equipped_items (user_id, slot, item_id)
  values
    (p_user_id, 'avatar', 'avatar_rookie'),
    (p_user_id, 'emote', 'emote_wave')
  on conflict (user_id, slot) do nothing;
end;
$$;

-- Give the starter wardrobe to existing users.
select public.grant_starter_shop_items(id)
from public.profiles;

-- Wearables the user can dress their avatar with (owned only for now; the shop
-- will list purchasable wearables once they exist).
create or replace function public.get_my_wardrobe()
returns table (
  id text,
  title text,
  description text,
  image_url text,
  price_coins integer,
  sort_order integer,
  metadata jsonb,
  owned boolean
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
    si.title,
    si.description,
    si.image_url,
    si.price_coins,
    si.sort_order,
    si.metadata,
    true as owned
  from public.shop_items si
  join public.user_inventory ui
    on ui.item_id = si.id and ui.user_id = v_user_id
  where si.item_type = 'wearable'
  order by si.metadata->>'slot', si.sort_order asc, si.title asc;
end;
$$;

create or replace function public.save_my_avatar(p_appearance jsonb, p_outfit jsonb)
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

  if p_outfit is null or jsonb_typeof(p_outfit) <> 'object' then
    raise exception 'Invalid avatar outfit';
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

  if not (p_outfit ? 'top') or not (p_outfit ? 'bottom') then
    raise exception 'Avatar outfit needs a top and a bottom';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_outfit) loop
    if v_key not in ('top', 'bottom', 'shoes', 'headwear', 'accessory') then
      raise exception 'Unknown outfit slot: %', v_key;
    end if;

    if jsonb_typeof(v_value) <> 'string' then
      raise exception 'Invalid item for outfit slot: %', v_key;
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
      raise exception 'Item does not fit outfit slot: %', v_key;
    end if;

    if v_item.metadata->>'bodyType' not in (v_body_type, 'unisex') then
      raise exception 'Item does not fit this body type';
    end if;
  end loop;

  insert into public.user_avatars (user_id, appearance, outfit)
  values (v_user_id, p_appearance, p_outfit)
  on conflict (user_id) do update
  set
    appearance = excluded.appearance,
    outfit = excluded.outfit,
    version = public.user_avatars.version + 1,
    updated_at = now()
  returning version into v_version;

  return v_version;
end;
$$;

-- Avatar headshots are uploaded as PNG to {user_id}/avatar.png in the existing bucket.
