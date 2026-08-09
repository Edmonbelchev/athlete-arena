-- Raise friend challenge custom rep cap from 100 to 1000.

alter table public.friend_challenges
  drop constraint if exists friend_challenges_target_reps_check;

alter table public.friend_challenges
  add constraint friend_challenges_target_reps_check
  check (target_reps > 0 and target_reps <= 1000);

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

  if p_target_reps < 1 or p_target_reps > 1000 then
    raise exception 'Target reps must be between 1 and 1000';
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

  v_xp := public.calculate_friend_challenge_xp(p_exercise, p_target_reps);

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
