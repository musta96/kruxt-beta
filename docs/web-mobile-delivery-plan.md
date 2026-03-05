# KRUXT Web + Mobile Delivery Plan

## Goal
Ship a stable production web app (admin + org operations) and an iOS app for pilot users while reusing the existing Supabase backend, RLS, and edge functions.

## Architecture
- Web: Next.js (`apps/web`) deployed to Vercel
- Mobile: Expo + EAS (existing `apps/mobile`) for TestFlight/App Store
- Backend: existing Supabase project `hgomsmhsybrxjdxbgkjy`
- Shared contracts: `packages/types`

## Phase 1: Auth + RBAC Baseline (In Progress)
- [x] Bootstrap `apps/web` Next.js project
- [x] Add shared Supabase browser auth client with deterministic storage key
- [x] Add role resolution (`founder` vs gym staff) from `platform_operator_accounts` and `gym_memberships`
- [x] Create `/` auth screen (signin/signup)
- [x] Create `/admin` role-aware dashboard shell
- [ ] Wire Vercel env vars and deploy first build

## Phase 2: Founder Control Plane
- [ ] `/admin/gyms`: list/create/update gyms
- [ ] owner transfer and subscription status updates
- [ ] compliance/legal metadata editing for gyms

## Phase 3: Organization Console
- [ ] `/admin/users`: staff and role management
- [ ] `/admin/invites`: invite lifecycle (create/resend/revoke)
- [ ] `/accept-invite`: finalize membership for invited users

## Phase 4: Class Operations UX
- [ ] class catalog by location
- [ ] coach eligibility per course
- [ ] schedule drawer with date/time UX
- [ ] recurrence + exceptions

## Phase 5: Settings + Compliance + Billing Surfaces
- [ ] organization profile + legal info
- [ ] invoice/compliance profile configuration
- [ ] founder oversight views for compliance and billing state

## Phase 6: Quality + Security
- [ ] unit + integration tests for auth/RBAC and critical flows
- [ ] e2e tests for login/invite/class schedule
- [ ] audit RLS access paths for new queries

## Phase 7: Mobile App Store Path
- [ ] stabilize `apps/mobile` on same Supabase auth contracts
- [ ] add deep link handling (`/accept-invite` and auth redirects)
- [ ] configure EAS build profiles and app signing
- [ ] TestFlight distribution with pilot cohort
- [ ] App Store metadata + privacy labels + release

## Immediate Setup (Vercel)
1. Create Vercel project from repo root and set `Root Directory` to `apps/web`.
2. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL=https://hgomsmhsybrxjdxbgkjy.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_IJoOtjmzI_S3fC6F_N32ZA_4Dk4wSM_`
3. Deploy.
4. In Supabase Auth URL config:
   - Site URL = Vercel production URL
   - Redirect URLs include Vercel production + preview domains

## Done Criteria for Phase 1
- Founder can sign in and access `/admin` without false `Sign-in required`
- Founder role badge appears and sign-out works
- Staff users with active gym role can open `/admin`
- Non-staff/non-founder users are authenticated but denied with clear message
