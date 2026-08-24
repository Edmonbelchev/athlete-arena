-- Client-triggered sync after restore / purchase (webhook remains source of truth long-term).

create or replace function public.sync_my_revenuecat_subscription(
  p_expires_at timestamptz
)
returns jsonb
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

  if p_expires_at is not null and p_expires_at > now() + interval '2 years' then
    raise exception 'Invalid expiration date';
  end if;

  perform public.apply_revenuecat_subscription(v_user_id, 'active', p_expires_at);

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'expires_at', p_expires_at
  );
end;
$$;

revoke all on function public.sync_my_revenuecat_subscription(timestamptz) from public, anon;
grant execute on function public.sync_my_revenuecat_subscription(timestamptz) to authenticated;
