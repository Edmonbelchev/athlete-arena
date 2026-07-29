# Exercise Challenger

Daily fitness challenges with pose-based rep counting, XP, streaks, and profiles. Built with Expo (SDK 57), React Native, and Supabase.

## Features

- Register / login with persistent sessions
- One random daily challenge (push-ups or squats)
- Automatic rep counting via MediaPipe pose detection
- XP, levels, and streak tracking
- Profile stats and editable display name

## Quick start

### 1. Install dependencies

```bash
cd exercise-challenger
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set your Supabase project values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up Supabase

In the [Supabase SQL Editor](https://supabase.com/dashboard), run:

1. **`supabase/setup.sql`** - core tables and daily challenges
2. **`supabase/migrations/004_friends.sql`** - friends + custom friend challenges
3. **`supabase/migrations/005_friend_challenge_timer.sql`** - optional timed friend challenges

Verify with `supabase/verify.sql`. See [supabase/README.md](./supabase/README.md) for details.

### 4. Download the pose model (native builds)

Required for on-device pose detection in iOS/Android dev builds:

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

**Expo Go** (camera preview + manual simulate rep - no native pose):

```bash
npm start
```

**Development build** (full native pose detection):

```bash
# Install EAS CLI once: npm i -g eas-cli
eas login
eas build --profile development --platform ios   # or android

# Or build locally:
npx expo prebuild
npx expo run:ios    # requires Xcode
npx expo run:android
```

## Platform matrix

| Platform | Auth & challenges | Auto rep counting |
|----------|-------------------|-------------------|
| Web | Yes | Yes (MediaPipe CDN) |
| Expo Go | Yes | Manual simulate only |
| Dev / prod build | Yes | Yes (Vision Camera + MediaPipe) |

## Project structure

```
src/
  app/              Expo Router screens
  components/       UI + camera previews
  features/         Auth, challenges, profile, pose engines
  lib/              Supabase, env, MediaPipe web loader
  services/         Supabase RPC wrappers
supabase/           SQL migrations and setup
assets/models/      MediaPipe .task model (native builds)
```

## Pose detection tuning

Thresholds live in `src/constants/poseDetection.ts`:

- Push-up elbow angles (up / down / hysteresis)
- Squat knee angles
- Minimum landmark visibility
- Hold frames before rep completion

Rep logic is in `src/features/challenges/pose/`.

## EAS Build profiles

| Profile | Purpose |
|---------|---------|
| `development` | Dev client with native modules (pose detection) |
| `preview` | Internal testing |
| `production` | App Store / Play Store release |

Configure in [eas.json](./eas.json).

## Production checklist

- [ ] Run `supabase/setup.sql` on production Supabase project
- [ ] Re-enable email confirmation in Supabase Auth settings
- [ ] Set production env vars in EAS secrets
- [ ] Test pose detection on real devices (lighting, distance, angles)
- [ ] Build with `eas build --profile production`

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run web` | Web dev server |
| `npm run ios` | iOS simulator (requires prebuild) |
| `npm run android` | Android emulator (requires prebuild) |
| `npm run lint` | ESLint |

## Tech stack

- Expo SDK 57, Expo Router, TypeScript
- Supabase (auth, Postgres, RLS, RPCs)
- MediaPipe Pose Landmarker (web CDN + native dev build)
- react-native-vision-camera (native dev builds)
