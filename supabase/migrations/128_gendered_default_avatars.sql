-- Default avatars follow the gender picked at sign-up (auth metadata `gender`).
-- Every new account starts from the same look for its gender; accounts without a
-- gender (older sign-ups) get the male one. Keep in sync with DEFAULT_APPEARANCE
-- in src/features/avatar/avatarOptions.ts.

create or replace function public.create_default_avatar(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_female boolean;
begin
  select coalesce(u.raw_user_meta_data->>'gender' = 'female', false)
  into v_is_female
  from auth.users u
  where u.id = p_user_id;

  v_is_female := coalesce(v_is_female, false);

  insert into public.user_avatars (user_id, appearance, accessories)
  values (
    p_user_id,
    jsonb_build_object(
      'bodyType', case when v_is_female then 'female' else 'male' end,
      'headShape', 'oval',
      'skinColor', 'skin_3',
      'eyes', case when v_is_female then 'wink' else 'almond' end,
      'eyeColor', 'eye_brown',
      'brows', 'straight',
      'nose', 'button',
      'mouth', case when v_is_female then 'smirk' else 'grin' end,
      'hair', case when v_is_female then 'space_buns' else 'short_spiky' end,
      'hairColor', 'hair_black',
      'facialHair', case when v_is_female then 'none' else 'goatee' end,
      'background', 'bg_indigo'
    ),
    jsonb_build_object(
      'top', case when v_is_female then 'wear_top_pink_tee' else 'wear_top_blue_tee' end,
      'headwear', 'wear_headwear_sweatband'
    )
  )
  on conflict (user_id) do nothing;
end;
$$;
