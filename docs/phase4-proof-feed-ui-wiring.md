# Phase 4 Proof Feed UI Wiring

Use `createPhase4ProofFeedUiFlow` as the single controller for Proof Feed interactions.

## Screen sequence

1. Load feed cards
2. Render reaction/comment controls
3. Apply moderation actions (block/report)
4. Refresh and reconcile feed state

## Runtime contract

- `load(userId?)` -> `{ ok: true, snapshot }` or `{ ok: false, error }`
- `loadWorkoutThread(workoutId, userId?)`
- `reactToWorkout(workoutId, reactionType|null, userId?)`
- `commentOnWorkout(workoutId, commentText, { parentInteractionId?, userId? })`
- `blockActor(blockedUserId, reason?, userId?)`
- `unblockActor(blockedUserId, userId?)`
- `reportContent(input, userId?)`

All mutation methods return a refreshed feed snapshot.

## Feed safety behavior

- Feed snapshot is filtered to remove blocked actor IDs.
- Interaction threads are filtered to remove blocked actor interactions.
- `hiddenBlockedActorCount` is included for telemetry/debug visibility.

## Acceptance mapping

- Feed renders only visible workouts after RLS + local blocked-actor filtering.
- Reactions/comments persist and UI refreshes from server-backed state.
- Blocking an actor removes their content from refreshed feed snapshot.
- Reporting content creates moderation records via `user_reports`.
