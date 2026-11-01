-- User safety (App Store Guideline 1.2 - user-generated content):
--   * block users  - blocking ends the friendship, cancels anything pending between the two, and
--                    prevents new friend requests, challenges, and workout shares in either direction
--   * report users - reports are stored for review (act on them within 24 hours)
--   * filter       - usernames, display names, and bios are checked against a term list

-- ---------------------------------------------------------------------------------------------
-- Blocks

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users read their own blocks" on public.user_blocks;
create policy "Users read their own blocks"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

-- Writes go through block_user / unblock_user only.

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null or p_user_id = v_me then
    raise exception 'You cannot block yourself.';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_me, p_user_id)
  on conflict do nothing;

  -- End the friendship and any pending request, in either direction.
  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_user_id)
     or (requester_id = p_user_id and addressee_id = v_me);

  -- Cancel friend challenges between the two that are not finished.
  update public.friend_challenge_participants p
  set status = 'declined'
  where p.status in ('pending', 'in_progress')
    and p.challenge_id in (
      select mine.challenge_id
      from public.friend_challenge_participants mine
      join public.friend_challenge_participants theirs
        on theirs.challenge_id = mine.challenge_id
      where mine.user_id = v_me
        and theirs.user_id = p_user_id
    );

  -- Remove workout shares between the two.
  delete from public.custom_workout_template_shares
  where (owner_id = v_me and shared_with_id = p_user_id)
     or (owner_id = p_user_id and shared_with_id = v_me);
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_blocks
  where blocker_id = auth.uid() and blocked_id = p_user_id;
end;
$$;

-- Everyone the current user should not see: people they blocked and people who blocked them.
create or replace function public.get_hidden_user_ids()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select blocked_id from public.user_blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.user_blocks where blocked_id = auth.uid();
$$;

