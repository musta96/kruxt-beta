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
