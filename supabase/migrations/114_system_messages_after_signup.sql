-- New accounts should not receive announcements published before they signed up:
-- they would show up as unread and pop up right after registration.

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
  v_joined_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.created_at into v_joined_at
  from public.profiles p
  where p.id = v_user_id;

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
    and (v_joined_at is null or m.published_at >= v_joined_at)
  order by m.published_at desc
  limit 30;
end;
$$;
