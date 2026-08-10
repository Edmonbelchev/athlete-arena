-- Achievement catalog refresh: new goals/login/friend-win milestones, coin rewards, remove level achievements.

alter table public.achievements
  add column if not exists coin_reward integer not null default 0 check (coin_reward >= 0);

comment on column public.achievements.coin_reward is
  'Coins granted when the achievement is first unlocked.';

alter table public.profiles
  add column if not exists login_streak integer not null default 0
    check (login_streak >= 0);

alter table public.profiles
  add column if not exists login_streak_last_date date;

comment on column public.profiles.login_streak is
  'Consecutive days the user opened the app (updated by sync_user_achievements).';

comment on column public.profiles.login_streak_last_date is
  'UTC date when login_streak was last advanced.';

create or replace function public.check_achievement_requirement(
  p_requirements jsonb,
  p_completed_challenges bigint,
  p_total_xp integer,
  p_level integer,
  p_current_streak integer,
  p_longest_streak integer,
  p_push_ups_total bigint,
  p_squats_total bigint,
  p_pull_ups_total bigint,
  p_dips_total bigint,
  p_friend_races_won bigint,
  p_friends_count bigint,
  p_goals_created bigint,
  p_goals_completed bigint,
  p_login_streak integer
)
returns boolean
language plpgsql
immutable
as $$
declare
  req_type text := p_requirements ->> 'type';
  req_min numeric := coalesce((p_requirements ->> 'min')::numeric, 0);
begin
  case req_type
    when 'completed_challenges' then
      return p_completed_challenges >= req_min;
    when 'total_xp' then
      return p_total_xp >= req_min;
    when 'level' then
      return p_level >= req_min;
    when 'current_streak' then
      return p_current_streak >= req_min;
    when 'longest_streak' then
      return greatest(p_current_streak, p_longest_streak) >= req_min;
    when 'push_ups_total' then
      return p_push_ups_total >= req_min;
    when 'squats_total' then
      return p_squats_total >= req_min;
    when 'pull_ups_total' then
      return p_pull_ups_total >= req_min;
    when 'dips_total' then
      return p_dips_total >= req_min;
    when 'friend_races_won' then
      return p_friend_races_won >= req_min;
    when 'friends_count' then
      return p_friends_count >= req_min;
    when 'goals_created' then
      return p_goals_created >= req_min;
    when 'goals_completed' then
      return p_goals_completed >= req_min;
    when 'login_streak' then
      return p_login_streak >= req_min;
    else
      return false;
  end case;
end;
$$;

create or replace function public.sync_user_achievements(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_today date := current_date;
  v_completed_challenges bigint;
  v_total_xp integer;
  v_level integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_push_ups_total bigint;
  v_squats_total bigint;
  v_pull_ups_total bigint;
  v_dips_total bigint;
  v_friend_races_won bigint;
  v_friends_count bigint;
  v_goals_created bigint;
  v_goals_completed bigint;
  v_login_streak integer;
  v_login_last_date date;
  v_achievement record;
  v_inserted integer;
  v_new_unlocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select login_streak, login_streak_last_date
  into v_login_streak, v_login_last_date
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_login_last_date is distinct from v_today then
    if v_login_last_date = v_today - 1 then
      v_login_streak := coalesce(v_login_streak, 0) + 1;
    else
      v_login_streak := 1;
    end if;

    update public.profiles
    set
      login_streak = v_login_streak,
      login_streak_last_date = v_today
    where id = v_user_id;
  end if;

  select
    count(*) filter (where dc.status = 'completed'),
    p.total_xp,
    p.level,
    p.current_streak,
    p.longest_streak,
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'push_ups'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'squats'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'pull_ups'
    ), 0),
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'dips'
    ), 0),
    p.login_streak
  into
    v_completed_challenges,
    v_total_xp,
    v_level,
    v_current_streak,
    v_longest_streak,
    v_push_ups_total,
    v_squats_total,
    v_pull_ups_total,
    v_dips_total,
    v_login_streak
  from public.profiles p
  left join public.daily_challenges dc on dc.user_id = p.id
  where p.id = v_user_id
  group by p.id;

  select count(*)
  into v_friend_races_won
  from public.friend_challenges
  where winner_user_id = v_user_id;

  select count(*)
  into v_friends_count
  from public.friendships f
  where f.status = 'accepted'
    and (f.requester_id = v_user_id or f.addressee_id = v_user_id);

  select count(*)
  into v_goals_created
  from public.user_goals
  where user_id = v_user_id;

  select count(*)
  into v_goals_completed
  from public.user_goals
  where user_id = v_user_id
    and status = 'completed';

  for v_achievement in
    select id, requirements, xp_reward, coin_reward
    from public.achievements
    where is_active = true
  loop
    if public.check_achievement_requirement(
      v_achievement.requirements,
      v_completed_challenges,
      v_total_xp,
      v_level,
      v_current_streak,
      v_longest_streak,
      v_push_ups_total,
      v_squats_total,
      v_pull_ups_total,
      v_dips_total,
      v_friend_races_won,
      v_friends_count,
      v_goals_created,
      v_goals_completed,
      v_login_streak
    ) then
      insert into public.user_achievements (user_id, achievement_id)
      values (v_user_id, v_achievement.id)
      on conflict do nothing;

      get diagnostics v_inserted = row_count;

      if v_inserted > 0 then
        v_new_unlocks := v_new_unlocks + v_inserted;
        if coalesce(v_achievement.xp_reward, 0) > 0 then
          perform public.award_friend_challenge_xp(v_user_id, v_achievement.xp_reward);
        end if;
        if coalesce(v_achievement.coin_reward, 0) > 0 then
          perform public.award_coins(v_user_id, v_achievement.coin_reward);
        end if;
      end if;
    end if;
  end loop;

  return v_new_unlocks;
