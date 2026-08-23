-- Demo Cindy AMRAP sessions for UI testing (history + leaderboard).
-- Run in Supabase SQL Editor after migrations 062–063 are applied.
--
-- Primary user: edmon.cekov@gmail.com
-- Also seeds a few other accounts on the leaderboard if they exist.

do $$
declare
  v_cindy_id uuid;
  v_edmon_id uuid;
  v_demo_users uuid[];
  v_user_id uuid;
  v_breakdown jsonb;
begin
  select wc.id
  into v_cindy_id
  from public.workout_catalog wc
  where wc.title = 'Cindy AMRAP'
    and wc.is_active = true
  limit 1;

  if v_cindy_id is null then
    raise exception 'Cindy AMRAP not found. Apply migrations 062 and 063 first.';
  end if;

  select u.id
  into v_edmon_id
  from auth.users u
  where lower(u.email) = lower('edmon.cekov@gmail.com')
  limit 1;

  if v_edmon_id is null then
    raise exception 'User edmon.cekov@gmail.com not found in auth.users';
  end if;

  -- Remove prior demo rows for a clean re-run.
  delete from public.custom_workout_sessions s
  where s.catalog_workout_id = v_cindy_id
    and s.title = 'Cindy AMRAP'
    and s.user_id in (
      select u.id
      from auth.users u
      where lower(u.email) in (
        lower('edmon.cekov@gmail.com'),
        lower('demo.leader1@athlete-arena.test'),
        lower('demo.leader2@athlete-arena.test'),
        lower('demo.leader3@athlete-arena.test')
      )
    );

  v_breakdown := jsonb_build_array(
    jsonb_build_object('exercise_type', 'pull_ups', 'target_reps', 5, 'total_reps', 95),
    jsonb_build_object('exercise_type', 'push_ups', 'target_reps', 10, 'total_reps', 190),
    jsonb_build_object('exercise_type', 'squats', 'target_reps', 15, 'total_reps', 270)
  );

  -- Edmon: best score 20 rounds · 615 reps (partial round 21: 5 push-ups + 10 squats)
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
    completed_at
  )
  values
    (
      v_edmon_id,
      null,
      v_cindy_id,
      'Cindy AMRAP',
      1200,
      20,
      615,
      jsonb_build_array(
        jsonb_build_object('exercise_type', 'pull_ups', 'target_reps', 5, 'total_reps', 100),
        jsonb_build_object('exercise_type', 'push_ups', 'target_reps', 10, 'total_reps', 205),
        jsonb_build_object('exercise_type', 'squats', 'target_reps', 15, 'total_reps', 310)
      ),
      timezone('utc', now()) - interval '3 days' - interval '20 minutes',
      timezone('utc', now()) - interval '3 days'
    ),
    (
      v_edmon_id,
      null,
      v_cindy_id,
      'Cindy AMRAP',
      1200,
      18,
      555,
      jsonb_build_array(
        jsonb_build_object('exercise_type', 'pull_ups', 'target_reps', 5, 'total_reps', 90),
        jsonb_build_object('exercise_type', 'push_ups', 'target_reps', 10, 'total_reps', 180),
        jsonb_build_object('exercise_type', 'squats', 'target_reps', 15, 'total_reps', 285)
      ),
      timezone('utc', now()) - interval '10 days' - interval '20 minutes',
      timezone('utc', now()) - interval '10 days'
    ),
    (
      v_edmon_id,
      null,
      v_cindy_id,
      'Cindy AMRAP',
      1200,
      16,
      495,
      jsonb_build_array(
        jsonb_build_object('exercise_type', 'pull_ups', 'target_reps', 5, 'total_reps', 80),
        jsonb_build_object('exercise_type', 'push_ups', 'target_reps', 10, 'total_reps', 160),
        jsonb_build_object('exercise_type', 'squats', 'target_reps', 15, 'total_reps', 255)
      ),
      timezone('utc', now()) - interval '1 day' - interval '20 minutes',
      timezone('utc', now()) - interval '1 day'
    ),
    (
      v_edmon_id,
      null,
      v_cindy_id,
      'Cindy AMRAP',
      1200,
      14,
      430,
      jsonb_build_array(
        jsonb_build_object('exercise_type', 'pull_ups', 'target_reps', 5, 'total_reps', 70),
        jsonb_build_object('exercise_type', 'push_ups', 'target_reps', 10, 'total_reps', 140),
        jsonb_build_object('exercise_type', 'squats', 'target_reps', 15, 'total_reps', 220)
      ),
      timezone('utc', now()) - interval '2 hours' - interval '20 minutes',
      timezone('utc', now()) - interval '2 hours'
    );

  -- Optional filler leaderboard rows for other existing users (skip if none).
  select array_agg(u.id order by u.email)
  into v_demo_users
  from auth.users u
  where lower(u.email) in (
    lower('demo.leader1@athlete-arena.test'),
    lower('demo.leader2@athlete-arena.test'),
    lower('demo.leader3@athlete-arena.test')
  );

  if v_demo_users is not null then
    foreach v_user_id in array v_demo_users loop
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
        completed_at
      )
      values (
        v_user_id,
        null,
        v_cindy_id,
        'Cindy AMRAP',
        1200,
        19 + (random() * 3)::integer,
        580 + (random() * 80)::integer,
        v_breakdown,
        timezone('utc', now()) - interval '6 hours' - interval '20 minutes',
        timezone('utc', now()) - interval '6 hours'
      );
    end loop;
  end if;
end;
$$;

-- Verify Edmon's rows
select
  s.completed_at,
  s.completed_rounds,
  s.total_reps
from public.custom_workout_sessions s
join auth.users u on u.id = s.user_id
where lower(u.email) = lower('edmon.cekov@gmail.com')
  and s.catalog_workout_id = (
    select id from public.workout_catalog where title = 'Cindy AMRAP' and is_active = true limit 1
  )
order by s.completed_at desc;
