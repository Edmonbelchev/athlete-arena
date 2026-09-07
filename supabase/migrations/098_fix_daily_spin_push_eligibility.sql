-- Daily spin push: skip users who already spun since local midnight.
-- The previous check used UTC spin_date, which could notify users who had already
-- spun earlier the same local day once UTC rolled over before local noon.

create or replace function public.user_spun_since_local_midnight(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_spins ds
    where ds.user_id = p_user_id
      and ds.created_at >= (
        date_trunc(
          'day',
          timezone(public.profile_timezone(p_user_id), now())
        ) at time zone public.profile_timezone(p_user_id)
      )
  );
$$;

revoke all on function public.user_spun_since_local_midnight(uuid) from public;

create or replace function public.enqueue_engagement_push_notification(
  p_user_id uuid,
  p_notification_type text,
  p_preference_key text,
  p_dedupe_key text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_inserted integer;
begin
  if p_user_id is null then
    return null;
  end if;

  if coalesce(trim(p_dedupe_key), '') = '' then
    return null;
  end if;

  if not public.user_notification_enabled(p_user_id, p_preference_key) then
    return null;
  end if;

  if not exists (
    select 1
    from public.user_push_tokens t
    where t.user_id = p_user_id
  ) then
    return null;
  end if;

  if p_notification_type = 'daily_spin'
     and public.user_spun_since_local_midnight(p_user_id) then
    return null;
  end if;

  insert into public.engagement_push_sent (user_id, notification_type, dedupe_key)
  values (p_user_id, p_notification_type, p_dedupe_key)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return null;
  end if;

  insert into public.push_notifications_outbox (user_id, title, body, data)
  values (p_user_id, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.send_daily_spin_push_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select
      p.id as user_id,
      (timezone(public.profile_timezone(p.id), now()))::date as local_today
    from public.profiles p
    where exists (
      select 1
      from public.user_push_tokens t
      where t.user_id = p.id
    )
      and extract(
        hour from timezone(public.profile_timezone(p.id), now())
      ) = 12
      and not public.user_spun_since_local_midnight(p.id)
  loop
    if public.enqueue_engagement_push_notification(
      v_row.user_id,
      'daily_spin',
      'dailySpin',
      v_row.local_today::text,
      'Free spin ready',
      'Claim your daily coins on the wheel.',
      jsonb_build_object(
        'type', 'daily_spin',
        'url', '/spin'
      )
    ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_engagement_push_notification(uuid, text, text, text, text, text, jsonb) from public;
revoke all on function public.send_daily_spin_push_notifications() from public;
