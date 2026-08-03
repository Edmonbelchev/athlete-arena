-- Shop sells emotes only (exclude Trophy). Avatars and frames are no longer purchasable.

update public.shop_items
set is_active = false
where item_type in ('avatar', 'frame')
   or id = 'emote_trophy';

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

  insert into public.user_equipped_items (user_id, slot, item_id)
  values
    (p_user_id, 'avatar', 'avatar_rookie'),
    (p_user_id, 'emote', 'emote_wave')
  on conflict (user_id, slot) do nothing;
end;
$$;

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
        and si.item_type = 'emote'
        and si.id <> 'emote_trophy'
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
  v_price integer;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select price_coins
  into v_price
  from public.shop_items
  where id = p_item_id
    and is_active = true
    and item_type = 'emote'
    and id <> 'emote_trophy';

  if not found then
    raise exception 'Item not found';
  end if;

  if exists (
    select 1 from public.user_inventory where user_id = v_user_id and item_id = p_item_id
  ) then
    return 'already_owned';
  end if;

  select coin_balance into v_balance
  from public.profiles
  where id = v_user_id;

  if coalesce(v_balance, 0) < v_price then
    raise exception 'Not enough coins';
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set coin_balance = coin_balance - v_price
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  insert into public.user_inventory (user_id, item_id, source)
  values (v_user_id, p_item_id, 'purchase');

  return 'purchased';
end;
$$;

create or replace function public.equip_shop_item(p_item_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_slot text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.user_inventory where user_id = v_user_id and item_id = p_item_id
  ) then
    raise exception 'Item not owned';
  end if;

  select * into v_item
  from public.shop_items
  where id = p_item_id;

  if not found then
    raise exception 'Item not found';
  end if;

  v_slot := v_item.item_type;

  insert into public.user_equipped_items (user_id, slot, item_id)
  values (v_user_id, v_slot, p_item_id)
  on conflict (user_id, slot)
  do update set item_id = excluded.item_id, equipped_at = now();

  if v_slot = 'avatar' then
    update public.profiles
    set avatar_url = v_item.image_url
    where id = v_user_id;
  end if;

  return 'equipped';
end;
$$;
