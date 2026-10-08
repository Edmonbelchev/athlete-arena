-- Variable workout XP by type (AMRAP / EMOM / For Time) and exercise reps.
-- Sync constants with src/constants/workoutXp.ts

create or replace function public.workout_xp_per_rep(p_exercise public.exercise_type)
returns integer
language sql
immutable
as $$
  select case p_exercise
    when 'jumping_jacks' then 1
    when 'squats' then 1
    when 'push_ups' then 1
    when 'half_burpees' then 1
    when 'jumping_squats' then 1
    when 'burpees' then 2
    when 'pull_ups' then 2
    when 'dips' then 2
    else 1
  end;
$$;

create or replace function public.sum_workout_rep_xp_from_breakdown(
  p_breakdown jsonb,
  p_use_target_reps boolean default false
)
returns integer
language plpgsql
immutable
as $$
declare
  v_entry jsonb;
  v_exercise public.exercise_type;
  v_reps integer;
  v_total integer := 0;
begin
  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_breakdown, '[]'::jsonb))
  loop
    v_exercise := (v_entry ->> 'exercise_type')::public.exercise_type;
    if p_use_target_reps then
      v_reps := coalesce((v_entry ->> 'target_reps')::integer, 0);
    else
      v_reps := coalesce((v_entry ->> 'total_reps')::integer, 0);
    end if;

    if v_exercise is not null and v_reps > 0 then
      v_total := v_total + v_reps * public.workout_xp_per_rep(v_exercise);
    end if;
  end loop;

  return v_total;
end;
$$;

create or replace function public.sum_workout_required_reps_from_breakdown(p_breakdown jsonb)
returns integer
language plpgsql
immutable
as $$
declare
  v_entry jsonb;
  v_reps integer;
  v_total integer := 0;
begin
  for v_entry in
    select value
    from jsonb_array_elements(coalesce(p_breakdown, '[]'::jsonb))
  loop
    v_reps := coalesce((v_entry ->> 'target_reps')::integer, 0);
    if v_reps > 0 then
      v_total := v_total + v_reps;
    end if;
  end loop;

  return v_total;
end;
$$;

create or replace function public.clamp_workout_session_xp(p_xp numeric)
returns integer
language sql
immutable
as $$
  select greatest(10, least(500, floor(coalesce(p_xp, 0) * 0.75)::integer));
$$;

create or replace function public.calculate_workout_session_xp(
  p_workout_type public.custom_workout_type,
  p_breakdown jsonb,
  p_time_limit_seconds integer,
  p_completed_rounds integer,
  p_elapsed_seconds integer
)
returns integer
language plpgsql
immutable
as $$
declare
  v_rep_xp integer;
  v_required_rep_xp integer;
  v_required_reps integer;
  v_par_seconds integer;
  v_elapsed integer;
  v_multiplier numeric;
  v_intervals integer;
  v_interval_bonus integer;
  v_minutes integer;
begin
  case p_workout_type
    when 'for_time' then
      v_required_rep_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, true);
      v_required_reps := public.sum_workout_required_reps_from_breakdown(p_breakdown);
      v_par_seconds := greatest(120, v_required_reps * 3);
      v_elapsed := greatest(30, coalesce(p_elapsed_seconds, v_par_seconds));
      v_multiplier := least(1.5, greatest(0.5, v_par_seconds::numeric / v_elapsed::numeric));
      return public.clamp_workout_session_xp(v_required_rep_xp * v_multiplier);

    when 'emom' then
      v_rep_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, false);
      v_intervals := greatest(1, coalesce(p_time_limit_seconds, 0) / 60);
      v_interval_bonus := floor(
        30.0 * greatest(0, coalesce(p_completed_rounds, 0))::numeric / v_intervals::numeric
      );
      return public.clamp_workout_session_xp(v_rep_xp + v_interval_bonus);

    else
      v_rep_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, false);
      v_elapsed := coalesce(
        nullif(p_elapsed_seconds, 0),
        nullif(p_time_limit_seconds, 0),
        60
      );
      v_minutes := greatest(1, v_elapsed / 60);
      return public.clamp_workout_session_xp(v_rep_xp + v_minutes * 4);
  end case;
end;
$$;

