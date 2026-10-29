-- Five more avatar backgrounds, and paid daily quest swaps: the first swap each day stays
-- free, every swap after that costs 50 coins.
--
-- Safe to re-run. It also removes the sports gear slot and mission re-roll packs from an
-- earlier draft of this migration, if that draft was applied.

-- Earlier draft cleanup ------------------------------------------------------------

update public.user_avatars
set accessories = accessories - 'gear'
where accessories ? 'gear';

delete from public.user_equipped_items
where item_id in (
  select id from public.shop_items
  where item_type = 'mission_rerolls' or metadata->>'slot' = 'gear'
);

delete from public.user_inventory
where item_id in (
  select id from public.shop_items
  where item_type = 'mission_rerolls' or metadata->>'slot' = 'gear'
);

delete from public.shop_items
where item_type = 'mission_rerolls' or metadata->>'slot' = 'gear';

drop function if exists public.get_my_mission_reroll_balance();
drop table if exists public.user_mission_rerolls;

alter table public.shop_items
  drop constraint if exists shop_items_item_type_check;

alter table public.shop_items
  add constraint shop_items_item_type_check
  check (item_type in ('avatar', 'frame', 'emote', 'wearable', 'challenge_slots'));

-- Same as 118 (restores them if the draft changed them).
create or replace function public.purchase_shop_item(p_item_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_balance integer;
  v_slots integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item
  from public.shop_items
  where id = p_item_id
    and is_active = true
    and (
      (item_type = 'emote' and id <> 'emote_trophy')
      or item_type in ('wearable', 'challenge_slots', 'frame')
    );

  if not found then
    raise exception 'Item not found';
  end if;

  if v_item.item_type = 'challenge_slots' then
    if public.user_has_premium_access(v_user_id) then
      raise exception 'Premium members already have unlimited challenge requests';
    end if;

    v_slots := coalesce((v_item.metadata->>'slots')::integer, 0);
    if v_slots <= 0 then
      raise exception 'Item not found';
    end if;
  elsif exists (
    select 1 from public.user_inventory where user_id = v_user_id and item_id = p_item_id
  ) then
    return 'already_owned';
  end if;

  -- Lock the balance so two purchases at once cannot both spend the same coins.
  select coin_balance into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if coalesce(v_balance, 0) < v_item.price_coins then
    raise exception 'Not enough coins';
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set coin_balance = coin_balance - v_item.price_coins
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  if v_item.item_type = 'challenge_slots' then
    insert into public.user_challenge_slots (user_id, balance)
    values (v_user_id, v_slots)
    on conflict (user_id) do update
    set balance = public.user_challenge_slots.balance + excluded.balance, updated_at = now();
  else
    insert into public.user_inventory (user_id, item_id, source)
    values (v_user_id, p_item_id, 'purchase');
  end if;

  return 'purchased';
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

-- Same as 126 (accessory slots without 'gear').
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

-- Backgrounds --------------------------------------------------------------------

insert into public.shop_items (id, item_type, title, description, price_coins, is_active, sort_order, metadata)
values
  ('shop_bg_gym', 'wearable', 'Home Gym', 'Racks, plates and zero excuses.', 400, true, 980,
    '{"slot":"background","bodyType":"unisex","style":"scene_gym","tier":"basic","colors":{"primary":"#E5E7EB","secondary":"#9CA3AF"}}'::jsonb),
  ('shop_bg_rainy_city', 'wearable', 'Rainy City', 'Training does not stop for the weather.', 700, true, 990,
    '{"slot":"background","bodyType":"unisex","style":"scene_rainy_city","tier":"rare","colors":{"primary":"#475569","secondary":"#94A3B8"}}'::jsonb),
  ('shop_bg_boxing_ring', 'wearable', 'Boxing Ring', 'Step into the spotlight.', 700, true, 1000,
    '{"slot":"background","bodyType":"unisex","style":"scene_boxing_ring","tier":"rare","colors":{"primary":"#0F0F12","secondary":"#3F1D1D"}}'::jsonb),
  ('shop_bg_stadium', 'wearable', 'Stadium Lights', 'The crowd is on its feet.', 1200, true, 1010,
    '{"slot":"background","bodyType":"unisex","style":"scene_stadium","tier":"legendary","colors":{"primary":"#0B1026","secondary":"#1E3A8A"}}'::jsonb),
  ('shop_bg_volcano', 'wearable', 'Volcano', 'Hotter than your last workout.', 1500, true, 1020,
    '{"slot":"background","bodyType":"unisex","style":"scene_volcano","tier":"legendary","colors":{"primary":"#7F1D1D","secondary":"#F97316"}}'::jsonb)
on conflict (id) do update
set
  item_type = excluded.item_type,
  title = excluded.title,
  description = excluded.description,
  price_coins = excluded.price_coins,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

-- Quest swaps ----------------------------------------------------------------------

-- Same as 122, with paid swaps after the free one of the day.
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

  -- The first swap each day is free; every swap after that costs coins.
  -- Any later error rolls the charge back with the rest of the transaction.
  if v_reroll_used_on = v_today then
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
