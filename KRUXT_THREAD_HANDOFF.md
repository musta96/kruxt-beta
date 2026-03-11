# KRUXT Fresh-Thread Handoff

## Why this handoff exists

- The previous Codex thread, `Plan KRUXT MVP phases`, started failing on March 11, 2026 with `413 Payload Too Large` during remote compaction.
- The local Codex session log for that thread grew to about `1.0 GB`.
- Continue KRUXT work in a fresh thread. Do not keep using the old thread for active work.

## Clean continuation environment

- Worktree: `/private/tmp/kruxt-mvp-continuation`
- Branch: `codex/kruxt-continuation`
- Base commit: `3b4dfe4` (`Harden Supabase function calls and exercise search`)
- Original branch remains available at: `codex/lovable-main-sync`

## Project summary

KRUXT is a social-first fitness platform that combines:

- B2C workout tracking
- gamification, rank, streaks, challenges, and social proof
- B2B gym operations such as memberships, classes, waitlists, waivers, and staff/admin workflows

Current repo baseline:

- Backend: Supabase with Postgres, Auth, RLS, Edge Functions
- Active-first integrations: Apple Health + Garmin
- Other providers: modeled but feature-flagged off
- Compliance baseline: US + EU
- Payments: schema-ready, activation deferred

## Product direction from prior work

The strongest product direction from the prior thread was:

- `Home`: social feed, streaks, challenges, today summary
- `Plan`: structured weekly training plan, current day, rearrange week, coach notes
- `Record`: quick log, guided workout execution, free workout, class check-in
- `Groups`: clubs, gym groups, challenges, crews
- `You`: progress, stats, activities, badges, settings

Reference pattern mapping discussed in the old thread:

- Strava -> social feed, groups, identity, activity detail
- Ladder -> workout execution UX, program-led strength flow
- Runna -> plan layer, weekly scheduling, progression, integrations

Core takeaway:

- KRUXT needs a real `Plan` layer, not only ad hoc workout logging or templates.

## Repo layout

- `apps/mobile`: member-facing mobile app scaffold
- `apps/admin`: gym management/admin app scaffold
- `apps/web`: web app surface
- `packages/ui`: shared tokens and UI primitives
- `packages/types`: shared TypeScript contracts
- `packages/db`: Supabase migrations, seeds, smoke tests
- `supabase/functions`: Edge Functions

## Runtime references already in repo

The README already points to implemented/runtime areas:

- Phase 2: onboarding + guild hall + staff console
- Phase 3: workout logging
- Phase 4: social feed + notifications
- Phase 5: B2B ops
- Phase 6+: integrations, leaderboards, compliance, rollout, support foundations

Start with:

- `README.md`
- `docs/`
- `apps/mobile/src/flows`
- `apps/admin/src/flows`
- `packages/db/supabase/migrations`

## Recent repo state

Latest commits at handoff time:

- `3b4dfe4` Harden Supabase function calls and exercise search
- `2cad8cb` Build workout templates and HYROX logger
- `65ddbb7` Add workout proof media upload baseline
- `144e3ed` Add live feed reactions and comments
- `67c4f92` Build live web guild and rank screens

## Useful commands

- Install deps: `pnpm install`
- Full checks: `pnpm lint && pnpm typecheck && pnpm test`
- DB smoke tests: `pnpm db:test`
- Web dev: `pnpm dev`
- Mobile typecheck: `pnpm mobile:typecheck`

## Recommended prompt for the new Codex thread

Use something like this in a fresh thread:

> We are continuing KRUXT from `/private/tmp/kruxt-mvp-continuation` on branch `codex/kruxt-continuation`.
> The previous Codex thread became unusable due to a 413 compact error, so do not rely on that thread history.
> Read `KRUXT_THREAD_HANDOFF.md`, `README.md`, and the relevant `docs/` files first.
> Then help me continue KRUXT by [insert exact feature / surface / planning task here].
> Keep context tight and avoid large pasted payloads or large screenshot batches.

## Operating rule for the new thread

- Keep inputs compact.
- Avoid pasting huge code files unless strictly necessary.
- Prefer referencing file paths over pasting entire source files.
- If screenshots are needed, send only the minimal set for the decision at hand.
