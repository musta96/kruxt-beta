# KRUXT — Coordination Plan & Roadmap

> **Read this before touching any code.** Shared between Edoardo, Claude, and Codex.
> Last updated: 2026-05-10

---

## 1. Vision recap

KRUXT is a **social-first fitness platform** with two halves:

- **B2C (mobile + public web) — THE social-feed product, this is the killer feature.**
  - **Proof Feed = TikTok-for-workouts**: vertical full-bleed scroll of workout proofs (video/photo + auto-overlaid lift stats), one card at a time, snappy gestures.
  - Workout logger writes a workout → user attaches proof media → posts to feed → gym-mates + followers react (`fist`/`fire`/`shield`/`clap`/`crown`) and comment.
  - Gamification: XP, levels 1–50, ranks, gym/global/exercise/challenge leaderboards, streaks.
  - Guild Hall = gym-scoped social home (members, leaderboards, current challenges, gym feed).
  - Rank Ladder = global + scoped leaderboards with timeframes (daily/weekly/monthly/all_time).
  - Follower system, profiles, reports for moderation.
  - Brand voice: _"No log, no legend"_ — proof-first, earned, direct.
  - **Strategic point**: gym ops (B2B) is the way to acquire users at scale; the social feed is what makes them stay. Treat Proof Feed quality as the #1 retention driver.

- **B2B (admin + platform)** — gym operations dashboard for owners/staff: member management, class scheduling, billing (subscriptions + manual cash/bank), check-ins, compliance/GDPR, branding customization, staff shifts, support tickets, integrations. Multi-tenant via `gym_id` everywhere with RLS. KRUXT itself **does not currently bill gyms** — they get it free while we grow the network. The platform super-admin's "billing" pages stay as scaffolds for a future monetization phase.

Stack: pnpm workspaces, Turborepo, Next.js (admin/platform/web), React Native + Expo (mobile), Supabase (Postgres 17, Auth, RLS, Edge Functions), Zustand + Context, shared `@kruxt/types` / `@kruxt/ui` / `@kruxt/db`.

Apps:
| App | Path | Port | Audience |
|---|---|---|---|
| Admin | `apps/admin/` | 3000 | Gym staff/owners |
| Platform | `apps/platform/` | 3100 | KRUXT super-admins |
| Web | `apps/web/` | 3200 | Public marketing + gym pages + join flow |
| Mobile | `apps/mobile/` | Expo | Members (B2C) |

---

## 2. What's already built (don't re-do this)

### ✅ Admin (`apps/admin/`) — wired end-to-end
- Auth (Supabase email/password, sign-in/up tabs, /forgot-password)
- Auto gym discovery (`GymProvider` joins `gym_memberships` → `gyms`)
- In-app gym onboarding form (`components/gym-onboarding-form.tsx`) — replaces SQL dance
- Auth gate in `(dashboard)/layout.tsx` — redirects unauthed → login, shows onboarding if no gym
- TopBar: real gym name + UUID + email-based avatar + sign-out dropdown
- 10 dashboard pages reading real Supabase data: Overview, Members, Classes, Check-ins, Billing, Waivers, Support, Integrations, Compliance, Settings
- New: **Staff** page (shifts management)
- CRUD modals: Add Member, Create Class, Pause/Reactivate/Approve, Cancel class
- BZone-Pavia demo seed (`services/seed-bzone.ts`) — plans + classes + waiver + billing settings

