-- Signup uniqueness checks and strict username enforcement on account creation.

create or replace function public.is_username_available(
  p_username text,
  p_exclude_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
begin
  if v_username = '' or v_username !~ '^[a-z0-9_]{3,30}$' then
    return false;
  end if;

  return not exists (
    select 1
    from public.profiles
    where lower(username) = v_username
      and (p_exclude_user_id is null or id <> p_exclude_user_id)
  );
end;
$$;

create or replace function public.is_email_registered(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' then
    return false;
  end if;

  return exists (
    select 1
    from auth.users
    where lower(email) = v_email
  );
end;
$$;

grant execute on function public.is_username_available(text, uuid) to anon, authenticated;
grant execute on function public.is_email_registered(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  final_username text;
begin
  raw_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));

  if raw_username = '' or raw_username !~ '^[a-z0-9_]{3,30}$' then
    raw_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  if exists (
    select 1
    from public.profiles
    where lower(username) = raw_username
  ) then
    raise exception 'username_taken';
  end if;

  final_username := raw_username;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  );

  perform public.grant_starter_shop_items(new.id);

  return new;
end;
$$;
