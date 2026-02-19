# Phase 7 Runtime Implementation

Phase 7 runtime now includes the Rank Ladder + Trials execution layer:

- Mobile competition service for challenges and leaderboard reads
- Atomic challenge RPCs for join/leave/progress submissions
- Deterministic leaderboard rebuild logic with anti-cheat filters
- Weekly recompute edge function with per-board failure reporting

## Mobile entrypoints

- `apps/mobile/src/services/competition-service.ts`
- `apps/mobile/src/flows/phase7-rank-trials.ts`
- `apps/mobile/src/app.tsx`

Core methods:

- `CompetitionService.listChallenges(...)`
- `CompetitionService.joinChallenge(...)`
- `CompetitionService.leaveChallenge(...)`
- `CompetitionService.submitChallengeProgress(...)`
- `CompetitionService.listLeaderboards(...)`
- `CompetitionService.listLeaderboardEntries(...)`
- `CompetitionService.rebuildLeaderboard(...)`

## SQL / RPC hooks

- `public.rebuild_leaderboard_scope(uuid)` (hardened, deterministic ordering)
- `public.join_challenge(uuid)`
- `public.leave_challenge(uuid)`
- `public.submit_challenge_progress(uuid, numeric, boolean)`

## Edge function behavior

- `supabase/functions/rank_recompute_weekly/index.ts`
  - defaults to weekly boards
  - supports optional body filters (`timeframe`, `leaderboardIds`, `limit`)
  - returns `rebuiltCount` and `failures` for deterministic job monitoring

## DB migration hooks

- `packages/db/supabase/migrations/202602190382_krux_beta_part3_s041.sql`
- `packages/db/supabase/migrations/202602190383_krux_beta_part3_s042.sql`
- `packages/db/supabase/migrations/202602190384_krux_beta_part3_s043.sql`
- `packages/db/supabase/migrations/202602190385_krux_beta_part3_s044.sql`
- `packages/db/supabase/migrations/202602190386_krux_beta_part3_s045.sql`
- `packages/db/supabase/migrations/202602190387_krux_beta_part3_s046.sql`
- `packages/db/supabase/migrations/202602190388_krux_beta_part3_s047.sql`
- `packages/db/supabase/migrations/202602190389_krux_beta_part3_s048.sql`
- `packages/db/supabase/migrations/202602190390_krux_beta_part3_s049.sql`
- `packages/db/supabase/migrations/202602190391_krux_beta_part3_s050.sql`
- `packages/db/supabase/migrations/202602190392_krux_beta_part3_s051.sql`
- `packages/db/supabase/migrations/202602190393_krux_beta_part3_s052.sql`
