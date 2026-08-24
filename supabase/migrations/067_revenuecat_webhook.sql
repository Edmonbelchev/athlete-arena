-- RevenueCat webhook: idempotency log + server-side subscription sync.

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  processed_at timestamptz not null default now()
);

alter table public.revenuecat_webhook_events enable row level security;

create or replace function public.apply_revenuecat_subscription(
  p_user_id uuid,
  p_status text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'expired', 'canceled') then
    raise exception 'Invalid subscription status: %', p_status;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    raise exception 'Unknown user_id: %', p_user_id;
  end if;

  insert into public.user_subscriptions (user_id, status, provider, expires_at, updated_at)
  values (p_user_id, p_status, 'revenuecat', p_expires_at, now())
  on conflict (user_id) do update
  set
    status = excluded.status,
    provider = 'revenuecat',
    expires_at = excluded.expires_at,
    updated_at = now();
end;
$$;

create or replace function public.process_revenuecat_webhook(
  p_event_id text,
  p_event_type text,
  p_app_user_id text,
  p_user_id uuid,
  p_status text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_id is null or char_length(trim(p_event_id)) = 0 then
    raise exception 'Missing event id';
  end if;

  insert into public.revenuecat_webhook_events (event_id, event_type, app_user_id)
  values (p_event_id, coalesce(p_event_type, 'unknown'), p_app_user_id)
  on conflict (event_id) do nothing;

  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'duplicate_event');
  end if;

  if p_user_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'non_profile_app_user_id');
  end if;

  perform public.apply_revenuecat_subscription(p_user_id, p_status, p_expires_at);

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'status', p_status,
    'expires_at', p_expires_at
  );
end;
$$;

revoke all on table public.revenuecat_webhook_events from public, anon, authenticated;
revoke all on function public.apply_revenuecat_subscription(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.process_revenuecat_webhook(text, text, text, uuid, text, timestamptz) from public, anon, authenticated;

grant all on table public.revenuecat_webhook_events to service_role;
grant execute on function public.apply_revenuecat_subscription(uuid, text, timestamptz) to service_role;
grant execute on function public.process_revenuecat_webhook(text, text, text, uuid, text, timestamptz) to service_role;
