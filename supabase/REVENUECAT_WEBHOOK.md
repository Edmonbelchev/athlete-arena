# RevenueCat webhook → Supabase premium sync

Athlete Arena stores **server-side premium** in `public.user_subscriptions`. The mobile app identifies RevenueCat users with their **Supabase UUID** (`Purchases.logIn(userId)`).

This edge function keeps `user_subscriptions` in sync when purchases renew, cancel, or expire.

## Flow

```text
RevenueCat (INITIAL_PURCHASE, RENEWAL, EXPIRATION, …)
  → POST supabase/functions/v1/revenuecat-webhook
  → process_revenuecat_webhook() RPC
  → upsert user_subscriptions (provider = revenuecat)
```

Idempotency: `revenuecat_webhook_events` stores each processed event id (per user for transfers).

## 1. Apply migration

Run in Supabase SQL editor or via CLI:

`supabase/migrations/067_revenuecat_webhook.sql`

Adds:

- `revenuecat_webhook_events` — dedupe table (service role only)
- `apply_revenuecat_subscription()` — upsert helper
- `process_revenuecat_webhook()` — idempotent processor

## 2. Deploy the edge function

Generate a long random authorization secret (e.g. `openssl rand -hex 32`).

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push   # if using CLI migrations locally

supabase secrets set \
  REVENUECAT_WEBHOOK_AUTHORIZATION="Bearer YOUR_RANDOM_SECRET" \
  PREMIUM_ENTITLEMENT_ID="athlete_arena_pro"

# Optional: enable HMAC signing in RevenueCat and set the signing secret too
# supabase secrets set REVENUECAT_WEBHOOK_SIGNING_SECRET="your_signing_secret"

supabase functions deploy revenuecat-webhook --no-verify-jwt
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in hosted Edge Functions.

Function URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook
```

## 3. Configure RevenueCat

In [RevenueCat](https://app.revenuecat.com) → **Integrations → Webhooks → Add**:

| Setting | Value |
|---------|--------|
| URL | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook` |
| Authorization header | Same value as `REVENUECAT_WEBHOOK_AUTHORIZATION` (e.g. `Bearer abc123…`) |
| Environment | **Sandbox + Production** (enable both while testing) |
| App | Athlete Arena iOS (or all apps in project) |
| Events | Subscription lifecycle events (default set is fine) |

Optional: enable **HMAC signature** on the integration and copy the signing secret into `REVENUECAT_WEBHOOK_SIGNING_SECRET`.

Send a **Test webhook** from RevenueCat to confirm `200` responses.

## 4. Event handling

| Event | `user_subscriptions.status` |
|-------|----------------------------|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`, … | `active` + `expires_at` |
| `CANCELLATION` | `active` until `expiration_at_ms` (access until period ends) |
| `EXPIRATION` | `expired` |
| `TRANSFER` | Grant destination user, expire source profile UUIDs |

Only events whose `entitlement_ids` include **`athlete_arena_pro`** are applied (must match `PREMIUM_ENTITLEMENT_ID` in the app).

Anonymous RevenueCat ids (`$RCAnonymousID:…`) are ignored — users must be logged into Supabase before purchasing (the app calls `identifyRevenueCatUser`).

## 5. Backfill an existing sandbox purchase

After connecting the webhook, either:

1. **RevenueCat dashboard** → Customer → open the user → resend / replay the purchase event if available, or use **Send test webhook**, or
2. **Manual SQL** (one-time):

```sql
insert into user_subscriptions (user_id, status, provider, expires_at)
values (
  'YOUR_SUPABASE_USER_UUID',
  'active',
  'revenuecat',
  '2099-01-01'::timestamptz
)
on conflict (user_id) do update
  set status = 'active', provider = 'revenuecat', expires_at = excluded.expires_at;
```

Future renewals and expirations will then flow through the webhook automatically.

## 6. Verify

1. Complete a sandbox purchase while logged in
2. Check **Supabase → Table Editor → `user_subscriptions`**
3. Confirm **Edge Functions → revenuecat-webhook → Logs** show `ok: true`
4. Create a custom workout in the app (server RPC should succeed)

## Client restore sync

After **Restore purchases** on the Membership screen (or when the app detects RevenueCat premium without a Supabase row), the app calls `sync_my_revenuecat_subscription` to upsert `user_subscriptions` immediately. The webhook still handles renewals and expirations long-term.

Apply migration `068_sync_my_revenuecat_subscription.sql` for this RPC.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | Authorization header in RevenueCat must **exactly** match `REVENUECAT_WEBHOOK_AUTHORIZATION` |
| `non_profile_app_user_id` | Purchase happened before login — restore purchases after login, or re-test |
| No row in `user_subscriptions` | Entitlement id mismatch — products must grant `athlete_arena_pro` |
| Duplicate events skipped | Expected — idempotency is working |
