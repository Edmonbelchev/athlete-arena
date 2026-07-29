-- Run after setup.sql to confirm everything was created correctly.

select 'tables' as check_type, tablename as name
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'daily_challenges')

union all

select 'functions', proname
from pg_proc
join pg_namespace n on n.oid = pg_proc.pronamespace
where n.nspname = 'public'
  and proname in (
    'get_or_create_daily_challenge',
    'start_challenge',
    'complete_challenge',
    'handle_new_user'
  )

union all

select 'rls_enabled', c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'daily_challenges')
  and c.relrowsecurity = true

order by check_type, name;
