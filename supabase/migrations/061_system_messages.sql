-- Global system messages: same content for all users, in-app inbox + optional push broadcast.

create table if not exists public.system_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  summary text,
  body text not null check (char_length(trim(body)) > 0),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists system_messages_published_at_idx
  on public.system_messages (published_at desc);

create table if not exists public.system_message_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.system_messages (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index if not exists system_message_reads_message_id_idx
  on public.system_message_reads (message_id);

alter table public.system_messages enable row level security;
alter table public.system_message_reads enable row level security;

create policy "Authenticated users can read published system messages"
  on public.system_messages
  for select
  to authenticated
  using (published_at <= now());

create policy "Users can read own system message reads"
  on public.system_message_reads
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can mark own system message reads"
  on public.system_message_reads
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own system message reads"
  on public.system_message_reads
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_active_system_messages()
returns table (
  id uuid,
  title text,
  summary text,
  published_at timestamptz,
  read boolean
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

  return query
  select
    m.id,
    m.title,
    coalesce(nullif(trim(m.summary), ''), left(trim(m.body), 140)) as summary,
    m.published_at,
    exists (
      select 1
      from public.system_message_reads r
      where r.user_id = v_user_id
        and r.message_id = m.id
    ) as read
  from public.system_messages m
  where m.published_at <= now()
  order by m.published_at desc
  limit 30;
end;
$$;

create or replace function public.get_system_message(p_message_id uuid)
returns table (
  id uuid,
  title text,
  summary text,
  body text,
  published_at timestamptz,
  read boolean
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

  return query
  select
    m.id,
    m.title,
    m.summary,
    m.body,
    m.published_at,
    exists (
      select 1
      from public.system_message_reads r
      where r.user_id = v_user_id
        and r.message_id = m.id
    ) as read
  from public.system_messages m
  where m.id = p_message_id
    and m.published_at <= now();
end;
$$;

create or replace function public.mark_system_message_read(p_message_id uuid)
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

  if not exists (
    select 1
    from public.system_messages m
    where m.id = p_message_id
      and m.published_at <= now()
  ) then
    raise exception 'System message not found';
  end if;

  insert into public.system_message_reads (user_id, message_id, read_at)
  values (v_user_id, p_message_id, now())
  on conflict (user_id, message_id) do update
  set read_at = excluded.read_at;
end;
$$;

-- Publish a global announcement and optionally enqueue push notifications for all users.
-- Run from Supabase SQL Editor or with service_role, e.g.:
--   select public.publish_system_message(
--     'Maintenance tonight',
--     'Brief downtime at 10 PM UTC',
--     'We are rolling out an update tonight at 10 PM UTC. The app may be unavailable for up to 15 minutes.',
--     true
--   );
create or replace function public.publish_system_message(
  p_title text,
  p_summary text default null,
  p_body text default null,
  p_send_push boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_summary text := nullif(trim(coalesce(p_summary, '')), '');
  v_push_body text;
begin
  if v_title = '' then
    raise exception 'Title is required';
  end if;

  if v_body = '' then
    raise exception 'Body is required';
  end if;

  insert into public.system_messages (title, summary, body, published_at)
  values (v_title, v_summary, v_body, now())
  returning id into v_message_id;

  v_push_body := coalesce(v_summary, left(v_body, 140));

  if p_send_push then
    insert into public.push_notifications_outbox (user_id, title, body, data)
    select
      p.id,
      v_title,
      v_push_body,
      jsonb_build_object(
        'type', 'system_message',
        'messageId', v_message_id,
        'url', '/system-message/' || v_message_id::text
      )
    from public.profiles p;
  end if;

  return v_message_id;
end;
$$;

alter table public.system_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.system_messages;
exception
  when duplicate_object then null;
end $$;

grant execute on function public.get_active_system_messages() to authenticated;
grant execute on function public.get_system_message(uuid) to authenticated;
grant execute on function public.mark_system_message_read(uuid) to authenticated;

revoke all on function public.publish_system_message(text, text, text, boolean) from public;
grant execute on function public.publish_system_message(text, text, text, boolean) to service_role;
