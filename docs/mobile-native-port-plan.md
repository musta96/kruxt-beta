# KRUXT Mobile Native Port Plan

## Current state
`apps/mobile` is not yet an Expo/React Native app.

What exists today:
- shared mobile business logic
- flow orchestration
- Supabase service layer
- web-style React screens using DOM elements and CSS classes

What does not exist yet:
- Expo runtime config
- React Native screen components
- navigation stack
- native auth redirect handling
- EAS build pipeline

This means the current package is not App Store-ready, even though the product logic is already modeled.

## Correct next move
Port the current mobile flows into a true Expo app while keeping the Supabase contracts and business logic.

## Delivery sequence

### Phase 1: Native bootstrap
- Create Expo app shell inside `apps/mobile`
- Add `app.json` / `eas.json`
- Add native entrypoint and navigation container
- Wire Supabase env handling for Expo

### Phase 2: Auth + onboarding
- Port welcome/auth/profile/gym/consent flow to React Native components
- Support deep links for auth and invite acceptance
- Validate session persistence on iOS

### Phase 3: Member core
- Port feed shell
- Port logging flow
- Port profile/settings and avatar upload

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
Create the Expo app shell and native navigation layer in `apps/mobile`, then port:
1. auth shell
2. feed shell
3. log shell
4. profile shell
