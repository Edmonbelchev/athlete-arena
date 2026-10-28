-- Optional "about me" description on profiles, and a default avatar for every user.

alter table public.profiles
  add column if not exists bio text check (bio is null or char_length(bio) <= 160);

-- Friend profiles now include the description. The return type changes, so drop first.
drop function if exists public.get_friend_profile(uuid);

create function public.get_friend_profile(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  level integer,
  total_xp integer,
  current_streak integer,
  longest_streak integer,
  avatar_url text,
  avatar_icon text,
  avatar_background text,
  frame_border_color text,
  frame_border_width integer,
  equipped_title_name text
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

  if p_user_id is null then
    raise exception 'User not found';
  end if;

  return query
  select
    p.id as user_id,
    p.username,
    p.display_name,
    p.bio,
    p.level,
    p.total_xp,
    p.current_streak,
    p.longest_streak,
    p.avatar_url,
    avatar_item.metadata->>'icon' as avatar_icon,
    avatar_item.metadata->>'backgroundColor' as avatar_background,
    frame_item.metadata->>'borderColor' as frame_border_color,
    nullif(frame_item.metadata->>'borderWidth', '')::integer as frame_border_width,
    title_item.name as equipped_title_name
  from public.profiles p
  left join public.user_equipped_items uei_avatar
    on uei_avatar.user_id = p.id and uei_avatar.slot = 'avatar'
  left join public.shop_items avatar_item on avatar_item.id = uei_avatar.item_id
  left join public.user_equipped_items uei_frame
    on uei_frame.user_id = p.id and uei_frame.slot = 'frame'
  left join public.shop_items frame_item on frame_item.id = uei_frame.item_id
  left join public.titles title_item on title_item.id = p.equipped_title_id
  where p.id = p_user_id;
end;
$$;

-- Default avatar: a varied look derived from the user id, built only from options
-- available to both body types. Users change body type and everything else in the editor.
create or replace function public.create_default_avatar(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed bytea := decode(md5(p_user_id::text), 'hex');
  v_skins text[] := array['skin_1', 'skin_2', 'skin_3', 'skin_4', 'skin_5', 'skin_6'];
  v_head_shapes text[] := array['oval', 'round', 'square', 'long'];
  v_hair text[] := array['buzz', 'short', 'side_part', 'spiky', 'curly'];
  v_hair_colors text[] := array['hair_black', 'hair_dark_brown', 'hair_brown', 'hair_auburn', 'hair_blonde'];
  v_eyes text[] := array['round', 'almond', 'big', 'happy'];
  v_brows text[] := array['straight', 'arched', 'thin'];
  v_noses text[] := array['button', 'small', 'soft'];
  v_mouths text[] := array['smile', 'grin'];
  v_eye_colors text[] := array['eye_brown', 'eye_hazel', 'eye_blue', 'eye_green'];
  v_backgrounds text[] := array['bg_indigo', 'bg_sky', 'bg_emerald', 'bg_amber', 'bg_orange', 'bg_rose', 'bg_violet', 'bg_slate'];
  v_tops text[] := array['wear_top_blue_tee', 'wear_top_pink_tee', 'wear_top_gray_hoodie'];
begin
  insert into public.user_avatars (user_id, appearance, accessories)
  values (
    p_user_id,
    jsonb_build_object(
      'bodyType', 'male',
      'headShape', v_head_shapes[1 + get_byte(v_seed, 0) % array_length(v_head_shapes, 1)],
      'skinColor', v_skins[1 + get_byte(v_seed, 1) % array_length(v_skins, 1)],
      'eyes', v_eyes[1 + get_byte(v_seed, 2) % array_length(v_eyes, 1)],
      'eyeColor', v_eye_colors[1 + get_byte(v_seed, 3) % array_length(v_eye_colors, 1)],
      'brows', v_brows[1 + get_byte(v_seed, 4) % array_length(v_brows, 1)],
      'nose', v_noses[1 + get_byte(v_seed, 5) % array_length(v_noses, 1)],
      'mouth', v_mouths[1 + get_byte(v_seed, 6) % array_length(v_mouths, 1)],
      'hair', v_hair[1 + get_byte(v_seed, 7) % array_length(v_hair, 1)],
      'hairColor', v_hair_colors[1 + get_byte(v_seed, 8) % array_length(v_hair_colors, 1)],
      'facialHair', 'none',
      'background', v_backgrounds[1 + get_byte(v_seed, 9) % array_length(v_backgrounds, 1)]
    ),
    jsonb_build_object('top', v_tops[1 + get_byte(v_seed, 10) % array_length(v_tops, 1)])
  )
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.handle_new_profile_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_default_avatar(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_create_default_avatar on public.profiles;
create trigger profiles_create_default_avatar
  after insert on public.profiles
  for each row
  execute function public.handle_new_profile_avatar();

-- Existing users without an avatar get one now. The app renders and uploads the
-- matching profile picture the next time each user opens it.
select public.create_default_avatar(p.id)
from public.profiles p
where not exists (select 1 from public.user_avatars ua where ua.user_id = p.id);
