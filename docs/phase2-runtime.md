# Phase 2 Runtime Implementation

This repository now includes executable TypeScript service modules for:

- Mobile onboarding orchestration (`auth -> profile -> consents -> gym membership/role`)
- Mobile Guild Hall snapshot + roster flow
- Admin staff access checks and gym operations snapshots/queues

## Mobile entrypoints

- `apps/mobile/src/services/phase2-onboarding-service.ts`
- `apps/mobile/src/flows/phase2-onboarding.ts`
- `apps/mobile/src/flows/phase2-onboarding-ui.ts`
- `apps/mobile/src/flows/guild-hall.ts`

Core methods:

- `Phase2OnboardingService.run(...)`
- `createPhase2OnboardingUiFlow(...).validate(...)`
- `createPhase2OnboardingUiFlow(...).submit(...)`
- `ProfileService.ensureProfile(...)`
- `PolicyService.captureBaselineConsents(...)`
- `GymService.createGymWithLeaderMembership(...)`
- `GymService.joinGym(...)`
- `GymService.getGuildHallSnapshot(...)`
- `GymService.listGuildRoster(...)`

## Admin entrypoints

- `apps/admin/src/services/staff-access-service.ts`
- `apps/admin/src/services/gym-admin-service.ts`
- `apps/admin/src/flows/phase2-staff-ops.ts`

Core methods:

- `StaffAccessService.requireGymStaff(...)`
- `GymAdminService.getGymOpsSummary(...)`
- `GymAdminService.listGymMemberships(...)`
- `GymAdminService.listPendingMemberships(...)`
- `GymAdminService.listPendingWaitlistEntries(...)`
- `GymAdminService.listUpcomingClasses(...)`
- `GymAdminService.approveMembership(...)`
- `GymAdminService.assignMembershipRole(...)`
- `GymAdminService.listUserConsentRecords(...)`
- `GymAdminService.listOpenPrivacyRequests(...)`

Supporting DB RPCs for strict-RLS admin reads:

- `public.admin_list_user_consents(p_gym_id, p_user_id)`
- `public.admin_list_open_privacy_requests(p_gym_id)`
- `public.admin_get_gym_ops_summary(p_gym_id)`

## Wiring expectations

- Mobile app should call onboarding flow immediately after auth submit.
- Mobile onboarding screens should use `createPhase2OnboardingUiFlow` for:
  - per-step validation (`auth/profile/consents/gym/review`)
  - recoverable user-readable errors with step targeting
  - end-to-end submit that returns `nextRoute = guild_hall`
- Mobile app can load guild hall state after onboarding/auth via `createGuildHallFlow`.
- Admin routes should enforce `requireGymStaff` before any management action.
- All actions rely on existing RLS policies in the migration file.
- Detailed screen wiring reference: `docs/phase2-mobile-onboarding-ui-wiring.md`.
