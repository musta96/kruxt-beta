# KRUXT Beta Monorepo

KRUXT beta platform: social fitness + gym ops (B2C/B2B) built with Supabase.

KRUXT is a social-first fitness platform with B2C workout tracking, gamification, and B2B gym operations.

## Workspace layout

- `apps/mobile`: iOS-first mobile app scaffold (React Native/Expo target)
- `apps/admin`: gym management web app scaffold (Next.js target)
- `packages/ui`: shared design tokens and UI primitives
- `packages/types`: shared TypeScript contracts for events/flags/API payloads
- `packages/db`: Supabase migrations, seed data, and SQL smoke tests
- `supabase/functions`: edge function entrypoints

## Key decisions

- Backend: Supabase (Postgres, Auth, RLS, Edge Functions)
- Integrations active first: Apple Health + Garmin
- Other providers: modeled and disabled behind feature flags
- Payments: schema-ready, billing activation deferred
- Compliance baseline: US + EU (consents, privacy requests, policy versions, audit logs)

## Quick start

1. Install deps: `pnpm install`
2. Run checks: `pnpm lint && pnpm typecheck && pnpm test`
3. Review DB migrations: `packages/db/supabase/migrations/`
4. Apply schema + seed with Supabase CLI:
   - `./scripts/bootstrap.sh`
   - This syncs SQL into `supabase/migrations` and `supabase/seed.sql`, then runs `supabase db push --include-seed`.
5. Deploy edge functions:
   - `./scripts/deploy_functions.sh`

## Important

The SQL migration is designed to be future-proof and includes strict RLS defaults.
Operational features are controlled by flags in `public.feature_flags`.

## Phase 2 Runtime

- Mobile onboarding + guild hall flows: `apps/mobile/src/services`, `apps/mobile/src/flows`
- Admin staff ops services + flows: `apps/admin/src/services`, `apps/admin/src/flows`
- Usage notes: `docs/phase2-runtime.md`

## Phase 3 Runtime

- Workout logging service + flow: `apps/mobile/src/services/workout-service.ts`, `apps/mobile/src/flows/phase3-workout-logging.ts`
- PR auto-detection trigger migration: `packages/db/supabase/migrations/202602190351_krux_beta_part3_s010.sql`
- Usage notes: `docs/phase3-runtime.md`

## Phase 4 Runtime

- Social/feed/notification services: `apps/mobile/src/services/social-service.ts`, `apps/mobile/src/services/feed-service.ts`, `apps/mobile/src/services/notification-service.ts`
- Social feed flow: `apps/mobile/src/flows/phase4-social-feed.ts`
- Push token schema + RLS migration set starts at: `packages/db/supabase/migrations/202602190355_krux_beta_part3_s014.sql`
- Usage notes: `docs/phase4-runtime.md`

## Phase 5 Runtime

- B2B admin ops service: `apps/admin/src/services/b2b-ops-service.ts`
- B2B ops flow snapshot: `apps/admin/src/flows/phase5-b2b-ops.ts`
- Staff acceptance RPC migration set starts at: `packages/db/supabase/migrations/202602190364_krux_beta_part3_s023.sql`
- Usage notes: `docs/phase5-runtime.md`
