-- User preferences stored on profile (theme, pose skeleton overlay, etc.)

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.preferences is
  'User settings synced across devices: theme, showPoseSkeleton, etc.';
