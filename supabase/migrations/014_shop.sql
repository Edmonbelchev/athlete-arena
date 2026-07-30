-- Coins, shop catalog, inventory, equipped cosmetics, and related RPCs.

alter table public.profiles
  add column if not exists coin_balance integer not null default 0 check (coin_balance >= 0);

create or replace function public.protect_profile_stats()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.bypass_profile_stat_protection', true), '') = 'true' then
    return new;
  end if;

  if new.total_xp is distinct from old.total_xp
     or new.level is distinct from old.level
     or new.current_streak is distinct from old.current_streak
     or new.longest_streak is distinct from old.longest_streak
     or new.coin_balance is distinct from old.coin_balance then
    raise exception 'Profile stats cannot be modified directly';
  end if;

  return new;
end;
$$;

create table if not exists public.shop_items (
  id text primary key,
  item_type text not null check (item_type in ('avatar', 'frame', 'emote')),
  title text not null,
  description text not null default '',
  image_url text,
  price_coins integer not null default 0 check (price_coins >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.shop_items (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  source text not null default 'purchase',
  primary key (user_id, item_id)
);

create table if not exists public.user_equipped_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null check (slot in ('avatar', 'frame', 'emote')),
  item_id text not null,
  equipped_at timestamptz not null default now(),
  primary key (user_id, slot),
  foreign key (user_id, item_id) references public.user_inventory (user_id, item_id) on delete cascade
);

alter table public.friend_challenges
  add column if not exists creator_emote_id text references public.shop_items (id);

create index if not exists user_inventory_user_id_idx on public.user_inventory (user_id);
create index if not exists shop_items_type_sort_idx on public.shop_items (item_type, sort_order);

alter table public.shop_items enable row level security;
alter table public.user_inventory enable row level security;
alter table public.user_equipped_items enable row level security;

drop policy if exists "Anyone can read active shop items" on public.shop_items;
create policy "Anyone can read active shop items"
  on public.shop_items
  for select
  using (is_active = true);

drop policy if exists "Users can read own inventory" on public.user_inventory;
create policy "Users can read own inventory"
  on public.user_inventory
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own equipped items" on public.user_equipped_items;
create policy "Users can read own equipped items"
  on public.user_equipped_items
  for select
  using (auth.uid() = user_id);

insert into public.shop_items (id, item_type, title, description, price_coins, sort_order, metadata)
values
  ('avatar_rookie', 'avatar', 'Rookie', 'Your default arena look.', 0, 10, '{"icon":"profile","backgroundColor":"#6366F1"}'::jsonb),
  ('avatar_flame', 'avatar', 'Blaze', 'Bring the heat.', 0, 20, '{"icon":"flame","backgroundColor":"#F97316"}'::jsonb),
  ('avatar_star', 'avatar', 'All-Star', 'Shine on the leaderboard.', 0, 30, '{"icon":"star","backgroundColor":"#F59E0B"}'::jsonb),
  ('avatar_champion', 'avatar', 'Champion', 'Reserved for true competitors.', 400, 40, '{"icon":"crown","backgroundColor":"#8B5CF6"}'::jsonb),
  ('avatar_rocket', 'avatar', 'Rocket', 'Launch past the competition.', 500, 50, '{"icon":"rocket","backgroundColor":"#0EA5E9"}'::jsonb),
  ('frame_basic', 'frame', 'Classic Frame', 'A clean border for your avatar.', 0, 10, '{"borderColor":"#CBD5E1","borderWidth":3}'::jsonb),
  ('frame_gold', 'frame', 'Gold Frame', 'Premium gold trim.', 300, 20, '{"borderColor":"#F59E0B","borderWidth":4}'::jsonb),
  ('frame_neon', 'frame', 'Neon Frame', 'Electric style for night owls.', 450, 30, '{"borderColor":"#22D3EE","borderWidth":4}'::jsonb),
  ('emote_wave', 'emote', 'Wave', 'Say hello before a challenge.', 0, 10, '{"emoji":"👋"}'::jsonb),
  ('emote_fire', 'emote', 'On Fire', 'Celebrate a hot streak.', 150, 20, '{"emoji":"🔥"}'::jsonb),
  ('emote_muscle', 'emote', 'Flex', 'Show off after a win.', 150, 30, '{"emoji":"💪"}'::jsonb),
  ('emote_trophy', 'emote', 'Trophy', 'Victory dance.', 200, 40, '{"emoji":"🏆"}'::jsonb)
on conflict (id) do nothing;

create or replace function public.award_coins(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Coin amount must be positive';
  end if;

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set coin_balance = coin_balance + p_amount
  where id = p_user_id
  returning coin_balance into v_new_balance;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  return coalesce(v_new_balance, 0);
end;
$$;

create or replace function public.grant_starter_shop_items(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_inventory (user_id, item_id, source)
  select p_user_id, id, 'default'
  from public.shop_items
  where price_coins = 0
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
  where si.is_active = true
    and (p_item_type is null or si.item_type = p_item_type)
  order by si.sort_order asc, si.title asc;
end;
$$;

create or replace function public.get_my_shop_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_coin_balance integer;
  v_inventory jsonb;
  v_equipped jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coin_balance into v_coin_balance
  from public.profiles
  where id = v_user_id;

  select coalesce(jsonb_agg(item_id order by acquired_at), '[]'::jsonb)
  into v_inventory
  from public.user_inventory
  where user_id = v_user_id;

  select coalesce(jsonb_object_agg(slot, item_id), '{}'::jsonb)
  into v_equipped
  from public.user_equipped_items
  where user_id = v_user_id;

  return jsonb_build_object(
    'coin_balance', coalesce(v_coin_balance, 0),
    'inventory', v_inventory,
    'equipped', v_equipped
  );
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
  where id = p_item_id and is_active = true;

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
  where id = p_item_id and is_active = true;

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

-- Grant starter items to existing users.
select public.grant_starter_shop_items(id)
from public.profiles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  final_username text;
begin
  raw_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));

  if raw_username = '' or raw_username !~ '^[a-z0-9_]{3,30}$' then
    raw_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_username := raw_username;

  while exists (
    select 1
    from public.profiles
    where lower(username) = final_username
  ) loop
    final_username := raw_username || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  );

  perform public.grant_starter_shop_items(new.id);

  return new;
