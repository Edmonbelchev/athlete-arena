-- Daily workout completion bonus, workout achievements, and earnable titles.
-- Reward amounts synced with src/constants/dailyWorkoutRewards.ts

alter table public.profiles
  add column if not exists daily_workout_reward_claimed_on date,
  add column if not exists equipped_title_id text;

comment on column public.profiles.daily_workout_reward_claimed_on is
  'UTC date when the once-per-day workout completion bonus (250 XP + 125 coins) was last claimed.';
comment on column public.profiles.equipped_title_id is
  'Optional earned title shown next to the user display name.';

create table if not exists public.titles (
  id text primary key,
  name text not null,
  description text not null,
  requirement_type text not null check (
    requirement_type in ('workouts_completed', 'friend_races_won', 'weekly_leaderboard_first')
  ),
  requirement_min integer not null check (requirement_min > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_titles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_id text not null references public.titles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index if not exists user_titles_user_idx on public.user_titles (user_id, unlocked_at desc);

alter table public.profiles
  drop constraint if exists profiles_equipped_title_id_fkey;

alter table public.profiles
  add constraint profiles_equipped_title_id_fkey
  foreign key (equipped_title_id) references public.titles(id) on delete set null;

create table if not exists public.weekly_leaderboard_awards (
  week_start date primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  weekly_xp integer not null default 0 check (weekly_xp >= 0),
  awarded_at timestamptz not null default now()
);

alter table public.titles enable row level security;
alter table public.user_titles enable row level security;
alter table public.weekly_leaderboard_awards enable row level security;

create policy titles_read on public.titles
  for select to authenticated using (is_active = true);

create policy user_titles_read on public.user_titles
  for select to authenticated using (true);

create policy weekly_leaderboard_awards_read on public.weekly_leaderboard_awards
  for select to authenticated using (true);

insert into public.titles (id, name, description, requirement_type, requirement_min, sort_order)
values
  (
    'workout_starter',
    'Workout Starter',
    'Complete 10 workouts.',
    'workouts_completed',
    10,
    10
  ),
  (
    'challenge_hunter',
    'Challenge Hunter',
    'Win 50 friend challenges.',
    'friend_races_won',
    50,
    20
  ),
  (
    'challenge_master',
    'Challenge Master',
    'Win 100 friend challenges.',
    'friend_races_won',
    100,
    30
  ),
  (
    'challenge_overlord',
    'Challenge Overlord',
    'Win 500 friend challenges.',
    'friend_races_won',
    500,
    40
  ),
  (
    'weekly_champion',
    'Weekly Champion',
    'Finish #1 on the weekly XP leaderboard before the week resets.',
    'weekly_leaderboard_first',
    1,
    50
  ),
  (
    'workout_machine',
    'Workout Machine',
    'Complete 500 workouts.',
    'workouts_completed',
    500,
    60
  ),
  (
    'arena_conqueror',
    'Athlete Arena Conqueror',
    'Complete 1,000 workouts.',
    'workouts_completed',
    1000,
    70
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  requirement_type = excluded.requirement_type,
  requirement_min = excluded.requirement_min,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.achievements (
  id, title, description, icon, requirements, xp_reward, coin_reward, sort_order, is_active
)
values
  (
    'first_workout',
    'First Workout',
    'Complete your first workout session.',
    'dumbbell',
    '{"type":"workouts_completed","min":1}'::jsonb,
    0,
    25,
    210,
    true
  ),
  (
    'workout_10',
    'Workout Regular',
    'Complete 10 workout sessions.',
    'dumbbell',
    '{"type":"workouts_completed","min":10}'::jsonb,
    0,
    50,
    211,
    true
  ),
  (
    'workout_50',
    'Gym Grinder',
    'Complete 50 workout sessions.',
    'dumbbell',
    '{"type":"workouts_completed","min":50}'::jsonb,
    0,
    125,
    212,
    true
  ),
  (
    'workout_100',
    'Century Athlete',
    'Complete 100 workout sessions.',
    'dumbbell',
    '{"type":"workouts_completed","min":100}'::jsonb,
    0,
    175,
    213,
    true
  ),
  (
    'workout_200',
    'Double Century',
    'Complete 200 workout sessions.',
    'dumbbell',
    '{"type":"workouts_completed","min":200}'::jsonb,
    0,
    325,
    214,
    true
  ),
  (
    'workout_500',
    'Workout Legend',
    'Complete 500 workout sessions.',
    'dumbbell',
    '{"type":"workouts_completed","min":500}'::jsonb,
    0,
    575,
    215,
    true
  ),
  (
    'workout_1000',
    'Athlete Arena Conqueror',
    'Complete 1,000 workout sessions.',
    'medal',
    '{"type":"workouts_completed","min":1000}'::jsonb,
    0,
    950,
    216,
    true
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  requirements = excluded.requirements,
  xp_reward = excluded.xp_reward,
  coin_reward = excluded.coin_reward,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create or replace function public.get_user_workouts_completed(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.custom_workout_sessions
  where user_id = p_user_id;
$$;

create or replace function public.award_daily_workout_completion(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_claimed_on date;
  v_daily_xp constant integer := 250;
  v_daily_coins constant integer := 125;
begin
  if p_user_id is null then
    return null;
  end if;

  select daily_workout_reward_claimed_on
  into v_claimed_on
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return null;
  end if;

  if v_claimed_on = v_today then
    return null;
  end if;

  update public.profiles
  set daily_workout_reward_claimed_on = v_today
  where id = p_user_id;

  perform public.award_friend_challenge_xp(p_user_id, v_daily_xp);
  perform public.log_xp_event(
    p_user_id,
    v_daily_xp,
    'daily_workout',
    p_session_id::text
  );
  perform public.award_coins(p_user_id, v_daily_coins);

  return jsonb_build_object(
    'xp', v_daily_xp,
    'coins', v_daily_coins
  );
end;
$$;

create or replace function public.process_weekly_leaderboard_awards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_week_start timestamptz := date_trunc('week', timezone('utc', now()));
  v_previous_week_start date := (v_current_week_start - interval '7 days')::date;
  v_previous_week_end timestamptz := v_current_week_start;
  v_winner_id uuid;
  v_weekly_xp bigint;
begin
  if exists (
    select 1
    from public.weekly_leaderboard_awards
    where week_start = v_previous_week_start
  ) then
    return;
  end if;

  select e.user_id, sum(e.amount)::bigint
  into v_winner_id, v_weekly_xp
  from public.xp_events e
  where e.created_at >= v_previous_week_start
    and e.created_at < v_previous_week_end
  group by e.user_id
  order by sum(e.amount) desc, e.user_id asc
  limit 1;

  if v_winner_id is null or coalesce(v_weekly_xp, 0) <= 0 then
    insert into public.weekly_leaderboard_awards (week_start, user_id, weekly_xp)
    values (v_previous_week_start, null, 0)
    on conflict do nothing;
    return;
  end if;

  insert into public.weekly_leaderboard_awards (week_start, user_id, weekly_xp)
  values (v_previous_week_start, v_winner_id, v_weekly_xp::integer)
  on conflict do nothing;

  insert into public.user_titles (user_id, title_id)
  values (v_winner_id, 'weekly_champion')
  on conflict do nothing;
end;
$$;

create or replace function public.check_title_requirement(
  p_requirement_type text,
  p_requirement_min integer,
  p_workouts_completed bigint,
  p_friend_races_won bigint,
  p_weekly_leaderboard_wins bigint
)
returns boolean
language plpgsql
immutable
as $$
begin
  case p_requirement_type
    when 'workouts_completed' then
      return p_workouts_completed >= p_requirement_min;
    when 'friend_races_won' then
      return p_friend_races_won >= p_requirement_min;
    when 'weekly_leaderboard_first' then
      return p_weekly_leaderboard_wins >= p_requirement_min;
    else
      return false;
  end case;
end;
$$;

create or replace function public.sync_user_titles(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_workouts_completed bigint;
  v_friend_races_won bigint;
  v_weekly_leaderboard_wins bigint;
  v_title record;
  v_inserted integer;
  v_new_unlocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.process_weekly_leaderboard_awards();

  select public.get_user_workouts_completed(v_user_id)
  into v_workouts_completed;

  select count(*)
  into v_friend_races_won
  from public.friend_challenges
  where winner_user_id = v_user_id;

  select count(*)
  into v_weekly_leaderboard_wins
  from public.weekly_leaderboard_awards
  where user_id = v_user_id;

  for v_title in
    select id, requirement_type, requirement_min
    from public.titles
    where is_active = true
  loop
    if public.check_title_requirement(
      v_title.requirement_type,
      v_title.requirement_min,
      v_workouts_completed,
      v_friend_races_won,
      v_weekly_leaderboard_wins
    ) then
      insert into public.user_titles (user_id, title_id)
      values (v_user_id, v_title.id)
      on conflict do nothing;

      get diagnostics v_inserted = row_count;
      v_new_unlocks := v_new_unlocks + coalesce(v_inserted, 0);
    end if;
  end loop;

  return v_new_unlocks;
end;
$$;

drop function if exists public.check_achievement_requirement(
  jsonb,
  bigint,
  integer,
  integer,
  integer,
  integer,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  integer
);

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
  p_burpees_total bigint,
  p_friend_races_won bigint,
  p_friends_count bigint,
  p_goals_created bigint,
  p_goals_completed bigint,
  p_login_streak integer,
  p_workouts_completed bigint
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
    when 'burpees_total' then
      return p_burpees_total >= req_min;
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
    when 'workouts_completed' then
      return p_workouts_completed >= req_min;
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
  v_burpees_total bigint;
  v_friend_races_won bigint;
  v_friends_count bigint;
  v_goals_created bigint;
  v_goals_completed bigint;
  v_login_streak integer;
  v_login_last_date date;
  v_workouts_completed bigint;
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

  select public.get_user_workouts_completed(v_user_id)
  into v_workouts_completed;

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
    coalesce(sum(dc.completed_reps) filter (
      where dc.status = 'completed' and dc.exercise_type = 'burpees'
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
    v_burpees_total,
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
      v_burpees_total,
      v_friend_races_won,
      v_friends_count,
      v_goals_created,
      v_goals_completed,
      v_login_streak,
      v_workouts_completed
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

  perform public.sync_user_titles(v_user_id);

  return v_new_unlocks;
end;
$$;

drop function if exists public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz, uuid, integer);

create or replace function public.save_custom_workout_session(
  p_template_id uuid,
  p_title text,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_total_reps integer,
  p_exercise_breakdown jsonb,
  p_started_at timestamptz,
  p_catalog_workout_id uuid default null,
  p_elapsed_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_total_reps integer;
  v_has_template_access boolean := false;
  v_daily_bonus jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (p_template_id is null and p_catalog_workout_id is null)
     or (p_template_id is not null and p_catalog_workout_id is not null) then
    raise exception 'Provide exactly one workout reference';
  end if;

  if p_catalog_workout_id is not null then
    if not exists (
      select 1
      from public.workout_catalog wc
      where wc.id = p_catalog_workout_id
        and wc.is_active = true
    ) then
      raise exception 'Workout not found';
    end if;
  end if;

  if p_template_id is not null then
    select exists (
      select 1
      from public.custom_workout_templates t
      where t.id = p_template_id
        and t.deleted_at is null
        and (
          t.creator_id = v_user_id
          or exists (
            select 1
            from public.custom_workout_template_shares s
            where s.template_id = p_template_id
              and s.shared_with_id = v_user_id
          )
        )
    )
    into v_has_template_access;

    if not v_has_template_access then
      raise exception 'Workout template not found';
    end if;
  end if;

  insert into public.custom_workout_sessions (
    user_id,
    template_id,
    catalog_workout_id,
    title,
    time_limit_seconds,
    completed_rounds,
    total_reps,
    exercise_breakdown,
    started_at,
    elapsed_seconds
  )
  values (
    v_user_id,
    p_template_id,
    p_catalog_workout_id,
    trim(p_title),
    p_time_limit_seconds,
    p_completed_rounds,
    p_total_reps,
    coalesce(p_exercise_breakdown, '[]'::jsonb),
    p_started_at,
    p_elapsed_seconds
  )
  returning id into v_session_id;

  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_exercise_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    v_total_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);

    if v_exercise is not null and v_total_reps > 0 then
      perform public.credit_daily_mission_reps(
        v_exercise,
        'custom_workout',
        v_session_id::text,
        v_total_reps
      );
    end if;
  end loop;

  v_daily_bonus := public.award_daily_workout_completion(v_user_id, v_session_id);

  return jsonb_build_object(
    'session_id', v_session_id,
    'daily_bonus', v_daily_bonus
  );
end;
$$;

create or replace function public.get_my_titles()
returns table (
  id text,
  name text,
  description text,
  requirement_type text,
  requirement_min integer,
  sort_order integer,
  unlocked boolean,
  unlocked_at timestamptz,
  equipped boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_equipped_title_id text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.equipped_title_id
  into v_equipped_title_id
  from public.profiles p
  where p.id = v_user_id;

  return query
  select
    t.id,
    t.name,
    t.description,
    t.requirement_type,
    t.requirement_min,
    t.sort_order,
    (ut.user_id is not null) as unlocked,
    ut.unlocked_at,
    (t.id = v_equipped_title_id) as equipped
  from public.titles t
  left join public.user_titles ut
    on ut.title_id = t.id and ut.user_id = v_user_id
  where t.is_active = true
  order by t.sort_order asc, t.name asc;
end;
$$;

create or replace function public.equip_user_title(p_title_id text)
returns void
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

  if p_title_id is null or trim(p_title_id) = '' then
    update public.profiles p
    set equipped_title_id = null
    where p.id = v_user_id;
    return;
  end if;

  if not exists (
    select 1
    from public.user_titles ut
    where ut.user_id = v_user_id
      and ut.title_id = p_title_id
  ) then
    raise exception 'Title not unlocked';
  end if;

  update public.profiles p
  set equipped_title_id = p_title_id
  where p.id = v_user_id;
end;
$$;

create or replace function public.get_equipped_title_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.name
  from public.profiles p
  left join public.titles t on t.id = p.equipped_title_id
  where p.id = p_user_id;
$$;

drop function if exists public.get_friend_profile(uuid);

create or replace function public.get_friend_profile(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  level integer,
  total_xp integer,
  current_streak integer,
  longest_streak integer,
  avatar_url text,
  avatar_icon text,
  avatar_background text,
  frame_border_color text,
  frame_border_width integer,
  equipped_title_name text
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

  return query
  select
    p.id as user_id,
    p.username,
    p.display_name,
    p.level,
    p.total_xp,
    p.current_streak,
    p.longest_streak,
    p.avatar_url,
    avatar_item.metadata->>'icon' as avatar_icon,
    avatar_item.metadata->>'backgroundColor' as avatar_background,
    frame_item.metadata->>'borderColor' as frame_border_color,
    nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
    title_item.name as equipped_title_name
  from public.profiles p
  left join public.user_equipped_items uei_avatar
    on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
  left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
  left join public.user_equipped_items uei_frame
    on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
  left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
  left join public.titles title_item on title_item.id = p.equipped_title_id
  where p.id = p_user_id;
end;
$$;

grant execute on function public.get_user_workouts_completed(uuid) to authenticated;
grant execute on function public.award_daily_workout_completion(uuid, uuid) to authenticated;
grant execute on function public.process_weekly_leaderboard_awards() to authenticated;
grant execute on function public.sync_user_titles(uuid) to authenticated;
grant execute on function public.get_my_titles() to authenticated;
grant execute on function public.equip_user_title(text) to authenticated;
grant execute on function public.get_equipped_title_name(uuid) to authenticated;
grant execute on function public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz, uuid, integer) to authenticated;
