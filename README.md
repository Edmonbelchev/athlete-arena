# Athlete Arena

Daily fitness challenges with pose-based rep counting, XP, streaks, friend races, and custom workouts. Built with Expo (SDK 57), React Native, and Supabase.

## Features

- **Auth** — Register / login with persistent sessions
- **Daily missions** — Three quests per day with rep accumulation, tiered targets, and one reroll per day
- **Pose rep counting** — MediaPipe pose detection for push-ups, squats, pull-ups, burpees
- **Friend challenges** — Custom rep races and timed speed races
- **Workouts**
  - **Official** — Arena catalog (e.g. Cindy AMRAP) with leaderboards ranked by rounds, then reps
  - **My library** — Premium users can create, save, and share custom AMRAP templates
- **XP, levels, streaks, coins, shop, achievements**
- **Leaderboards** — Global and friends (weekly + all-time)
- **System messages** — Global announcements via inbox + push
- **Push notifications** — Friend requests, races, shared workouts, system messages

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id

# RevenueCat public SDK keys (Project → API keys → App-specific keys)
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_ios_key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_your_android_key
```

See [.env.example](./.env.example) for the full list.

### 3. Set up Supabase

**Recommended** — apply all migrations with the CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Latest migrations include daily mission reroll (`059`), rep tiers (`060`), system messages (`061`), workout catalog + premium (`062`), Cindy AMRAP leaderboard (`063`), and workout share push URL fix (`064`).

For a fresh project you can still run `supabase/setup.sql` first, then `db push` for everything after the baseline. See [supabase/README.md](./supabase/README.md).

### 4. Download the pose model (native builds)

```bash
npm run download:model
```

Or manually:

```bash
mkdir -p assets/models
curl -L -o assets/models/pose_landmarker_lite.task \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
```

### 5. Run the app

```bash
npm start          # Expo Go
npm run web        # Web (full pose counting)
npm run ios        # Requires prebuild
npm run android
```

## Platform matrix

| Platform | Auth & challenges | Auto rep counting | In-app purchases |
|----------|-------------------|-------------------|------------------|
| Web | Yes | Yes (MediaPipe CDN) | No |
| Expo Go | Yes | Manual simulate only | No (requires dev build) |
| Dev / prod build | Yes | Yes (Vision Camera + MediaPipe) | Yes (RevenueCat) |

## Workouts

The **Workouts** tab is a hub with two sections:

| Section | Who | What |
|---------|-----|------|
| **Official workouts** | Everyone | Catalog workouts (Cindy AMRAP, etc.) with per-workout leaderboards |
| **My workouts** | Premium | Custom templates you create and share with friends |

**Cindy AMRAP** — 20 minutes, 5 pull-ups / 10 push-ups / 15 squats per round. Leaderboard ranks by completed rounds, then total reps when rounds tie.

Session history is always **per user** (your runs only, even on shared templates).

## Premium & RevenueCat

Premium unlocks custom workout **create**, **edit**, and **share**. The app uses [RevenueCat](https://www.revenuecat.com/) for mobile subscriptions (`react-native-purchases` + `react-native-purchases-ui`).

| Setting | Value |
|---------|-------|
| Entitlement | `premium` |
| Offering | `default` (must be **Current**) |
| iOS product IDs | `premium_monthly`, `premium_year` |
| Android product IDs | Same IDs (when Play Console is set up) |
| Bundle / package ID | `com.athletearena.app` |

### App integration

- **`RevenueCatBootstrap`** — configures the SDK and identifies users with their Supabase UUID
- **`PremiumProvider` / `usePremium()`** — merges RevenueCat entitlement status with Supabase `user_subscriptions` (manual grants still work)
- **Paywall** — `RevenueCatUI.presentPaywall()` opens the dashboard paywall attached to offering `default` (triggered from **My workouts → Create workout** when not premium)

Key files:

```
src/services/revenueCatService.ts
src/features/subscription/PremiumProvider.tsx
src/features/subscription/RevenueCatBootstrap.tsx
src/constants/subscription.ts
```

### Store & dashboard setup

**iOS (App Store Connect)**

1. Create subscriptions `premium_monthly` and `premium_year` in the same subscription group
2. Complete localization, pricing, and country availability
3. Sign the **Paid Apps Agreement** and complete Banking + Tax (required before StoreKit returns products)
4. In RevenueCat: connect the iOS app, upload the In-App Purchase Key, add App Store products, attach them to offering `default`, and publish a paywall

**Android (Google Play Console)** — generally simpler than iOS; defer until iOS is working:

1. Create matching subscription products in Play Console
2. Link a Google payments merchant profile
3. In RevenueCat: add the Android app, connect via service account JSON, add Play Store products to offering `default`

**RevenueCat offering `default`**

- Packages must reference **App Store / Play Store** products (not Test Store — Test Store does not work with the native `appl_` / `goog_` SDK keys)
- Both products must grant entitlement `premium`

### Local development

RevenueCat requires a **dev or production native build** — purchases do not work in Expo Go.

```bash
npx expo run:ios
# or
eas build --profile development --platform ios
```

Add the public SDK keys to `.env`, then restart Metro after changing env vars.

**iOS sandbox:** Settings → App Store → Sandbox Account (sandbox tester from App Store Connect).

### Test premium without IAP

While waiting on store agreements or for backend-only testing, grant premium manually in Supabase:

```sql
insert into user_subscriptions (user_id, status, provider, expires_at)
select id, 'active', 'manual', '2099-01-01'::timestamptz
from auth.users
where email = 'you@example.com'
on conflict (user_id) do update
  set status = 'active', provider = 'manual', expires_at = excluded.expires_at;