end;
$$;

drop function if exists public.get_my_achievements();

create or replace function public.get_my_achievements()
returns table (
  id text,
  title text,
  description text,
  image_url text,
  icon text,
  requirements jsonb,
  xp_reward integer,
  coin_reward integer,
  sort_order integer,
  unlocked boolean,
  unlocked_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id,
    a.title,
    a.description,
    a.image_url,
    a.icon,
    a.requirements,
    a.xp_reward,
    a.coin_reward,
    a.sort_order,
    (ua.unlocked_at is not null) as unlocked,
    ua.unlocked_at
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_id = a.id
   and ua.user_id = auth.uid()
  where a.is_active = true
  order by a.sort_order asc, a.title asc;
$$;

drop function if exists public.get_friend_achievements(uuid);

create or replace function public.get_friend_achievements(p_user_id uuid)
returns table (
  id text,
  title text,
  description text,
  image_url text,
  icon text,
  xp_reward integer,
  coin_reward integer,
  sort_order integer,
  unlocked_at timestamptz
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

  if p_user_id is null then
    raise exception 'User not found';
  end if;

  if p_user_id <> v_user_id and not public.users_are_friends(v_user_id, p_user_id) then
    raise exception 'You can only view friend achievements';
  end if;

  return query
  select
    a.id,
    a.title,
    a.description,
    a.image_url,
    a.icon,
    a.xp_reward,
    a.coin_reward,
    a.sort_order,
    ua.unlocked_at
  from public.user_achievements ua
  join public.achievements a on a.id = ua.achievement_id
  where ua.user_id = p_user_id
    and a.is_active = true
  order by ua.unlocked_at desc, a.sort_order asc;
end;
$$;

grant execute on function public.sync_user_achievements(uuid) to authenticated;
grant execute on function public.get_my_achievements() to authenticated;
grant execute on function public.get_friend_achievements(uuid) to authenticated;

-- Deactivate removed level achievements.
update public.achievements
set is_active = false
where id in ('rising_star', 'champion');

-- Update XP milestone achievements to coin rewards.
update public.achievements
set
  xp_reward = 0,
  coin_reward = 50
where id = 'grinder';

update public.achievements
set
  xp_reward = 0,
  coin_reward = 250
where id = 'elite';

insert into public.achievements (id, title, description, icon, requirements, xp_reward, coin_reward, sort_order)
values
  (
    'goal_setter',
    'Goal Setter',
    'Create your first daily or weekly goal.',
    'target',
    '{"type":"goals_created","min":1}'::jsonb,
    20,
    0,
    15
  ),
  (
    'goal_getter',
    'Goal Getter',
    'Complete your first personal goal.',
    'medal',
    '{"type":"goals_completed","min":1}'::jsonb,
    10,
    0,
    18
  ),
  (
    'regular',
    'Regular',
    'Open the app 10 days in a row.',
    'star',
    '{"type":"login_streak","min":10}'::jsonb,
    50,
    0,
    35
  ),
  (
    'friendly_rival',
    'Friendly Rival',
    'Win 10 friendly challenges.',
    'friends',
    '{"type":"friend_races_won","min":10}'::jsonb,
    100,
    25,
    115
  ),
  (
    'challenge_dominant',
    'Challenge Dominant',
    'Win 75 friendly challenges.',
    'crown',
    '{"type":"friend_races_won","min":75}'::jsonb,
    200,
    100,
    116
  ),
  (
    'arena_legend',
    'Arena Legend',
    'Win 200 friendly challenges.',
    'bolt',
    '{"type":"friend_races_won","min":200}'::jsonb,
    300,
    200,
    117
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  requirements = excluded.requirements,
  xp_reward = excluded.xp_reward,
  coin_reward = excluded.coin_reward,
  sort_order = excluded.sort_order,
  is_active = true;
