-- In-app support tickets (bug reports and feedback).

do $$ begin
  create type public.support_ticket_category as enum ('bug_report', 'feedback');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.support_ticket_category not null,
  subject text not null check (char_length(trim(subject)) >= 3),
  message text not null check (char_length(trim(message)) >= 10),
  status public.support_ticket_status not null default 'open',
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row
  execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists "Users can view own support tickets" on public.support_tickets;
create policy "Users can view own support tickets"
  on public.support_tickets
  for select
  using (auth.uid() = user_id);

create or replace function public.create_support_ticket(
  p_category public.support_ticket_category,
  p_subject text,
  p_message text,
  p_app_version text default null
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets;
  v_subject text := trim(p_subject);
  v_message text := trim(p_message);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_subject) < 3 then
    raise exception 'Subject must be at least 3 characters';
  end if;

  if char_length(v_message) < 10 then
    raise exception 'Message must be at least 10 characters';
  end if;

  insert into public.support_tickets (
    user_id,
    category,
    subject,
    message,
    app_version
  )
  values (
    v_user_id,
    p_category,
    v_subject,
    v_message,
    nullif(trim(p_app_version), '')
  )
  returning * into v_ticket;

  return v_ticket;
end;
$$;

create or replace function public.get_my_support_tickets()
returns table (
  id uuid,
  category public.support_ticket_category,
  subject text,
  message text,
  status public.support_ticket_status,
  app_version text,
  created_at timestamptz,
  updated_at timestamptz
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
    st.id,
    st.category,
    st.subject,
    st.message,
    st.status,
    st.app_version,
    st.created_at,
    st.updated_at
  from public.support_tickets st
  where st.user_id = v_user_id
  order by st.created_at desc
  limit 50;
end;
$$;

grant execute on function public.create_support_ticket(public.support_ticket_category, text, text, text) to authenticated;
grant execute on function public.get_my_support_tickets() to authenticated;