create or replace function public.award_workout_session_xp(
  p_user_id uuid,
  p_session_id uuid,
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
  if p_user_id is null or coalesce(p_xp, 0) <= 0 then
    return;
  end if;

  select total_xp into v_new_total_xp from public.profiles where id = p_user_id;
  v_new_total_xp := coalesce(v_new_total_xp, 0) + p_xp;
  v_new_level := public.calculate_level(v_new_total_xp);

  perform set_config('app.bypass_profile_stat_protection', 'true', true);

  update public.profiles
  set total_xp = v_new_total_xp, level = v_new_level
  where id = p_user_id;

  perform set_config('app.bypass_profile_stat_protection', 'false', true);

  perform public.log_xp_event(
    p_user_id,
    p_xp,
    'workout_session',
    p_session_id::text
  );
end;
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

  perform public.award_coins(p_user_id, v_daily_coins);

  return jsonb_build_object(
    'xp', 0,
    'coins', v_daily_coins
  );
end;
$$;

create or replace function public.preview_for_time_workout_xp(p_breakdown jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_base_xp integer;
  v_required_reps integer;
  v_par_seconds integer;
begin
  v_base_xp := public.sum_workout_rep_xp_from_breakdown(p_breakdown, true);
  v_required_reps := public.sum_workout_required_reps_from_breakdown(p_breakdown);
  v_par_seconds := greatest(120, v_required_reps * 3);

  return jsonb_build_object(
    'base_xp', public.clamp_workout_session_xp(v_base_xp),
    'min_xp', public.clamp_workout_session_xp(v_base_xp * 0.5),
    'max_xp', public.clamp_workout_session_xp(v_base_xp * 1.5),
    'par_seconds', v_par_seconds
  );
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
  p_elapsed_seconds integer default null,
  p_workout_type public.custom_workout_type default null
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
  v_workout_type public.custom_workout_type;
  v_session_xp integer;
  v_daily_bonus jsonb;
  v_elapsed integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (p_template_id is null and p_catalog_workout_id is null)
     or (p_template_id is not null and p_catalog_workout_id is not null) then
    raise exception 'Provide exactly one workout reference';
  end if;

  v_workout_type := p_workout_type;

  if v_workout_type is null and p_catalog_workout_id is not null then
    select wc.workout_type into v_workout_type
    from public.workout_catalog wc
    where wc.id = p_catalog_workout_id;
  end if;

  if v_workout_type is null and p_template_id is not null then
    select t.workout_type into v_workout_type
    from public.custom_workout_templates t
    where t.id = p_template_id;
  end if;

  v_workout_type := coalesce(v_workout_type, 'amrap'::public.custom_workout_type);

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

  v_elapsed := p_elapsed_seconds;
  if v_elapsed is null and v_workout_type in ('amrap'::public.custom_workout_type, 'emom'::public.custom_workout_type) then
    v_elapsed := p_time_limit_seconds;
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
    v_elapsed
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

  v_session_xp := public.calculate_workout_session_xp(
    v_workout_type,
    coalesce(p_exercise_breakdown, '[]'::jsonb),
    p_time_limit_seconds,
    p_completed_rounds,
    v_elapsed
  );

  perform public.award_workout_session_xp(v_user_id, v_session_id, v_session_xp);

  v_daily_bonus := public.award_daily_workout_completion(v_user_id, v_session_id);

  return jsonb_build_object(
    'session_id', v_session_id,
    'session_xp', v_session_xp,
    'daily_bonus', v_daily_bonus
  );
end;
$$;

-- Activity history: read workout_session XP (fallback daily_workout for legacy rows).
drop function if exists public.get_activity_history(text, integer, integer);

create or replace function public.get_activity_history(
  p_filter text default 'all',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  entry_id uuid,
  category text,
  kind text,
  exercise_type public.exercise_type,
  target_reps integer,
  completed_reps integer,
  xp_reward integer,
  status public.challenge_status,
  result_at timestamptz,
  opponent_username text,
  opponent_display_name text,
  opponent_completed_reps integer,
  opponent_status public.challenge_status,
  race_seconds integer,
  opponent_race_seconds integer,
  winner_user_id uuid,
  xp_earned integer,
  friend_challenge_kind text,
  workout_title text,
  workout_type public.custom_workout_type,
  completed_rounds integer,
  opponent_completed_rounds integer,
  total_reps integer,
  elapsed_seconds integer,
  time_limit_seconds integer,
  coins_earned integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_filter text := lower(trim(coalesce(p_filter, 'all')));
  v_daily_workout_coins constant integer := 125;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_filter not in ('all', 'quests', 'friend_challenges', 'friend_workouts', 'workouts') then
    raise exception 'Invalid activity history filter';
  end if;

  perform public.expire_overdue_friend_challenges(v_user_id);

  return query
  with combined as (
    select
      dc.id as entry_id,
      'daily_quest'::text as category,
      'daily'::text as kind,
      dc.exercise_type,
      dc.target_reps,
      dc.completed_reps,
      dc.xp_reward,
      dc.status,
      coalesce(dc.completed_at, dc.challenge_date::timestamptz) as result_at,
      null::text as opponent_username,
      null::text as opponent_display_name,
      null::integer as opponent_completed_reps,
      null::public.challenge_status as opponent_status,
      null::integer as race_seconds,
      null::integer as opponent_race_seconds,
      null::uuid as winner_user_id,
      null::integer as xp_earned,
      null::text as friend_challenge_kind,
      null::text as workout_title,
      null::public.custom_workout_type as workout_type,
      null::integer as completed_rounds,
      null::integer as opponent_completed_rounds,
      null::integer as total_reps,
      null::integer as elapsed_seconds,
      null::integer as time_limit_seconds,
      null::integer as coins_earned
    from public.daily_challenges dc
    where dc.user_id = v_user_id
      and (
        dc.status = 'completed'
        or dc.challenge_date < current_date
      )

    union all

    select
      mine.id as entry_id,
      case
        when fc.challenge_kind = 'workout'::public.friend_challenge_kind then 'friend_workout'
        else 'friend_exercise'
      end as category,
      'friend'::text as kind,
      fc.exercise_type,
      fc.target_reps,
      mine.completed_reps,
      fc.xp_reward,
      mine.status,
      coalesce(mine.completed_at, fc.resolved_at, fc.created_at) as result_at,
      opponent_profile.username as opponent_username,
      opponent_profile.display_name as opponent_display_name,
      opponent.completed_reps as opponent_completed_reps,
      opponent.status as opponent_status,
      coalesce(
        case
          when fc.challenge_kind = 'workout'::public.friend_challenge_kind
            and fc.workout_type = 'for_time'::public.custom_workout_type
            then mine.elapsed_seconds
          else null
        end,
        public.participant_race_seconds(mine.started_at, mine.completed_at)
      ) as race_seconds,
      coalesce(
        case
          when fc.challenge_kind = 'workout'::public.friend_challenge_kind
            and fc.workout_type = 'for_time'::public.custom_workout_type
            then opponent.elapsed_seconds
          else null
        end,
        public.participant_race_seconds(opponent.started_at, opponent.completed_at)
      ) as opponent_race_seconds,
      fc.winner_user_id,
      mine.xp_earned,
      fc.challenge_kind::text as friend_challenge_kind,
      fc.workout_title,
      fc.workout_type,
      mine.completed_rounds,
      opponent.completed_rounds as opponent_completed_rounds,
      mine.workout_total_reps as total_reps,
      mine.elapsed_seconds,
      fc.time_limit_seconds,
      null::integer as coins_earned
    from public.friend_challenge_participants mine
    join public.friend_challenges fc on fc.id = mine.challenge_id
    join public.friend_challenge_participants opponent
      on opponent.challenge_id = mine.challenge_id and opponent.user_id <> v_user_id
    join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
    where mine.user_id = v_user_id
      and mine.status in ('completed', 'expired', 'declined')

    union all

    select
      s.id as entry_id,
      'solo_workout'::text as category,
      'workout'::text as kind,
      null::public.exercise_type as exercise_type,
      null::integer as target_reps,
      s.total_reps as completed_reps,
      0 as xp_reward,
      'completed'::public.challenge_status as status,
      s.completed_at as result_at,
      null::text as opponent_username,
      null::text as opponent_display_name,
      null::integer as opponent_completed_reps,
      null::public.challenge_status as opponent_status,
      s.elapsed_seconds as race_seconds,
      null::integer as opponent_race_seconds,
      null::uuid as winner_user_id,
      coalesce(session_xp.amount, legacy_daily_xp.amount) as xp_earned,
      null::text as friend_challenge_kind,
      s.title as workout_title,
      coalesce(wc.workout_type, t.workout_type, 'amrap'::public.custom_workout_type) as workout_type,
      s.completed_rounds,
      null::integer as opponent_completed_rounds,
      s.total_reps,
      s.elapsed_seconds,
      s.time_limit_seconds,
      case
        when legacy_daily_xp.amount is not null then v_daily_workout_coins
        else null
      end as coins_earned
    from public.custom_workout_sessions s
    left join public.workout_catalog wc on wc.id = s.catalog_workout_id
    left join public.custom_workout_templates t on t.id = s.template_id
    left join lateral (
      select e.amount
      from public.xp_events e
      where e.user_id = v_user_id
        and e.source_type = 'workout_session'
        and e.source_id = s.id::text
      order by e.created_at desc
      limit 1
    ) session_xp on true
    left join lateral (
      select e.amount
      from public.xp_events e
      where e.user_id = v_user_id
        and e.source_type = 'daily_workout'
        and e.source_id = s.id::text
      order by e.created_at desc
      limit 1
    ) legacy_daily_xp on true
    where s.user_id = v_user_id
  )
  select *
  from combined c
  where
    v_filter = 'all'
    or (v_filter = 'quests' and c.category = 'daily_quest' and c.status = 'completed'::public.challenge_status)
    or (v_filter = 'friend_challenges' and c.category = 'friend_exercise')
    or (v_filter = 'friend_workouts' and c.category = 'friend_workout')
    or (v_filter = 'workouts' and c.category = 'solo_workout')
  order by c.result_at desc
  limit v_limit
  offset v_offset;
end;
$$;

grant execute on function public.workout_xp_per_rep(public.exercise_type) to authenticated;
grant execute on function public.preview_for_time_workout_xp(jsonb) to authenticated;
grant execute on function public.save_custom_workout_session(uuid, text, integer, integer, integer, jsonb, timestamptz, uuid, integer, public.custom_workout_type) to authenticated;
grant execute on function public.get_activity_history(text, integer, integer) to authenticated;