-- The users the current user blocked, for the "Blocked users" settings screen.
create or replace function public.get_blocked_users()
returns table (user_id uuid, username text, display_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, p.username, p.display_name, b.created_at
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.get_hidden_user_ids() to authenticated;
grant execute on function public.get_blocked_users() to authenticated;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;

-- Enforce blocks no matter which function creates the row.

create or replace function public.prevent_blocked_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(new.requester_id, new.addressee_id) then
    raise exception 'You can''t interact with this user.';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_prevent_blocked on public.friendships;
create trigger friendships_prevent_blocked
  before insert or update on public.friendships
  for each row execute function public.prevent_blocked_friendship();

create or replace function public.prevent_blocked_challenge_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
begin
  select creator_id into v_creator from public.friend_challenges where id = new.challenge_id;
  if v_creator is not null and v_creator <> new.user_id
     and public.is_blocked_between(v_creator, new.user_id) then
    raise exception 'You can''t interact with this user.';
  end if;
  return new;
end;
$$;

drop trigger if exists friend_challenge_participants_prevent_blocked on public.friend_challenge_participants;
create trigger friend_challenge_participants_prevent_blocked
  before insert on public.friend_challenge_participants
  for each row execute function public.prevent_blocked_challenge_participant();

create or replace function public.prevent_blocked_workout_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(new.owner_id, new.shared_with_id) then
    raise exception 'You can''t interact with this user.';
  end if;
  return new;
end;
$$;

drop trigger if exists custom_workout_template_shares_prevent_blocked on public.custom_workout_template_shares;
create trigger custom_workout_template_shares_prevent_blocked
  before insert on public.custom_workout_template_shares
  for each row execute function public.prevent_blocked_workout_share();

-- ---------------------------------------------------------------------------------------------
-- Reports

do $$ begin
  create type public.user_report_reason as enum (
    'inappropriate_name',
    'inappropriate_bio',
    'offensive_avatar',
    'harassment',
    'cheating',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason public.user_report_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  -- Snapshot of what was reported, in case the user changes it before review.
  reported_username text,
  reported_display_name text,
  reported_bio text,
  status public.user_report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint user_reports_no_self check (reporter_id <> reported_id)
);

create index if not exists user_reports_open_idx on public.user_reports (status, created_at);

alter table public.user_reports enable row level security;
-- No client policies: reports are written by report_user and reviewed in the dashboard.

create or replace function public.report_user(
  p_user_id uuid,
  p_reason public.user_report_reason,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_recent integer;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null or p_user_id = v_me then
    raise exception 'You cannot report yourself.';
  end if;

  -- Light rate limit against report spam.
  select count(*) into v_recent
  from public.user_reports
  where reporter_id = v_me and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Too many reports - please try again later.';
  end if;

  insert into public.user_reports (
    reporter_id, reported_id, reason, details,
    reported_username, reported_display_name, reported_bio
  )
  select
    v_me, p.id, p_reason, nullif(trim(left(coalesce(p_details, ''), 1000)), ''),
    p.username, p.display_name, p.bio
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

grant execute on function public.report_user(uuid, public.user_report_reason, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Objectionable content filter (usernames, display names, bios)

create table if not exists public.moderation_terms (
  term text primary key,
  -- 'contains': flagged anywhere in the text (long, unambiguous terms).
  -- 'word': flagged only as a whole word (short terms that appear inside normal words).
  match_mode text not null default 'contains' check (match_mode in ('contains', 'word'))
);

alter table public.moderation_terms enable row level security;
-- No client policies: the list is only read by the functions below.

insert into public.moderation_terms (term, match_mode) values
  ('fuck', 'contains'), ('fuk', 'word'), ('fck', 'word'), ('shit', 'contains'), ('bitch', 'contains'),
  ('bastard', 'contains'), ('asshole', 'contains'), ('ass', 'word'), ('dick', 'word'), ('dickhead', 'contains'),
  ('cock', 'word'), ('cocksucker', 'contains'), ('pussy', 'contains'), ('cunt', 'contains'), ('twat', 'contains'),
  ('wanker', 'contains'), ('prick', 'word'), ('slut', 'contains'), ('whore', 'contains'), ('hoe', 'word'),
  ('motherfucker', 'contains'), ('bullshit', 'contains'), ('jackass', 'contains'), ('douche', 'contains'),
  ('porn', 'contains'), ('porno', 'contains'), ('nude', 'word'), ('nudes', 'word'), ('sex', 'word'),
  ('sexy', 'word'), ('dildo', 'contains'), ('blowjob', 'contains'), ('handjob', 'contains'), ('cum', 'word'),
  ('penis', 'contains'), ('vagina', 'contains'), ('boobs', 'contains'), ('tits', 'word'), ('rape', 'word'),
  ('rapist', 'contains'), ('pedo', 'contains'), ('pedophile', 'contains'), ('incest', 'contains'),
  ('nigger', 'contains'), ('nigga', 'contains'), ('faggot', 'contains'), ('fag', 'word'), ('retard', 'contains'),
  ('spic', 'word'), ('chink', 'contains'), ('kike', 'contains'), ('wetback', 'contains'), ('tranny', 'contains'),
  ('dyke', 'contains'), ('coon', 'word'), ('gook', 'contains'), ('raghead', 'contains'), ('towelhead', 'contains'),
  ('nazi', 'contains'), ('hitler', 'contains'), ('heil', 'word'), ('kkk', 'contains'),
  ('killyourself', 'contains'), ('kys', 'word')
on conflict (term) do nothing;

/**
 * True when the text contains a moderation term. The text is lowercased and common look-alike
 * characters are mapped back to letters (0->o, 1->i, 3->e, 4->a, 5->s, 7->t, @->a, $->s).
 * "contains" terms are matched inside each space-separated word with other symbols removed, so
 * "f_u_c_k" and "fu.ck" are caught but "this hit" is not read as one word. "word" terms must be
 * a whole word.
 */
create or replace function public.contains_objectionable_text(p_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mapped text;
  v_joined text;
  v_words text;
begin
  if p_text is null or btrim(p_text) = '' then
    return false;
  end if;

  v_mapped := translate(lower(p_text), '013457@$', 'oieastas');
  -- Letters only, everything else as a word break.
  v_words := ' ' || regexp_replace(v_mapped, '[^a-z]+', ' ', 'g') || ' ';
  -- Letters and spaces only: symbols inside a word are dropped, spaces still separate words.
  v_joined := regexp_replace(regexp_replace(v_mapped, '\s+', ' ', 'g'), '[^a-z ]+', '', 'g');

  return exists (
    select 1
    from public.moderation_terms t
    where (t.match_mode = 'contains' and position(t.term in v_joined) > 0)
       or (t.match_mode = 'word' and position(' ' || t.term || ' ' in v_words) > 0)
  );
end;
$$;

grant execute on function public.contains_objectionable_text(text) to anon, authenticated;

create or replace function public.enforce_profile_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Signup must not fail: replace an objectionable username with a generated one and drop
    -- objectionable display names / bios. The user can pick a new name later.
    if public.contains_objectionable_text(new.username) then
      new.username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
    if public.contains_objectionable_text(new.display_name) then
      new.display_name := null;
    end if;
    if public.contains_objectionable_text(new.bio) then
      new.bio := null;
    end if;
    return new;
  end if;

  if new.username is distinct from old.username and public.contains_objectionable_text(new.username) then
    raise exception 'That username contains language that isn''t allowed.';
  end if;
  if new.display_name is distinct from old.display_name and public.contains_objectionable_text(new.display_name) then
    raise exception 'That name contains language that isn''t allowed.';
  end if;
  if new.bio is distinct from old.bio and public.contains_objectionable_text(new.bio) then
    raise exception 'Your bio contains language that isn''t allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_content on public.profiles;
create trigger profiles_enforce_content
  before insert or update of username, display_name, bio on public.profiles
  for each row execute function public.enforce_profile_content();

-- Usernames that would be filtered are reported as unavailable at signup.
create or replace function public.is_username_allowed(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.contains_objectionable_text(p_username);
$$;

grant execute on function public.is_username_allowed(text) to anon, authenticated;
