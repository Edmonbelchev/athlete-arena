-- Disable steps and running goals until manual tracking is ready.

update public.goal_activity_catalog
set enabled = false
where id in ('steps', 'run_km', 'run_mi');