### ✅ Codex's uncommitted feature wave (≈3,400 LOC, NEEDS COMMIT)
- **No-UUID member adding** — Members page has profile search (`profileQuery` + `ProfileSearchResults`), select-by-name fills the UUID. Invite codes (`GymInviteCode`) generate shareable `/join?code=...` URLs.
- **Public web join flow** — `apps/web/app/join/page.tsx`, `apps/web/app/gyms/page.tsx`, `apps/web/src/lib/public/gyms.ts`.
- **Coach/PT assignment** — `gym_memberships.coach_user_id` (with FK + trigger validating coach is staff in same gym), `MemberWorkoutPlan` table with `plan_json` (draft/active/paused/completed/archived).
- **Join requests + auto-activation** — `gym_join_requests` table + `review_gym_join_request()` RPC creates membership + subscription + invoice atomically on approval.
- **Manual payments** — `record_manual_invoice_payment()` RPC for cash/bank-transfer, expanded billing page with payment recording UI.
- **Branding customization** — Settings page `BrandDraft` form: app display name, logo/icon/banner URLs, primary/accent/background/surface/text colors, launch message, support email, terms/privacy URLs. Backed by `customization.getGymBrandSettings()` / `upsertGymBrandSettings()`.
- **Light theme tokens** in `packages/ui/src/theme.ts` (dark + light, same accent).
- **New migrations** (in `packages/db/supabase/migrations/`):
  - `202605110001_member_coaching_and_workout_plans.sql`
  - `202605130001_join_request_subscription_activation.sql`
  - `202605130002_manual_invoice_payments.sql`

### ✅ Mobile + public web foundation
- Mobile screens scaffolded with Expo Router (5 tabs: Proof Feed, Log, Guild Hall, Rank Ladder, Profile). ProofFeed + WorkoutLogger have recent Codex updates.
- Web (`apps/web/`) has Guild/Profile/Member shells plus the new public gym/join pages.

### ✅ Platform super-admin (`apps/platform/`)
- Login, sidebar, top-bar, 10 placeholder pages on port 3100 with purple theme.

---

## 3. 🚨 IMMEDIATE: commit & merge the uncommitted Codex blob

**Currently uncommitted on `main`**: 36 files, +3415/−465. This MUST land before either agent touches members/settings/billing/staff/types again, or we'll merge-conflict ourselves into oblivion.

**Owner: Codex (since Codex wrote most of it and knows the test plan).**

Steps:
1. Verify `pnpm typecheck` + `pnpm build` pass at repo root
2. Split into logical commits if Codex prefers, OR squash:
   - feat(admin): member directory search + invite codes + coach assignment
   - feat(admin): branding customization in Settings
   - feat(admin): staff shifts page
   - feat(admin): manual invoice payments UI
   - feat(web): public gym pages + join request flow
   - feat(db): coaching + workout plans + join requests + manual payments migrations
   - feat(types): GymInviteCode, GymJoinRequest, MemberWorkoutPlan, branding settings
3. Open ONE PR per logical commit (easier review). Merge in order: types → db → admin → web.
4. Close PRs #42 #43 if their content is already in this blob — verify by diffing.

Claude will NOT touch any of those files until this lands.

---

## 4. Parallel work streams (post-merge)

We work on **disjoint files** to avoid conflicts. Each stream below lists the files it owns; nobody else edits those files mid-stream.

### Stream A — **Mobile B2C** (owner: Codex)
Goal: make the mobile app usable end-to-end.
Files:
- `apps/mobile/src/screens/WorkoutLoggerScreen.tsx`
- `apps/mobile/src/screens/ProofFeedScreen.tsx`
- `apps/mobile/src/screens/GuildHallScreen.tsx`
- `apps/mobile/src/screens/RankLadderScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/services/**` (mobile-only services)
- `apps/mobile/src/flows/**`
Deliverables:
- Workout Logger writes to `workouts` + `workout_blocks` + `workout_sets` + `workout_proof_media`.
- Proof Feed reads social feed (friends + gym scope).
- Guild Hall shows gym membership card + members + classes (read-only, joins via web join page).
- Rank Ladder reads `leaderboard_entries`.

### Stream B — **Workout-plans coaching UI on admin** (owner: Claude)
Goal: surface the coach-assignment + workout-plan tables Codex created so PTs can actually use them.
Files (all new, except member row):
- `apps/admin/src/app/(dashboard)/members/[memberId]/page.tsx` ← member detail page (NEW)
- `apps/admin/src/app/(dashboard)/coaching/page.tsx` ← coach dashboard listing _my members_ (NEW)
- `apps/admin/src/components/workout-plan-editor.tsx` ← JSON block editor (NEW)
- `apps/admin/src/components/member-detail-header.tsx` (NEW)
- `apps/admin/src/services/coaching-service.ts` ← new service wrapping `gym_member_workout_plans` (NEW)
- `apps/admin/src/services/index.ts` ← single-line export, coordinate before pushing
- `apps/admin/src/components/sidebar.tsx` ← single coordinated edit (add /coaching link)

