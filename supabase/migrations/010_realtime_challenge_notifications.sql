-- Enable Supabase Realtime for friend challenge participant events.

alter table public.friend_challenge_participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.friend_challenge_participants;
exception
  when duplicate_object then null;
end $$;
