-- Monthly friend challenge request limits: free users 10/month, premium unlimited.

create or replace function public.friend_challenge_monthly_request_limit()
returns integer
language sql
immutable
as $$
  select 10;
$$;

create or replace function public.count_friend_challenge_requests_this_month(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.friend_challenges fc
  where fc.creator_id = p_user_id
    and fc.created_at >= date_trunc('month', now());
$$;

create or replace function public.assert_can_create_friend_challenge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if p_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.user_has_premium_access(p_user_id) then
    return;
  end if;

  v_limit := public.friend_challenge_monthly_request_limit();
  v_used := public.count_friend_challenge_requests_this_month(p_user_id);

  if v_used >= v_limit then
    raise exception
      'Monthly challenge request limit reached (% of %). Upgrade to Premium for unlimited requests.',
      v_used,
      v_limit;
  end if;
end;
$$;

create or replace function public.enforce_friend_challenge_request_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_can_create_friend_challenge(new.creator_id);
  return new;
end;
$$;

drop trigger if exists friend_challenges_request_limit on public.friend_challenges;

create trigger friend_challenges_request_limit
before insert on public.friend_challenges
for each row
execute function public.enforce_friend_challenge_request_limit();

create or replace function public.get_my_friend_challenge_request_quota()
returns table (
  used_count integer,
  monthly_limit integer,
  is_premium boolean,
  can_create boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_used integer;
  v_is_premium boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.user_has_premium_access(v_user_id);
  v_used := public.count_friend_challenge_requests_this_month(v_user_id);
  v_limit := case when v_is_premium then null else public.friend_challenge_monthly_request_limit() end;

  return query
  select
    v_used,
    v_limit,
    v_is_premium,
    v_is_premium or v_used < public.friend_challenge_monthly_request_limit();
end;
$$;

grant execute on function public.friend_challenge_monthly_request_limit() to authenticated;
grant execute on function public.count_friend_challenge_requests_this_month(uuid) to authenticated;
grant execute on function public.get_my_friend_challenge_request_quota() to authenticated;
