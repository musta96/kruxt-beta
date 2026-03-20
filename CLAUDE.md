# CLAUDE.md

Project configuration for Claude Code sessions.

## Project

KRUXT Beta -- social-first fitness platform. B2C workout tracking with gamification, B2B gym operations dashboard.

## Tech Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm 10.6.5 + Turbo 2.4.4 |
| Mobile | React Native + Expo (Expo Router) -- iOS-first |
| Admin | Next.js (App Router) + Tailwind + shadcn/ui |
| Backend | Supabase (Postgres 17, Auth, RLS, Edge Functions) |
| State | Zustand (client state) + React Context (auth/theme) |
| Shared packages | `@kruxt/types`, `@kruxt/ui`, `@kruxt/db` |

## Commands

```bash
pnpm install              # install deps (pnpm only -- never use npm/yarn)
pnpm build                # build all packages
pnpm lint                 # lint all packages
pnpm typecheck            # typecheck all packages
pnpm test                 # run tests
pnpm db:test              # RLS smoke tests
./scripts/bootstrap.sh    # sync migrations + push to Supabase
./scripts/deploy_functions.sh  # deploy edge functions

# Regenerate DB types after migration changes
supabase gen types typescript --local > packages/types/src/database.ts
```

## Repository Layout

```
apps/mobile/**    # React Native / Expo mobile app
apps/admin/**     # Next.js admin dashboard
packages/types/   # @kruxt/types -- shared TS types, feature flags (14 keys)
packages/ui/      # @kruxt/ui -- design tokens + components
packages/db/      # @kruxt/db -- migrations + tests
supabase/         # Supabase config, migrations, edge functions
scripts/          # Bootstrap and deploy scripts
```

Never scaffold root-level app files. Mobile code goes under `apps/mobile/`, admin under `apps/admin/`.

## Architecture Conventions

- **Services** encapsulate Supabase calls; map snake_case DB rows to camelCase TS.
- **Flows** orchestrate services and manage screen state.
- **Feature flags** control rollout (14 keys defined in `@kruxt/types/flags`).
- **RLS** enforces authorization at the DB level.
- **Error handling:** `KruxtAppError` with typed error codes.
- **Legal/consent gates** required before protected mutations.
- **Singleton Supabase client** per app, provided via context -- never created per-flow.
- **DB types** generated from `database.ts` for type-safe queries.
- Every screen must handle: loading, empty, error, retry, success states.

## Design System

- Dark theme default (mobile), light theme default (admin). Both support dark/light/system-follow toggle.
- Accent: ion blue `#35D0FF`
- Base: charcoal `#0E1116`, surface `#171C24`, panel `#1D2430`
- Typography: Oswald (headlines), Sora (body), Roboto Mono (numbers)
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32
- Brand voice: "No log, no legend." -- earned, direct, proof-first

## Navigation

**Mobile** -- 5 bottom tabs: Proof Feed, Log, Guild Hall, Rank Ladder, Profile

**Admin** -- Sidebar: Overview, Members, Classes, Check-ins, Waivers, Billing, Integrations, Compliance, Support, Settings

## Accessibility

Dynamic Type support, AA contrast minimum, keyboard focus management, screen-reader labels on all interactive elements.
