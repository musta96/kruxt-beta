# KRUXT — Active Lane Split (Claude ⇄ Codex)

_Live coordination. Update when a lane changes owner. Goal: never edit the same file in parallel._

## Current owners (as of this session)

| Lane | Owner | Paths (exclusive) |
|---|---|---|
| **Mobile B2C** | **Claude** | `apps/mobile/**` |
| **Web member app** | **Codex** | `apps/web/**` |
| **Platform super-admin** | **Codex** | `apps/platform/**` |
| **Admin staff/RBAC** | **Codex** | `apps/admin/src/app/(dashboard)/staff/**`, `apps/admin/src/components/staff-permission-matrix.tsx` |
| **DB migrations** | **Codex** | `packages/db/supabase/migrations/**` (append-only) |

## Rules
1. **Stay inside your lane's paths.** If you must touch another lane's file, post in chat first.
2. **Shared files needing a heads-up before editing:** `packages/types/**`, `packages/ui/**`, any `services/index.ts`, app `sidebar.tsx`. Add-only; never rename/delete another agent's exports.
3. **Branch naming:** Claude → `claude/<slug>`, Codex → `codex/<slug>`. One PR per lane per push.
4. **Commit only your lane's files.** When the working tree has the other agent's WIP, `git add` only your paths — never `git add -A`.
5. **Migrations are append-only.** Filename `YYYYMMDDHHMM_<slug>.sql`. Never edit a merged migration.
6. Build must pass for the touched app before pushing.

## Claude's current task
`apps/mobile/` — rebuild **Proof Feed** as a full-bleed vertical-paged (TikTok-style) feed.
- Reuses existing `phase4-proof-feed-ui` flow + `FeedService`/`SocialService` (NO service edits).
- No new deps (plain `FlatList` paging + `Dimensions`).
- Next mobile steps after this: Workout Logger → post-proof → Guild Hall (coordinate: PR #42 touches GuildHall split-view — Claude will rebase/avoid).

## Codex's current WIP (uncommitted in tree — do not let Claude stage)
`apps/web/**` public screens (Integrations/Library/Plan/Privacy/Support + lib), `apps/admin/staff` + permission matrix, platform `tenants/page.tsx`, two `20260531_*` staff-role migrations.
