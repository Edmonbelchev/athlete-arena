# Athlete Arena

Daily fitness missions with camera-based rep counting, XP progression, social challenges, and a coin economy. Built with Expo SDK 57, React Native, and Supabase.

## Features

### Workouts & pose detection

- **Daily missions** — tiered rep targets across four exercises (push-ups, squats, pull-ups, burpees)
- **Automatic rep counting** via MediaPipe Pose Landmarker (web CDN or native Vision Camera)
- **Friend challenges** — custom rep targets, optional timers, and speed races
- **Personal goals** — daily and weekly activity targets
- **Challenge history** — past daily and friend workout results

### Progression & rewards

- XP, progressive levels, daily streaks, and weekly mission streaks
- **Achievements** with unlock celebrations
- **Coin shop** — emotes and profile cosmetics
- **Daily spin wheel** — weighted coin rewards and a 2× coin multiplier buff
- **Leaderboard** — weekly and all-time XP rankings

### Social & account

- Email auth with confirmation and password reset deep links
- Friends, friend requests, and public friend profiles
- In-app notification inbox plus optional push notifications (friend requests and races)
- Profile editing (display name, avatar), stats, settings, and support tickets
- Onboarding flow and light/dark theme

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set your Supabase and Expo values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for push token registration (see supabase/PUSH_NOTIFICATIONS.md)
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

Restart Metro after changing `.env`.

### 3. Set up Supabase

**Recommended — apply all migrations with the Supabase CLI:**

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Your project ref is the subdomain in your Supabase URL (`https://YOUR_PROJECT_REF.supabase.co`).

**Alternative — SQL Editor bootstrap:**

1. Run **`supabase/setup.sql`** for core tables and daily challenges
2. Apply additional migrations from **`supabase/migrations/`** as needed (friends, shop, leaderboard, spin wheel, goals, push notifications, etc.)

Verify with **`supabase/verify.sql`**. See **[supabase/README.md](./supabase/README.md)** for migration details, auth settings, and RPC reference.

### 4. Download the pose model (native builds)

Required for on-device pose detection in iOS/Android dev and production builds:

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

**Web** (auto rep counting works immediately):

```bash
npm run web
```

**Expo Go** (camera preview + manual simulate rep — no native pose):

```bash
npm start
```

**Development build** (full native pose detection):

```bash
# Install EAS CLI once: npm i -g eas-cli
eas login
eas build --profile development --platform ios   # or android

# Or build locally:
npm run prebuild
npm run ios       # requires Xcode
npm run android
```

## Platform matrix

| Platform | Auth & backend | Auto rep counting |
|----------|----------------|-------------------|
| Web | Yes | Yes (MediaPipe CDN) |
| Expo Go | Yes | Manual simulate only |
| Dev / prod build | Yes | Yes (Vision Camera + MediaPipe) |

## Push notifications (TestFlight / production)

Remote push for friend requests and speed races uses Expo Push + Supabase Edge Functions. See **[supabase/PUSH_NOTIFICATIONS.md](./supabase/PUSH_NOTIFICATIONS.md)** for APNs credentials, migration `039`, edge function deploy, and webhook setup.

Push does not work in Expo Go. After changing push config, create a **new iOS build** for TestFlight:

```bash
eas build --profile production --platform ios
```

## Project structure

```
src/
  app/              Expo Router screens (tabs, auth, challenges, profile)
  components/       UI, camera previews, pose overlays
  features/         Auth, challenges, pose engines, friends, shop, goals, …
  services/         Supabase RPC wrappers
  lib/              Supabase client, env, MediaPipe web loader
  constants/        Exercise config, pose thresholds, rewards
supabase/
  migrations/       SQL migrations (001–047)
  setup.sql         Bootstrap script for SQL Editor
assets/models/      MediaPipe .task model (native builds)
```

## Pose detection tuning

Thresholds live in **`src/constants/poseDetection.ts`**:

- Push-up and pull-up elbow angles (up / down / hysteresis)
- Squat knee angles
- Burpee phase detection
- Minimum landmark visibility
- Hold frames before rep completion

Rep engines are in **`src/features/challenges/pose/`** (`createRepEngine.ts` dispatches by exercise type).

## EAS Build profiles

| Profile | Purpose |
|---------|---------|
| `development` | Dev client with native modules (pose detection) |
| `preview` | Internal testing |
| `production` | App Store / Play Store release |

Configure in [eas.json](./eas.json).

## Production checklist

- [ ] Apply full Supabase migration chain (`supabase db push` or run all migrations on prod)
- [ ] Configure auth email template + SMTP in Supabase Dashboard
- [ ] Set production env vars in EAS secrets (`EXPO_PUBLIC_SUPABASE_*`, `EXPO_PUBLIC_EAS_PROJECT_ID`)
- [ ] Deploy push notification edge functions and webhooks (see `supabase/PUSH_NOTIFICATIONS.md`)
- [ ] Test pose detection on real devices (lighting, distance, angles)
- [ ] Build with `eas build --profile production`

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run web` | Web dev server |
| `npm run ios` | iOS simulator (requires prebuild) |
| `npm run android` | Android emulator (requires prebuild) |
| `npm run prebuild` | Generate native iOS/Android projects |
| `npm run prebuild:clean` | Regenerate native projects from scratch |
| `npm run download:model` | Download MediaPipe pose model for native builds |
| `npm run lint` | ESLint |

## Tech stack

- Expo SDK 57, Expo Router, TypeScript, React 19, React Native New Architecture
- Supabase (auth, Postgres, RLS, RPCs, edge functions, realtime)
- MediaPipe Pose Landmarker (web CDN + native `.task` model)
- react-native-vision-camera (native dev and production builds)
- expo-notifications + EAS Push (optional remote notifications)
