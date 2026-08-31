-- Lower legend rep achievement XP rewards from 500 to 250.

update public.achievements
set xp_reward = 250
where id in ('push_up_legend', 'squat_legend', 'pull_up_legend', 'burpee_legend');
