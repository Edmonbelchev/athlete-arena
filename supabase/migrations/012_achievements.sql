-- Achievements catalog (admin-seeded) and per-user unlocks.

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  image_url text,
  icon text not null default 'medal',
  requirements jsonb not null,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint achievements_requirements_object check (jsonb_typeof(requirements) = 'object')
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id, unlocked_at desc);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Authenticated users can view active achievements" on public.achievements;
create policy "Authenticated users can view active achievements"
  on public.achievements
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Users can view own achievement unlocks" on public.user_achievements;
create policy "Users can view own achievement unlocks"
  on public.user_achievements
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.check_achievement_requirement(
  p_requirements jsonb,
  p_completed_challenges bigint,
  p_total_xp integer,
  p_level integer,
  p_current_streak integer,
  p_longest_streak integer,
  p_push_ups_total bigint,
  p_squats_total bigint,
  p_friend_races_won bigint,
  p_friends_count bigint
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
    when 'friend_races_won' then
      return p_friend_races_won >= req_min;
    when 'friends_count' then
      return p_friends_count >= req_min;
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
  v_completed_challenges bigint;
  v_total_xp integer;
  v_level integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_push_ups_total bigint;
  v_squats_total bigint;
  v_friend_races_won bigint;
  v_friends_count bigint;
  v_achievement record;
  v_inserted integer;
  v_new_unlocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
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
    ), 0)
  into
    v_completed_challenges,
    v_total_xp,
    v_level,
    v_current_streak,
    v_longest_streak,
    v_push_ups_total,
    v_squats_total
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

  for v_achievement in
    select id, requirements, xp_reward
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
      v_friend_races_won,
      v_friends_count
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
      end if;
    end if;
  end loop;

  return v_new_unlocks;
end;
$$;

create or replace function public.get_my_achievements()
returns table (
  id text,
  title text,
  description text,
  image_url text,
  icon text,
  requirements jsonb,
  xp_reward integer,
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

grant execute on function public.sync_user_achievements(uuid) to authenticated;
grant execute on function public.get_my_achievements() to authenticated;

insert into public.achievements (id, title, description, icon, requirements, xp_reward, sort_order)
values
  (
    'first_win',
    'First Win',
    'Complete your first daily challenge.',
    'target',
    '{"type":"completed_challenges","min":1}'::jsonb,
    25,
    10
  ),
  (
    'dedicated',
    'Dedicated',
    'Complete 10 daily challenges.',
    'medal',
    '{"type":"completed_challenges","min":10}'::jsonb,
    100,
    20
  ),
  (
    'on_fire',
    'On Fire',
    'Reach a 7-day workout streak.',
    'flame',
    '{"type":"longest_streak","min":7}'::jsonb,
    75,
    30
  ),
  (
    'unstoppable',
    'Unstoppable',
    'Reach a 30-day workout streak.',
    'bolt',
    '{"type":"longest_streak","min":30}'::jsonb,
    250,
    40
  ),
  (
    'rising_star',
    'Rising Star',
    'Reach level 5.',
    'star',
    '{"type":"level","min":5}'::jsonb,
    50,
    50
  ),
  (
    'champion',
    'Champion',
    'Reach level 10.',
    'crown',
    '{"type":"level","min":10}'::jsonb,
    150,
    60
  ),
  (
    'grinder',
    'Grinder',
    'Earn 1,000 total XP.',
    'dumbbell',
    '{"type":"total_xp","min":1000}'::jsonb,
    100,
    70
  ),
  (
    'elite',
    'Elite',
    'Earn 5,000 total XP.',
    'rocket',
    '{"type":"total_xp","min":5000}'::jsonb,
    300,
    80
  ),
  (
    'rep_machine',
    'Rep Machine',
    'Complete 100 push-ups across daily challenges.',
    'dumbbell',
    '{"type":"push_ups_total","min":100}'::jsonb,
    75,
    90
  ),
  (
    'squad_up',
    'Squad Up',
    'Add your first friend.',
    'friends',
    '{"type":"friends_count","min":1}'::jsonb,
    50,
    100
  ),
  (
    'race_winner',
    'Race Winner',
    'Win your first friend speed race.',
    'crown',
    '{"type":"friend_races_won","min":1}'::jsonb,
    100,
    110
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  requirements = excluded.requirements,
  xp_reward = excluded.xp_reward,
  sort_order = excluded.sort_order,
  is_active = true;
