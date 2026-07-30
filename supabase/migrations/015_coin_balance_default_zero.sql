-- New users should start with 0 coins (not 250).

alter table public.profiles
  alter column coin_balance set default 0;
