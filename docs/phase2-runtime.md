# Phase 2 Runtime Implementation

This repository now includes executable TypeScript service modules for:

- Mobile onboarding orchestration (`auth -> profile -> consents -> gym membership/role`)
- Admin staff access checks and gym membership role operations

## Mobile entrypoints

- `apps/mobile/src/services/phase2-onboarding-service.ts`
- `apps/mobile/src/flows/phase2-onboarding.ts`

Core methods:

- `Phase2OnboardingService.run(...)`
- `ProfileService.ensureProfile(...)`
- `PolicyService.captureBaselineConsents(...)`
- `GymService.createGymWithLeaderMembership(...)`
- `GymService.joinGym(...)`

## Admin entrypoints

- `apps/admin/src/services/staff-access-service.ts`
- `apps/admin/src/services/gym-admin-service.ts`

Core methods:

- `StaffAccessService.requireGymStaff(...)`
- `GymAdminService.listGymMemberships(...)`
- `GymAdminService.approveMembership(...)`
- `GymAdminService.assignMembershipRole(...)`
- `GymAdminService.listUserConsentRecords(...)`

## Wiring expectations

- Mobile app should call onboarding flow immediately after auth submit.
- Admin routes should enforce `requireGymStaff` before any management action.
- All actions rely on existing RLS policies in the migration file.
