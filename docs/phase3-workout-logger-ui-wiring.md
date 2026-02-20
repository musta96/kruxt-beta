# Phase 3 WorkoutLogger UI Wiring

Use `createPhase3WorkoutLoggerUiFlow` as the controller for WorkoutLogger screens.

## Screen sequence

1. `metadata` (title, type, notes, visibility)
2. `exercise_blocks` (exercise selection + ordering)
3. `sets` (reps/weight/RPE, optional duration/distance)
4. `review`
5. submit and confirm proof/progress signals

## Runtime contract

- `createDraft(overrides?)`
- `addExercise(draft)` / `removeExercise(draft, index)`
- `addSet(draft, exerciseIndex)` / `removeSet(draft, exerciseIndex, setIndex)`
- `validate(draft)` returns field-level errors
- `submit(draft)` returns:
  - success: `{ ok: true, result, verification }`
  - failure: `{ ok: false, error }`

## Verification guarantees on submit

`submit` verifies these acceptance signals before returning success:

- `totalsUpdated`: `workout.totalSets > 0`
- `proofEventCreated`: at least one `workout_logged` feed event exists
- `progressUpdated`: `lastWorkoutAt` is present and `chainDays > 0`

If one signal is missing, submit returns a recoverable failure with code `WORKOUT_LOGGER_SIGNALS_INCOMPLETE`.

## Error handling model

Error shape:

- `code`
- `step` (`metadata`, `exercise_blocks`, `sets`, `review`)
- `message`
- `recoverable`
- `fieldErrors`

Recommended UX behavior:

- For validation failures, focus first invalid field and keep user on the mapped step.
- For `RECONSENT_REQUIRED`, route to consent update flow before retrying submit.
- For recoverable review-step errors, keep draft state and allow one-tap retry.