```

The client treats RevenueCat entitlement **or** an active Supabase row as premium. Server RPCs (`create_custom_workout_template`, etc.) still read **`user_subscriptions` only** — a RevenueCat webhook to sync purchases is planned for production.

### Seed demo Cindy sessions

To populate history and leaderboard UI for testing:

```sql
-- Paste and run supabase/seed_cindy_demo_sessions.sql in the SQL Editor
```

Seeds sample runs for `edmon.cekov@gmail.com` (and optional demo leaderboard users if they exist).

## System messages

Publish a global announcement (service role / SQL Editor):

```sql
select publish_system_message(
  'Title',
  'Short summary for inbox',
  'Full body shown on the detail screen.',
  true  -- send push
);
```

## Push notifications

Remote push uses Expo Push + Supabase Edge Functions. See **[supabase/PUSH_NOTIFICATIONS.md](./supabase/PUSH_NOTIFICATIONS.md)** for APNs credentials, migration `039`, edge function deploy, and webhook setup.

Shared workout pushes deep-link to `/(tabs)/workouts/library?templateId=...`.

After changing push config, create a **new iOS build** for TestFlight (`eas build --profile production --platform ios`).

## Project structure

```
src/
  app/              Expo Router screens (tabs, workouts hub, catalog detail)
  components/       UI, camera previews, workout cards
  features/         Auth, challenges, pose, premium, notifications
  services/         Supabase RPC wrappers, RevenueCat service
  constants/        Theme, pose thresholds, workout config
supabase/
  migrations/       Incremental SQL (001–064+)
  seed_*.sql        Optional dev seed scripts
assets/models/      MediaPipe .task model (native builds)
```

## Pose detection tuning

Thresholds live in `src/constants/poseDetection.ts`. Rep logic is in `src/features/challenges/pose/`.

## EAS Build profiles

| Profile | Purpose |
|---------|---------|
| `development` | Dev client with native modules |
| `preview` | Internal testing |
| `production` | App Store / Play Store |

Configure in [eas.json](./eas.json).

## Production checklist

- [ ] `npx supabase db push` on production project (through latest migration)
- [ ] Auth email template + SMTP in Supabase Dashboard
- [ ] Production env vars in EAS secrets (Supabase + RevenueCat SDK keys)
- [ ] App Store / Play subscriptions live; RevenueCat offering `default` current with store products
- [ ] RevenueCat webhook → Supabase `user_subscriptions` sync (server-side premium gates)
- [ ] Push notification edge function + webhook deployed
- [ ] Test pose detection on real devices
- [ ] `eas build --profile production`

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run web` | Web dev server |
| `npm run ios` | iOS simulator (requires prebuild) |
| `npm run android` | Android emulator (requires prebuild) |
| `npm run lint` | ESLint |
| `npm run download:model` | Fetch MediaPipe pose model |

## Tech stack

- Expo SDK 57, Expo Router, TypeScript
- Supabase (auth, Postgres, RLS, RPCs, Realtime)
- MediaPipe Pose Landmarker (web CDN + native dev build)
- react-native-vision-camera (native dev builds)
- RevenueCat (`react-native-purchases`, `react-native-purchases-ui`)
