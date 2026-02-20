# Phase 5 Runtime Implementation

Phase 5 runtime now includes an admin service layer for B2B daily operations:

- Membership plans (list/create/update)
- Class scheduling, bookings, and waitlist operations
- Waiver and contract lifecycle plus staff-recorded acceptance evidence
- Check-in and access log recording/monitoring
- Billing telemetry (subscriptions, invoices, payments, refunds, dunning events)

## Admin entrypoints

- `apps/admin/src/services/b2b-ops-service.ts`
- `apps/admin/src/flows/phase5-b2b-ops.ts`
- `apps/admin/src/flows/phase5-ops-console-ui.ts`
- `apps/admin/src/app/page.ts`

Core methods:

- `B2BOpsService.listMembershipPlans(...)`
- `B2BOpsService.createMembershipPlan(...)`
- `B2BOpsService.createGymClass(...)`
- `B2BOpsService.upsertClassBookingByStaff(...)`
- `B2BOpsService.updateClassWaitlistEntry(...)`
- `B2BOpsService.promoteWaitlistMember(...)`
- `B2BOpsService.recordWaiverAcceptanceByStaff(...)`
- `B2BOpsService.recordContractAcceptanceByStaff(...)`
- `B2BOpsService.recordCheckin(...)`
- `B2BOpsService.recordAccessLog(...)`
- `B2BOpsService.upsertMemberSubscription(...)`
- `B2BOpsService.updateInvoice(...)`
- `B2BOpsService.updateDunningEvent(...)`

UI controller methods:

- `createPhase5OpsConsoleUiFlow.load(...)`
- `createPhase5OpsConsoleUiFlow.createClass(...)`
- `createPhase5OpsConsoleUiFlow.upsertClassBooking(...)`
- `createPhase5OpsConsoleUiFlow.promoteWaitlistMember(...)`
- `createPhase5OpsConsoleUiFlow.recordCheckinAndAccessLog(...)`
- `createPhase5OpsConsoleUiFlow.recordWaiverAcceptance(...)`
- `createPhase5OpsConsoleUiFlow.recordContractAcceptance(...)`

Wiring guide:

- `docs/phase5-ops-console-ui-wiring.md`

## DB migration hooks

- `packages/db/supabase/migrations/202602190364_krux_beta_part3_s023.sql`
- `packages/db/supabase/migrations/202602190365_krux_beta_part3_s024.sql`
- `packages/db/supabase/migrations/202602190366_krux_beta_part3_s025.sql`
- `packages/db/supabase/migrations/202602190367_krux_beta_part3_s026.sql`
- `packages/db/supabase/migrations/202602190368_krux_beta_part3_s027.sql`
- `packages/db/supabase/migrations/202602190369_krux_beta_part3_s028.sql`

These add staff-safe RPCs for recording waiver and contract acceptances on behalf of members while preserving audit evidence.
