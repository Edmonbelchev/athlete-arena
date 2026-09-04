# Push notifications (TestFlight / production)

Athlete Arena uses **Expo Push Notifications** with Supabase Edge Functions and a database outbox queue.

Events that trigger push:

- Friend request received / accepted
- Friend speed race received / accepted / declined
- Friend workout waiting (2 hours after opponent finishes, if you have not started; once per challenge)
- Daily spin ready (scheduled, 12:00 local time)
- Streak at risk (scheduled, 20:00 local time if mission incomplete)

## 1. Link Expo + EAS

If the app is not linked to an Expo project yet:

```bash
npm install -g eas-cli
eas login
eas init
```

Copy the project ID into:

- `app.json` → `extra.eas.projectId`
- `.env` → `EXPO_PUBLIC_EAS_PROJECT_ID`

## 2. Configure Apple Push (TestFlight)

In [Expo credentials](https://expo.dev/accounts/_/projects/athlete-arena/credentials):

1. Open the iOS app credentials for `com.athletearena.app`
2. Upload or generate an **APNs key** (`.p8`) for push notifications
3. EAS attaches it to your next iOS build automatically

Then create a **new TestFlight build** (push requires native rebuild):

```bash
eas build --profile production --platform ios
eas submit --platform ios
```

Push does not work in Expo Go. Use your TestFlight or dev client build on a physical device.

Optional but recommended: create an [Expo access token](https://expo.dev/accounts/_/settings/access-tokens) with **Enhanced Security for Push Notifications** enabled.

## 3. Apply database migration

Run in the Supabase SQL editor:

`supabase/migrations/039_push_notifications.sql`

This adds:

- `user_push_tokens` — device tokens registered by the app
- `push_notifications_outbox` — queue rows consumed by the edge function
- RPCs: `register_push_token`, `unregister_push_token`
- Push enqueue hooks on friend/challenge RPCs

## 4. Deploy the edge function

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy push --no-verify-jwt
supabase secrets set EXPO_ACCESS_TOKEN=your_expo_access_token
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in hosted Edge Functions.

## 5. Create the database webhook

In Supabase Dashboard → **Integrations → Database Webhooks**:

| Setting | Value |
|---------|--------|
| Table | `public.push_notifications_outbox` |
| Events | `INSERT` |
| Type | Supabase Edge Functions |
| Function | `push` |
| HTTP method | `POST` |
| Headers | Add auth header with **service role key** |

Each inserted outbox row sends push notifications to all tokens registered for that user.

## 6. Test on device

1. Install the latest TestFlight build
2. Sign in and accept the iOS notification permission prompt
3. Trigger an event (e.g. send a friend request from another account)
4. Put the app in the background and confirm the notification arrives

### Debug tips

- Token registration logs only appear in dev builds (`[push]` warnings)
- Verify a row exists in `user_push_tokens` for your user after login
- Verify a row is inserted into `push_notifications_outbox` when the event fires
- Check Edge Function logs in Supabase Dashboard if the webhook runs but no push arrives
- Confirm `extra.eas.projectId` matches your Expo project

## 7. Schedule engagement reminders

Deploy the scheduler edge function:

```bash
supabase functions deploy engagement-push --no-verify-jwt
```

In Supabase Dashboard → **Integrations → Cron** (or Edge Function schedules), run `engagement-push` **every hour** (`0 * * * *`).

The function calls `run_engagement_push_scheduler()`, which:

| Notification | Local time | Condition |
|--------------|------------|-----------|
| Daily spin ready | 12:00 | No spin claimed today (UTC spin day) |
| Streak at risk | 20:00 | Weekly mission streak ≥ 2, no mission completed today |
| Friend workout waiting | — | 2 hours after opponent finishes, if you have not started; max one push per challenge, batched if several are due |

Users can turn each type off in **Settings → Notifications**. Timezone comes from the device and is stored in `profiles.preferences.timezone`.

Manual test (SQL editor):

```sql
select public.run_engagement_push_scheduler();
```

Also apply migrations `096_engagement_push_notifications.sql` and `097_friend_waiting_push_delay.sql`.

## Client files

- `src/services/pushNotificationService.ts` — permission + token registration
- `src/features/notifications/usePushNotifications.ts` — app lifecycle hook
- `src/features/notifications/pushNotificationRouting.ts` — tap → deep link
- `src/app/profile/settings.tsx` — notification preference toggles
