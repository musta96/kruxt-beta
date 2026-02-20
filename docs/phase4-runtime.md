# Phase 4 Runtime Implementation

Phase 4 runtime now includes mobile service-layer logic for:

- Social graph operations (follow requests, accept/block, moderation actions)
- Feed ranking v1 (recency + engagement + relationship + gym affinity + flag boost)
- Reactions/comments interaction mutations
- Notification preferences and push token registration management

## Mobile entrypoints

- `apps/mobile/src/services/social-service.ts`
- `apps/mobile/src/services/feed-service.ts`
- `apps/mobile/src/services/notification-service.ts`
- `apps/mobile/src/flows/phase4-social-feed.ts`
- `apps/mobile/src/flows/phase4-proof-feed-ui.ts`

Core methods:

- `SocialService.requestFollow(...)`
- `SocialService.respondToFollowRequest(...)`
- `SocialService.addReaction(...)`
- `SocialService.addComment(...)`
- `SocialService.blockUser(...)`
- `SocialService.createReport(...)`
- `FeedService.listHomeFeed(...)`
- `NotificationService.getPreferences(...)`
- `NotificationService.registerPushToken(...)`
- `createPhase4ProofFeedUiFlow().reactToWorkout(...)`
- `createPhase4ProofFeedUiFlow().commentOnWorkout(...)`
- `createPhase4ProofFeedUiFlow().blockActor(...)`
- `createPhase4ProofFeedUiFlow().reportContent(...)`

## DB migration hooks

- `packages/db/supabase/migrations/202602190355_krux_beta_part3_s014.sql`
- `packages/db/supabase/migrations/202602190360_krux_beta_part3_s019.sql`
- `packages/db/supabase/migrations/202602190361_krux_beta_part3_s020.sql`

These add `public.push_notification_tokens` with strict self-owned RLS.

## Wiring expectations

- Proof Feed screens should use `createPhase4ProofFeedUiFlow` for:
  - stateful feed loading with blocked-actor filtering
  - reaction/comment mutations that return refreshed snapshots
  - moderation actions (`block`, `report`) with persisted records
- Runtime wiring details: `docs/phase4-proof-feed-ui-wiring.md`.
