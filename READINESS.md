# KRUXT Real-Life Testing Readiness

One holistic system: mobile athlete app + gym admin platform + public web +
platform console, all on one Supabase backend. This is the gate checklist for
putting it in front of real people. Owners follow TEAM_PROTOCOL.md lanes.

## The three journeys that must be flawless

### J1 — Athlete (mobile, Expo)
Sign up → onboarding (profile, consents, gym select) → log workout → attach
photo/video proof → post → vertical Proof Feed (video + posters) → react /
comment → Guild Hall → Rank Ladder → Profile (edit, password, units, GDPR).

| Step | Status |
|------|--------|
| Auth + onboarding + consent gates | ✅ built — needs device pass |
| Log → proof (camera/library) → post | ✅ built — needs device pass |
| Feed: images, videos, posters, reactions, comments | ✅ built — needs device pass |
| Guild Hall / Rank Ladder wired to real data | ✅ built |
| Rank actually updates after workouts | ❌ **BLOCKED — rank recompute job failing weekly since Feb (#103)** |
| Profile: edit / password / units / links / GDPR export+delete | ✅ built (PR #102) |
| Dead UI removed (2FA, Connected Devices, Privacy Settings rows) | ✅ removed (PR #102) |

### J2 — Gym owner/staff (admin, kruxt-admin.vercel.app)
Login → onboard gym → invite/approve members → manage roles & status (audited,
bulk) → classes → check-ins → waivers → billing → compliance → support.

| Step | Status |
|------|--------|
| Members console incl. audited bulk actions | ✅ merged (#84) — UAT pending (#96) |
| Platform→admin handoff | ✅ fixed (#100) |
| Classes / check-ins / waivers / billing depth | ⚠️ needs journey walkthrough — file gaps as issues during UAT |
| Demo-seed button hidden in production | ⚠️ verify `NEXT_PUBLIC_ENABLE_DEMO_SEED` unset on Vercel |

### J3 — Cross-app seams (the "holistic" part)
| Seam | Status |
|------|--------|
| Same Supabase project for all four apps | ⚠️ verify all Vercel envs point at the SAME project as mobile |
| Cross-app links (`NEXT_PUBLIC_KRUXT_*_URL`, `EXPO_PUBLIC_APP_WEB_URL`) | ❌ set real URLs in Vercel + mobile env (#105) |
| Mobile support/legal links (kruxt.app/legal, support@kruxt.app) | ⚠️ confirm real destinations exist |
| Web `/join` + invite activation → mobile app | ⚠️ test invite E2E during UAT |

## Fake/test data purge (before real users)
1. **BZone demo people seed** (`202605300001_bzone_demo_people_seed.sql`:
   `demo.*+bzone@kruxt.test` accounts) — remove from the testing project or
   confirm scoped-out (#104).
2. Admin **demo-seed button** — prod env must not set `ENABLE_DEMO_SEED`.
3. **DesignShowcase** shell in mobile — ensure unreachable from production nav.
4. Any seeded workouts/gyms in the shared project that testers would see.

## Ordered path to "start testing"
1. Merge PR #102 → **fix rank recompute (#103, Codex, blocker)**.
2. Data purge pass (#104, Codex) + env alignment (#105, Edoardo+Claude).
3. Codex runs the 4-account BZone UAT (#96) journey-by-journey; file gaps.
4. Device smoke-test of J1 on Expo Go (Edoardo + Claude fixes same-day).
5. Fix, re-run failed journey steps, then invite real testers.

**Definition of ready:** every step above green; no visible control is a no-op;
no `*.test` / demo accounts visible; one Supabase project end to end.
