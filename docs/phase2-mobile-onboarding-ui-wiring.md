# Phase 2 Mobile Onboarding UI Wiring

Use `createPhase2OnboardingUiFlow` as the single controller for onboarding screens.

## Screen sequence

1. `auth`
2. `profile`
3. `consents`
4. `gym`
5. `review`
6. route to `guild_hall`

The controller exposes `screens` metadata so mobile UI can render titles/subtitles/action labels consistently.

## Runtime contract

- `validate(draft)`
  - returns field errors with step-aware field paths (for inline form error rendering)
- `submit(draft)`
  - returns `{ ok: true, result, nextRoute: "guild_hall" }` on success
  - returns `{ ok: false, error }` on failure
  - errors include: `step`, `code`, `message`, `recoverable`, `fieldErrors`

## Recoverable UX behavior

- If `error.recoverable = true`, keep user on `error.step` and show `error.message`.
- If `fieldErrors` exists, map field paths (for example `auth.email`, `consents.acceptTerms`) to inline form states.
- If `recoverable = false`, show blocking fallback with retry option and support contact.

## Guaranteed post-checks in service

`Phase2OnboardingService.run` now enforces:

- required baseline consents are persisted (`terms`, `privacy`, `health_data_processing`)
- requested home gym is actually persisted on `profiles.home_gym_id`

If either check fails, onboarding returns a recoverable failure to the UI controller.