### Stream C — **Branding live-preview + theme injection** (owner: Claude)
Goal: when a gym sets `primaryColor` etc., the admin (and member-facing pages) actually re-skin.
Files:
- `apps/admin/src/contexts/branding-context.tsx` (NEW)
- `apps/admin/src/components/brand-style-injector.tsx` (NEW — injects `--kruxt-accent`)
- `apps/admin/src/app/providers.tsx` ← coordinated single line
- `apps/web/app/gyms/[slug]/page.tsx` ← apply gym branding to public gym page (coordinate with Codex if web changes overlap)

### Stream D — **Logo + media uploads via Supabase Storage** (owner: Codex)
Goal: replace "paste an image URL" with a real file upload.
Files:
- `apps/admin/src/components/image-upload-field.tsx` (NEW)
- `apps/admin/src/services/storage-service.ts` (NEW)
- `apps/admin/src/app/(dashboard)/settings/page.tsx` ← coordinate before editing
- New Supabase Storage bucket `gym-branding` (public read, staff write) via migration.

### Stream E — **Seed data & demo polish** (owner: Claude)
Goal: BZone fully populated + a "load demo" button on Overview when stats are zero.
Files:
- `apps/admin/src/services/seed-bzone.ts` ← extend
- `apps/admin/src/app/(dashboard)/page.tsx` ← add demo CTA when classes.length === 0
- `apps/admin/src/components/demo-data-banner.tsx` (NEW)

### Stream F — **Platform super-admin wiring** (owner: Codex)
Files:
- `apps/platform/src/app/(dashboard)/**`
- `apps/platform/src/services/**`

### Stream G — **Deploy** (owner: Edoardo + Claude)
- Vercel projects for `apps/admin`, `apps/web`, `apps/platform` pointing at the same Supabase prod.
- Mobile via Expo EAS.

---

## 5. Coordination rules

1. **One PR per stream per day, max.** Never touch a file in two streams at once.
2. **Read this doc first.** If your change isn't in a stream above, add it as a new stream before coding.
3. **Branch naming**:
   - Claude: `claude/<stream-letter>-<short-slug>` (e.g. `claude/b-coaching-ui`)
   - Codex: `codex/<stream-letter>-<short-slug>`
   - Never both push to the same branch.
4. **Never edit `main` directly.** Even tiny fixes go through a PR.
5. **Before starting a stream**: pull `main`, confirm `git status` is clean. If dirty, STOP — finish the previous stream first.
6. **Files marked "coordinate" in §4** (sidebar, providers, services index, settings) — leave a comment in the active PR before editing, so the other agent knows to wait.
7. **Domain types (`packages/types/src/domain.ts`)**: add-only, never rename or delete existing exports. If a rename is needed, do it in its own dedicated PR with no other changes.
8. **Migrations are append-only**. Filename = `YYYYMMDDHHMM_<slug>.sql`. Never edit a merged migration.
9. **Build must pass locally before push**: `pnpm typecheck && pnpm build` in `apps/admin` (or whichever app you touched).
10. **If a stream blocks (waiting on another)**: write a comment in the PR + post in the shared chat — don't silently sit.

---

## 6. Backlog (after the streams above land)

Roughly in priority order:

- **Member detail subpages**: workouts history, attendance history, payment history, notes (Claude)
- **Class booking UI**: members book a class from the mobile app or web (Codex)
- **Waitlist auto-promotion** when bookings cancel (Codex)
- **Stripe Connect** for subscriptions (Claude — has the Invoice/Subscription tables already)
- **Email + push notifications** via Supabase Edge Functions (Codex)
- **GDPR self-service portal** (already has tables; just needs UI) (Claude)
- **Multi-language** support — Italian for BZone, English for the rest (either)
- **Mobile workout templates marketplace** (Codex)
- **Analytics dashboard** on Platform super-admin (Codex)
- **Public marketing site at `apps/web/`**: homepage, pricing, about (Edoardo decides design)