end;
$$;

-- Award coins when completing a daily challenge.
create or replace function public.complete_challenge(
  p_challenge_id uuid,
  p_completed_reps integer
)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.daily_challenges;
  v_yesterday date := current_date - 1;
  v_yesterday_completed boolean;
  v_current_streak integer;
  v_new_streak integer;
  v_new_longest_streak integer;
  v_new_total_xp integer;
  v_new_level integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_challenge
  from public.daily_challenges
  where id = p_challenge_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status = 'completed' then
    return v_challenge;
  end if;

  if v_challenge.status <> 'in_progress' then
    raise exception 'Challenge is not in progress';
  end if;

  if p_completed_reps < v_challenge.target_reps then
    raise exception 'Target reps not met';
  end if;

  update public.daily_challenges
  set
    status = 'completed',
    completed_reps = p_completed_reps,
    completed_at = now()
  where id = p_challenge_id
  returning * into v_challenge;

  select exists (
    select 1
    from public.daily_challenges
    where user_id = v_user_id
      and challenge_date = v_yesterday
      and status = 'completed'
  )
  into v_yesterday_completed;

  select current_streak, longest_streak, total_xp
  into v_current_streak, v_new_longest_streak, v_new_total_xp
  from public.profiles
  where id = v_user_id;

  if v_yesterday_completed then
    v_new_streak := v_current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  v_new_longest_streak := greatest(v_new_longest_streak, v_new_streak);
  v_new_total_xp := v_new_total_xp + v_challenge.xp_reward;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set
    total_xp = v_new_total_xp,
    level = v_new_level,
    current_streak = v_new_streak,
    longest_streak = v_new_longest_streak
  where id = v_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.award_coins(v_user_id, 25);

  return v_challenge;
end;
$$;

