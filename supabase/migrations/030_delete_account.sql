-- Self-service account deletion with optional feedback.

create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  username text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_feedback_created_idx
  on public.account_deletion_feedback (created_at desc);

alter table public.account_deletion_feedback enable row level security;

create or replace function public.delete_my_account(p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.username into v_username
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.account_deletion_feedback (user_id, username, reason)
  values (
    v_user_id,
    v_username,
    nullif(trim(p_reason), '')
  );

  delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function public.delete_my_account(text) to authenticated;
