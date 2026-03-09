# KRUXT Mobile Runbook

## What exists now
`apps/mobile` is now a real Expo-native package with:
- Expo entrypoint
- tab navigation
- native auth landing flow
- native member shells for feed, log, and profile
- Supabase session persistence via AsyncStorage
- EAS config for internal and production builds

## Local prerequisites
- Node `20` or newer
- Xcode for iOS simulator builds
- Expo Go or a dev client for device testing

Use the repo root `.nvmrc`:

```bash
nvm use
```

## Required env vars
Set these before running Expo:

```bash
export EXPO_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
export EXPO_PUBLIC_APP_WEB_URL="https://kruxt-foundation-kit.vercel.app"
```

## Local commands
From the repo root:

```bash
npm run mobile:dev
npm run mobile:ios
npm run mobile:android
npm run mobile:typecheck
```

Or directly:

```bash
cd apps/mobile
npm install
npx expo start
```

## EAS build
Login once:

```bash
npx eas login
```

Then from `apps/mobile`:

```bash
npx eas build --platform ios --profile preview
```

## Current scope
Native mobile is currently member-first:
- auth landing
- feed shell
- log flow shell
- profile/settings shell

Founder and organization operations remain on web:
- founder -> `/admin`
- gym staff -> `/org`

## Next native slice
1. Deep-link auth and invite acceptance
2. Native avatar upload
3. Real workout submit flow
4. TestFlight distribution
