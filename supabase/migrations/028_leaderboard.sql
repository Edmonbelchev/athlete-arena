-- Weekly (Monday UTC) and all-time XP leaderboards.

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  source_type text not null,
  source_id text,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_user_created_idx
  on public.xp_events (user_id, created_at desc);

create index if not exists xp_events_created_idx
  on public.xp_events (created_at desc);

alter table public.xp_events enable row level security;

create or replace function public.log_xp_event(
  p_user_id uuid,
  p_amount integer,
  p_source_type text,
  p_source_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_amount <= 0 then
    return;
  end if;

  insert into public.xp_events (user_id, amount, source_type, source_id)
  values (p_user_id, p_amount, p_source_type, nullif(trim(p_source_id), ''));
end;
$$;

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

  perform public.log_xp_event(p_user_id, p_xp, 'xp_award', null);
end;
$$;

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

  perform public.log_xp_event(
    v_user_id,
    v_challenge.xp_reward,
    'daily_challenge',
    v_challenge.id::text
  );

  perform public.award_coins(v_user_id, 50);

  return v_challenge;
end;
$$;

create or replace function public.get_xp_leaderboard(
  p_period text default 'weekly',
  p_limit integer default 50
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  level integer,
  xp_amount bigint,
  avatar_url text,
  avatar_icon text,
  avatar_background text,
  frame_border_color text,
  frame_border_width integer,
  is_current_user boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_period not in ('weekly', 'all_time') then
    raise exception 'Invalid leaderboard period';
  end if;

  if p_period = 'weekly' then
    return query
    with week_start as (
      select date_trunc('week', timezone('utc', now())) as starts_at
    ),
    weekly_totals as (
      select
        e.user_id,
        sum(e.amount)::bigint as xp_amount
      from public.xp_events e
      cross join week_start w
      where e.created_at >= w.starts_at
      group by e.user_id
      having sum(e.amount) > 0
    ),
    ranked as (
      select
        row_number() over (order by wt.xp_amount desc, p.username asc) as rank,
        p.id as user_id,
        p.username,
        p.display_name,
        p.level,
        wt.xp_amount,
        p.avatar_url,
        avatar_item.metadata->>'icon' as avatar_icon,
        avatar_item.metadata->>'backgroundColor' as avatar_background,
        frame_item.metadata->>'borderColor' as frame_border_color,
        nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
        (p.id = v_user_id) as is_current_user
      from weekly_totals wt
      join public.profiles p on p.id = wt.user_id
      left join public.user_equipped_items uei_avatar
        on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
      left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
      left join public.user_equipped_items uei_frame
        on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
      left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
    )
    select *
    from ranked r
    where r.rank <= v_limit or r.is_current_user
    order by r.rank;

    return;
  end if;

  return query
  with ranked as (
    select
      row_number() over (order by p.total_xp desc, p.username asc) as rank,
      p.id as user_id,
      p.username,
      p.display_name,
      p.level,
      p.total_xp::bigint as xp_amount,
      p.avatar_url,
      avatar_item.metadata->>'icon' as avatar_icon,
      avatar_item.metadata->>'backgroundColor' as avatar_background,
      frame_item.metadata->>'borderColor' as frame_border_color,
      nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
      (p.id = v_user_id) as is_current_user
    from public.profiles p
    left join public.user_equipped_items uei_avatar
      on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
    left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
    left join public.user_equipped_items uei_frame
      on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
    left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
    where p.total_xp > 0
  )
  select *
  from ranked r
  where r.rank <= v_limit or r.is_current_user
  order by r.rank;
end;
$$;

grant execute on function public.get_xp_leaderboard(text, integer) to authenticated;
