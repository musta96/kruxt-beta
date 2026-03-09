# KRUXT Mobile Native Port Plan

## Current state
`apps/mobile` now has a real Expo-native baseline.

What exists today:
- Expo runtime config
- native entrypoint
- bottom-tab navigation
- native auth landing shell
- native member feed/log/profile screens
- Supabase session persistence for React Native
- native invite acceptance via deep-link token
- native avatar upload/remove
- native minimal workout submit
- EAS config for internal/production profiles

What still does not exist yet:
- full onboarding flow in native UI
- full multi-block workout submit flow
- native proof/social interactions
- TestFlight/App Store release assets and review package

This means the package is now structurally correct for native delivery, but it is not yet feature-complete for App Store release.

## Correct next move
Port the current mobile flows into a true Expo app while keeping the Supabase contracts and business logic.

## Delivery sequence

### Phase 1: Native bootstrap
- Create Expo app shell inside `apps/mobile`
- Add `app.json` / `eas.json`
- Add native entrypoint and navigation container
- Wire Supabase env handling for Expo

Status: complete

### Phase 2: Auth + onboarding
- Port welcome/auth/profile/gym/consent flow to React Native components
- Support deep links for auth and invite acceptance
- Validate session persistence on iOS

Status:
- auth landing: complete
- invite deep-link acceptance: complete
- full onboarding UI: pending

### Phase 3: Member core
- Port feed shell
- Port logging flow
- Port profile/settings
- Add native avatar upload

Status:
- feed baseline: complete
- minimal real logger submit: complete
- profile/settings shell: complete
- avatar upload: complete
- full logger UX: pending

### Phase 4: Distribution
- Configure EAS build profiles
- Build internal iOS artifact
- Ship to TestFlight
- Prepare App Store metadata, privacy labels, screenshots, and review notes

## Technical constraint
Do not pretend the current `apps/mobile` code can go straight to App Store packaging. It cannot. The UI layer must be ported from DOM-based React to React Native first.

## Recommended implementation rule
- Reuse Supabase service logic where possible
- Rebuild presentation layer in React Native
- Keep founder and org backoffice on web
- Keep the mobile app focused on member-facing use cases

## Immediate next engineering task
Finish native production hardening:
1. full onboarding UI
2. full proof/social UI
3. multi-block logger UI
4. TestFlight build and device QA
