-- Demo data for the App Store review account (run by scripts/seed-review-account.mjs).
--
-- Gives the reviewer something to look at and act on without needing a second phone: two
-- friends, an incoming friend request, and XP so everyone shows up on the leaderboards - and so
-- report / block can be tried from any of those profiles.
--
-- Only the service role can call it. Safe to run more than once.

create or replace function public.admin_seed_review_demo(
  p_reviewer_id uuid,
  p_friend_ids uuid[],
  p_requester_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_friend uuid;
  v_xp integer;
  v_index integer := 0;
begin
  -- Accepted friendships with the demo friends.
  foreach v_friend in array p_friend_ids loop
    insert into public.friendships (requester_id, addressee_id, status)
    values (v_friend, p_reviewer_id, 'accepted')
    on conflict (requester_id, addressee_id) do update set status = 'accepted';
  end loop;

  -- A pending request the reviewer can accept, decline, report, or block.
  insert into public.friendships (requester_id, addressee_id, status)
  values (p_requester_id, p_reviewer_id, 'pending')
  on conflict (requester_id, addressee_id) do update set status = 'pending';

  -- XP so the demo users appear on the weekly and all-time leaderboards.
  perform set_config('app.bypass_profile_stat_protection', 'true', true);
  foreach v_friend in array (p_friend_ids || p_requester_id || p_reviewer_id) loop
    v_index := v_index + 1;
    v_xp := 1200 - v_index * 180;

    delete from public.xp_events where user_id = v_friend and source_type = 'review_demo';
    insert into public.xp_events (user_id, amount, source_type, source_id)
    values (v_friend, v_xp, 'review_demo', 'seed');

    update public.profiles
    set total_xp = v_xp,
        level = public.calculate_level(v_xp)
    where id = v_friend;
  end loop;
  perform set_config('app.bypass_profile_stat_protection', 'false', true);
end;
$$;

revoke execute on function public.admin_seed_review_demo(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.admin_seed_review_demo(uuid, uuid[], uuid) to service_role;