---

## 7. Quick reference

- Repo root: `/Users/edoardomustarelli/Documents/Personal 1 /.claude/worktrees/infallible-nobel/`
- Run admin: `cd apps/admin && pnpm dev` → http://localhost:3000
- Run platform: `cd apps/platform && pnpm dev` → http://localhost:3100
- Run web: `cd apps/web && pnpm dev` → http://localhost:3200 (check `package.json` for actual port)
- Supabase: https://supabase.com/dashboard/project/hgomsmhsybrxjdxbgkjy
- Owner auth in dev: `mustarelli.edoardo@gmail.com` / `Kruxt2026!`
- Owner gym: `iron-temple` (Iron Temple Fitness) — feel free to swap for `bzone-fitness` via Settings later.

### Common SQL helpers (dev only)

Manually confirm a user (when email confirmations are off but rows are stuck):
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = '<email>';
```

Manually set a password:
```sql
UPDATE auth.users
SET encrypted_password = crypt('<new-pass>', gen_salt('bf'))
WHERE email = '<email>';
```

Wipe a test gym (cascades cleanly):
```sql
DELETE FROM public.gyms WHERE slug = '<slug>';
```

---

## 8. Decisions (answered 2026-05-10 by Edoardo)

1. **Web public app port** — **3200**. Was 3000 (clashing with admin), now fixed in `apps/web/package.json`. Final port map: admin 3000, platform 3100, web 3200.
2. **Branding scope** — **Both admin chrome AND member-facing surfaces, with a toggle.** Implementation:
   - Per-gym setting `brand_applies_to_admin = true | false` (default `false`, gym-staff can opt in from Settings).
   - When `true`, `BrandStyleInjector` overrides the admin's `--kruxt-accent`, sidebar tint, etc.
   - When `false`, admin keeps the KRUXT dark/ion-blue chrome; only member surfaces (mobile gym scope + `apps/web/app/gyms/[slug]`) re-skin.
3. **KRUXT pricing model** — **None right now.** Gyms don't pay KRUXT. Keep platform super-admin's billing/tenants pages as scaffolds; don't wire revenue capture. We'll revisit when we have ≥10 active gyms.
4. **Mobile theme behavior** — **Context-aware.**
   - In general/global sections (Proof Feed across the network, global Rank Ladder, KRUXT Profile, Settings) → KRUXT dark theme always.
   - In a gym scope (Guild Hall of the user's home gym, gym-scoped leaderboards, gym profile page) → apply that gym's branding.
   - Implement via a `BrandScopeProvider` that swaps theme tokens when route enters/leaves a gym scope.
5. **BZone go-live** — **Demo only for now.** Tommaso is NOT on the platform yet; we're using BZone purely as the seed/demo gym so the dashboard always has realistic data to show. No customer-comms or onboarding outreach until we've at least: (a) workout logger live on mobile, (b) Proof Feed live on mobile, (c) public gym page polished on web, (d) join flow tested with 3+ test members.

## 9. Implications for the streams (updated 2026-05-10)

- **Stream A (Mobile B2C) is the highest-leverage stream.** Proof Feed and Workout Logger are the retention engine — prioritize them over Guild Hall / Rank Ladder.
- **Stream C (branding) needs the `brand_applies_to_admin` toggle** wired into the existing `BrandDraft` form and persisted on `gym_brand_settings`.
- **Mobile branding switch** lives at the route boundary — needs a new `BrandScopeProvider` in `apps/mobile/src/contexts/`.
- **Platform billing pages**: leave as-is (scaffolds). No Stream F work on revenue-capture for now.
- **BZone seed** stays the canonical demo gym. Don't ship customer-facing copy that names Tommaso until he's onboard.
