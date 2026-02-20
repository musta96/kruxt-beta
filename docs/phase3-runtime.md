# Phase 3 Runtime Implementation

Phase 3 runtime now includes a concrete workout logging path that validates:

- `log_workout_atomic` inserts workout/exercise/set payloads atomically.
- Required legal consent gate before workout logging.
- Feed auto-post generation on workout insert.
- XP/level/chain progression update on workout insert.
- PR auto-detection and `pr_verified` feed event emission.

## Mobile entrypoints

- `apps/mobile/src/services/workout-service.ts`
- `apps/mobile/src/flows/phase3-workout-logging.ts`
- `apps/mobile/src/flows/phase3-workout-logger-ui.ts`

Core methods:

- `WorkoutService.logWorkoutAtomic(...)`
- `createPhase3WorkoutLoggingFlow().run(...)`
- `createPhase3WorkoutLoggerUiFlow().validate(...)`
- `createPhase3WorkoutLoggerUiFlow().submit(...)`

## DB migration hooks

- `packages/db/supabase/migrations/202602190351_krux_beta_part3_s010.sql`
- `packages/db/supabase/migrations/202602190353_krux_beta_part3_s012.sql`

These add the PR detection trigger pipeline for `public.workout_sets`.

## Wiring expectations

- Workout logger screens should use `createPhase3WorkoutLoggerUiFlow` for:
  - sub-60-second set/exercise interactions (`addExercise`, `addSet`, `removeSet`)
  - field-level validation before submit
  - post-submit verification of totals/feed/progress signals
- Runtime wiring details: `docs/phase3-workout-logger-ui-wiring.md`.