create or replace function public.create_friend_challenge(
  p_friend_id uuid,
  p_exercise public.exercise_type,
  p_target_reps integer,
  p_message text default null,
  p_time_limit_seconds integer default null,
  p_emote_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge_id uuid;
  v_xp integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_reps < 1 or p_target_reps > 100 then
    raise exception 'Target reps must be between 1 and 100';
  end if;

  if p_time_limit_seconds is not null
     and (p_time_limit_seconds < 60 or p_time_limit_seconds > 5400) then
    raise exception 'Time limit must be between 60 and 5400 seconds';
  end if;

  if not public.users_are_friends(v_user_id, p_friend_id) then
    raise exception 'You can only challenge friends';
  end if;

  if p_emote_id is not null then
    if not exists (
      select 1
      from public.user_inventory ui
      join public.shop_items si on si.id = ui.item_id
      where ui.user_id = v_user_id
        and ui.item_id = p_emote_id
        and si.item_type = 'emote'
    ) then
      raise exception 'Emote not owned';
    end if;
  end if;

  v_xp := public.calculate_friend_challenge_xp(p_target_reps);

  insert into public.friend_challenges (
    creator_id, exercise_type, target_reps, xp_reward, message, time_limit_seconds, creator_emote_id
  )
  values (
    v_user_id, p_exercise, p_target_reps, v_xp, nullif(trim(p_message), ''), p_time_limit_seconds, p_emote_id
  )
  returning id into v_challenge_id;

  insert into public.friend_challenge_participants (challenge_id, user_id, status)
  values
    (v_challenge_id, v_user_id, 'in_progress'),
    (v_challenge_id, p_friend_id, 'pending');

  return v_challenge_id;
end;
$$;

drop function if exists public.get_my_friend_challenges();

create or replace function public.get_my_friend_challenges()
returns table (
  participant_id uuid,
  challenge_id uuid,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  message text,
  time_limit_seconds integer,
  deadline_at timestamptz,
  status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  started_at timestamptz,
  xp_earned integer,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer,
  opponent_completed_at timestamptz,
  opponent_started_at timestamptz,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text
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

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    fc.time_limit_seconds,
    fc.deadline_at,
    mine.status,
    mine.completed_reps,
    mine.completed_at,
    mine.started_at,
    mine.xp_earned,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps,
    opponent.completed_at as opponent_completed_at,
    opponent.started_at as opponent_started_at,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.user_id = v_user_id
    and mine.status not in ('declined', 'expired')
    and (
      mine.status in ('pending', 'in_progress')
      or fc.resolved_at is null
    )
  order by fc.created_at desc;
end;
$$;

drop function if exists public.get_friend_challenge_detail(uuid);

create or replace function public.get_friend_challenge_detail(p_participant_id uuid)
returns table (
  participant_id uuid,
  challenge_id uuid,
  exercise_type public.exercise_type,
  target_reps integer,
  xp_reward integer,
  message text,
  time_limit_seconds integer,
  deadline_at timestamptz,
  status public.challenge_status,
  completed_reps integer,
  completed_at timestamptz,
  started_at timestamptz,
  xp_earned integer,
  created_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  is_creator boolean,
  opponent_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_status public.challenge_status,
  opponent_completed_reps integer,
  opponent_completed_at timestamptz,
  opponent_started_at timestamptz,
  winner_user_id uuid,
  resolved_at timestamptz,
  creator_emote_id text,
  creator_emote_emoji text
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

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  select
    mine.id as participant_id,
    fc.id as challenge_id,
    fc.exercise_type,
    fc.target_reps,
    fc.xp_reward,
    fc.message,
    fc.time_limit_seconds,
    fc.deadline_at,
    mine.status,
    mine.completed_reps,
    mine.completed_at,
    mine.started_at,
    mine.xp_earned,
    fc.created_at,
    fc.creator_id,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    fc.creator_id = v_user_id as is_creator,
    opponent.user_id as opponent_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    opponent.status as opponent_status,
    opponent.completed_reps as opponent_completed_reps,
    opponent.completed_at as opponent_completed_at,
    opponent.started_at as opponent_started_at,
    fc.winner_user_id,
    fc.resolved_at,
    fc.creator_emote_id,
    coalesce(creator_emote.metadata->>'emoji', null) as creator_emote_emoji
  from public.friend_challenge_participants mine
  join public.friend_challenges fc on fc.id = mine.challenge_id
  join public.profiles creator on creator.id = fc.creator_id
  join public.friend_challenge_participants opponent
    on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
  join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
  left join public.shop_items creator_emote on creator_emote.id = fc.creator_emote_id
  where mine.id = p_participant_id
    and mine.user_id = v_user_id;
end;
$$;

grant execute on function public.get_shop_catalog(text) to authenticated;
grant execute on function public.get_my_shop_summary() to authenticated;
grant execute on function public.purchase_shop_item(text) to authenticated;
grant execute on function public.equip_shop_item(text) to authenticated;
grant execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text, integer, text) to authenticated;
grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.get_friend_challenge_detail(uuid) to authenticated;

revoke execute on function public.create_friend_challenge(uuid, public.exercise_type, integer, text, integer) from authenticated;

-- Award coins alongside friend challenge XP.
create or replace function public.award_friend_challenge_xp(
  p_user_id uuid,
  p_xp integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_total_xp integer;
  v_new_level integer;
begin
  if p_xp <= 0 then
    return;
  end if;

  select total_xp into v_new_total_xp from public.profiles where id = p_user_id;
  v_new_total_xp := v_new_total_xp + p_xp;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set total_xp = v_new_total_xp, level = v_new_level
  where id = p_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.award_coins(p_user_id, greatest(10, floor(p_xp / 5)::integer));
end;
$$;
