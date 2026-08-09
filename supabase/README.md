# Supabase setup

## Quick setup (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **SQL Editor** → **New query**
3. Copy the entire contents of **`supabase/setup.sql`**
4. Click **Run**

That single script creates everything the app needs.

## What gets created

### Tables

| Table | Purpose |
|-------|---------|
| `public.profiles` | User stats (XP, level, streaks, username) |
| `public.daily_challenges` | One random challenge per user per day |

### Enums

- `exercise_type` - `push_ups`, `squats`
- `challenge_status` - `pending`, `in_progress`, `completed`, `declined`

### Friends (migration `004_friends.sql`)

Run after initial setup if you want friends and custom challenges:

```sql
-- Paste contents of supabase/migrations/004_friends.sql
```

| Table | Purpose |
|-------|---------|
| `public.friendships` | Friend requests and accepted friends |
| `public.friend_challenges` | Custom exercise + rep challenges between friends |
| `public.friend_challenge_participants` | Per-user progress on a friend challenge |

| Function | Purpose |
|----------|---------|
| `search_users_by_username(text)` | Find users to add |
| `send_friend_request(text)` | Send request by username |
| `respond_friend_request(uuid, bool)` | Accept or decline |
| `get_friends_list()` | List accepted friends |
| `get_incoming_friend_requests()` | Pending incoming requests |
| `create_friend_challenge(uuid, exercise, reps, message?)` | Challenge a friend |
| `get_my_friend_challenges()` | Active friend challenges |
| `accept_friend_challenge(uuid)` | Accept invitation |
| `decline_friend_challenge(uuid)` | Decline invitation |
| `start_friend_challenge(uuid)` | Begin attempt |
| `complete_friend_challenge(uuid, int)` | Sync reps and award XP |

### Timed friend challenges (migration `005_friend_challenge_timer.sql`)

Run after `004_friends.sql` to add optional time limits:

```sql
-- Paste contents of supabase/migrations/005_friend_challenge_timer.sql
```

- Optional `time_limit_seconds` (60–5400) when creating a challenge
- Timer starts when the invited friend **accepts**
- Both players must finish before `deadline_at` or the challenge expires

### Challenge history (migration `007_challenge_history.sql`)

```sql
-- Paste contents of supabase/migrations/007_challenge_history.sql
```

| Function | Purpose |
|----------|---------|
| `get_challenge_history(limit?)` | Past daily + friend challenges with results (up to 100) |

### Triggers

- Auto-create profile when a user signs up (`auth.users` → `profiles`)
- Block direct client edits to XP / streak / level
- Auto-update `profiles.updated_at`

### RPC functions (server-side)

| Function | Purpose |
|----------|---------|
| `get_daily_challenge_home()` | Resolve today's global workout + read user progress (no user row created) |
| `get_or_create_daily_challenge()` | Create today's user progress row when starting a challenge |
| `ensure_daily_challenge_template(date?)` | Resolve/create the shared daily template from the 30-challenge catalog |
| `seed_upcoming_daily_challenge_templates(days?)` | Pre-generate templates (service role / cron) |
| `start_challenge(uuid)` | Mark challenge as in progress |
| `complete_challenge(uuid, int)` | Sync reps, award XP once, update streak |

### Row Level Security

- Users can **read** their own profiles and challenges
- Users can **update** their own profile (username, display name only - stats protected)
- Challenge **writes** go through RPCs only (no insert/update policies for clients)

## Verify setup

Run this in the SQL Editor after `setup.sql`:

```sql
select 'profiles' as object, count(*)::text as count from public.profiles
union all
select 'daily_challenges', count(*)::text from public.daily_challenges;
```

You should see table counts (may be 0 if no users yet).

Check functions exist:

```sql
select proname
from pg_proc
where proname in (
  'get_or_create_daily_challenge',
  'start_challenge',
  'complete_challenge'
);
```

## Auth settings

Configure in the Supabase Dashboard (hosted project):

**Authentication → Providers → Email**

- Email provider: enabled
- **Confirm email**: enabled for production

**Authentication → Email Templates → Confirm signup**

- Custom template and sender (e.g. `support@athlete-arena.app`)

**Authentication → SMTP Settings**

- Custom SMTP for your domain

**Authentication → URL Configuration**

- Site URL: `https://athlete-arena.app`
- Redirect URLs: add `athletearena://login` (email confirmation) and `athletearena://reset-password` (password reset)

## Environment variables

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Restart Metro after changing `.env`.

## Leaderboard (migration `028_leaderboard.sql`)

Run after core migrations:

```sql
-- Paste contents of supabase/migrations/028_leaderboard.sql
```

| Object | Purpose |
|--------|---------|
| `xp_events` | Logs XP awards for weekly rankings |
| `get_xp_leaderboard(period, limit?)` | Returns weekly or all-time top players |
| Updated `complete_challenge` / `award_friend_challenge_xp` | Write XP events when XP is earned |

Weekly rankings use **UTC weeks starting Monday**. All-time rankings use `profiles.total_xp`.

## Incremental migrations

If you prefer running migrations separately:

1. `supabase/migrations/001_profiles.sql`
2. `supabase/migrations/002_daily_challenges.sql`
3. `supabase/migrations/003_functions.sql`
4. …through `024_daily_challenge_catalog.sql` for the global 30-challenge rotation

`setup.sql` is equivalent to the early migrations plus a backfill for existing auth users. For production, apply the full migration chain (or `supabase db push`).

## Supabase CLI (optional)

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Project ref is the subdomain in your Supabase URL: `https://YOUR_PROJECT_REF.supabase.co`
