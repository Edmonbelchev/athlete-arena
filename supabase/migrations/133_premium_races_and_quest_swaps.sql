-- Premium perks:
--   1. Elf and Orc races are included while Premium is active (no coins needed). They count as
--      owned in the wardrobe, the shop and when saving the avatar. When Premium lapses, a race
--      that was never bought is taken off the avatar and the profile picture is regenerated.
--   2. Unlimited daily quest swaps: Premium members never pay the 50-coin swap charge.

-- Items Premium includes: every avatar race.
create or replace function public.premium_includes_item(p_metadata jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(p_metadata->>'slot', '') = 'race';
$$;

-- Bought, or included with an active Premium subscription.
create or replace function public.user_has_shop_item(p_user_id uuid, p_item_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.user_inventory where user_id = p_user_id and item_id = p_item_id) then
    return true;
  end if;

  return exists (
    select 1 from public.shop_items
    where id = p_item_id and public.premium_includes_item(metadata)
  ) and public.user_has_premium_access(p_user_id);
end;
$$;

-- Wardrobe (same as 109) plus the races Premium includes.
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
  v_premium boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_premium := public.user_has_premium_access(v_user_id);

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
  where si.item_type = 'wearable'
    and (
      exists (select 1 from public.user_inventory ui where ui.item_id = si.id and ui.user_id = v_user_id)
      or (v_premium and si.is_active and public.premium_includes_item(si.metadata))
    )
  order by si.metadata->>'slot', si.sort_order asc, si.title asc;
end;
$$;

-- Shop catalog (same as 127); Premium-included items read as owned.
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
  v_premium boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_premium := public.user_has_premium_access(v_user_id);

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
    (ui.item_id is not null or (v_premium and public.premium_includes_item(si.metadata))) as owned,
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

-- Same as 132, with ownership through user_has_shop_item (Premium races).
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
      'elfEars', 'orcEars', 'tusks'
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

-- Premium members don't need to buy what Premium already includes.
create or replace function public.reject_purchase_included_with_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'purchase'
    and public.user_has_premium_access(new.user_id)
    and exists (
      select 1 from public.shop_items
      where id = new.item_id and public.premium_includes_item(metadata)
    )
  then
    raise exception 'Included with Premium';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_purchase_included_with_premium on public.user_inventory;
create trigger reject_purchase_included_with_premium
before insert on public.user_inventory
for each row execute function public.reject_purchase_included_with_premium();

-- When Premium ends, take off a race that was never bought. Clearing the profile picture makes
-- the app render a fresh headshot (AvatarHeadshotSync) without the race.
create or replace function public.remove_premium_items_on_lapse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_race_item text;
begin
  if public.user_has_premium_access(new.user_id) then
    return new;
  end if;

  select accessories->>'race' into v_race_item
  from public.user_avatars
  where user_id = new.user_id;

  if v_race_item is null
    or exists (select 1 from public.user_inventory where user_id = new.user_id and item_id = v_race_item)
  then
    return new;
  end if;

  update public.user_avatars
  set accessories = accessories - 'race',
      version = version + 1,
      updated_at = now()
  where user_id = new.user_id;

  update public.profiles
  set avatar_url = null
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists remove_premium_items_on_lapse on public.user_subscriptions;
create trigger remove_premium_items_on_lapse
after insert or update on public.user_subscriptions
for each row execute function public.remove_premium_items_on_lapse();

-- Quest swaps ----------------------------------------------------------------------

-- Same as 127; Premium members swap without the coin charge.
create or replace function public.reroll_daily_mission(
  p_mission_index integer,
  p_exercise public.exercise_type
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_day_number bigint;
  v_tier_roll integer;
  v_target_reps integer;
  v_template public.daily_challenge_templates;
  v_challenge public.daily_challenges;
  v_current_exercises public.exercise_type[];
  v_reroll_used_on date;
  v_coin_balance integer;
  v_swap_cost constant integer := 50;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mission_index < 0 or p_mission_index > 2 then
    raise exception 'Invalid mission index';
  end if;

  if p_exercise not in (
    'push_ups',
    'squats',
    'pull_ups',
    'burpees',
    'half_burpees',
    'jumping_jacks',
    'jumping_squats',
    'lunges',
    'sit_ups'
  ) then
    raise exception 'Exercise cannot be used for daily quests';
  end if;

  select daily_quest_reroll_used_on
  into v_reroll_used_on
  from public.profiles
  where id = v_user_id;

  -- The first swap each day is free; every swap after that costs coins (free with Premium).
  -- Any later error rolls the charge back with the rest of the transaction.
  if v_reroll_used_on = v_today and not public.user_has_premium_access(v_user_id) then
    select coin_balance into v_coin_balance
    from public.profiles
    where id = v_user_id
    for update;

    if coalesce(v_coin_balance, 0) < v_swap_cost then
      raise exception 'Not enough coins - another quest swap today costs % coins', v_swap_cost;
    end if;

    perform set_config('app.bypass_profile_stat_protection', 'true', true);

    update public.profiles
    set coin_balance = coin_balance - v_swap_cost
    where id = v_user_id;

    perform set_config('app.bypass_profile_stat_protection', 'false', true);
  end if;

  perform public.ensure_daily_mission_templates(v_today);

  v_current_exercises := public.get_user_daily_mission_exercises(v_user_id, v_today);

  if p_exercise = any (v_current_exercises) then
    raise exception 'Exercise is already part of today''s quests';
  end if;

  select *
  into v_template
  from public.daily_challenge_templates
  where challenge_date = v_today
    and mission_index = p_mission_index;

  if not found then
    raise exception 'Daily mission template not found';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where user_id = v_user_id
    and challenge_date = v_today
    and mission_index = p_mission_index
  for update;

  if found then
    if v_challenge.status = 'completed' then
      raise exception 'Cannot re-roll a completed quest';
    end if;

    if v_challenge.completed_reps > 0 then
      raise exception 'Cannot re-roll a quest with progress';
    end if;
  end if;

  v_day_number := (extract(epoch from v_today::timestamptz)::bigint / 86400)::bigint;
  v_tier_roll := ((v_day_number + p_mission_index * 17) % 4)::integer;

  select tier.target_reps
  into v_target_reps
  from public.pick_daily_mission_tier(p_exercise, v_tier_roll) as tier;

  if v_challenge.id is null then
    insert into public.daily_challenges (
      user_id,
      exercise_type,
      target_reps,
      xp_reward,
      challenge_date,
      mission_index,
      is_rerolled
    )
    values (
      v_user_id,
      p_exercise,
      v_target_reps,
      50,
      v_today,
      p_mission_index,
      true
    )
    returning * into v_challenge;
  else
    update public.daily_challenges
    set
      exercise_type = p_exercise,
      target_reps = v_target_reps,
      xp_reward = 50,
      completed_reps = 0,
      status = 'pending',
      completed_at = null,
      is_rerolled = true
    where id = v_challenge.id
    returning * into v_challenge;
  end if;

  update public.profiles
  set daily_quest_reroll_used_on = v_today
  where id = v_user_id;

  return v_challenge;
end;
$$;
