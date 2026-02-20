# Phase 8 Runtime Implementation (Slice 1)

Phase 8 runtime now includes the first compliance execution slice for privacy request handling:

- Mobile privacy-request center service + flow
- Admin compliance ops flow for open request triage
- SQL transition pipeline for auditable request lifecycle state changes
- Edge processor queue for submitted triage + overdue SLA breach marking

## Mobile entrypoints

- `apps/mobile/src/services/privacy-request-service.ts`
- `apps/mobile/src/flows/phase8-privacy-requests.ts`
- `apps/mobile/src/app.tsx`

Core methods:

- `PrivacyRequestService.submit(...)`
- `PrivacyRequestService.listMine(...)`

## Admin entrypoints

- `apps/admin/src/flows/phase8-compliance-ops.ts`
- `apps/admin/src/services/gym-admin-service.ts`

Core methods:

- `GymAdminService.listOpenPrivacyRequests(...)`
- `GymAdminService.transitionPrivacyRequest(...)`

## SQL / RPC hooks

- `public.submit_privacy_request(public.privacy_request_type, text)`
- `public.transition_privacy_request_status(uuid, public.privacy_request_status, text)`
- `public.process_privacy_request_queue(integer, integer)`
- `public.admin_list_open_privacy_requests(uuid)` (now includes overdue/SLA fields)
- `public.is_privacy_request_open_status(public.privacy_request_status)`

## Edge function behavior

- `supabase/functions/privacy_request_processor/index.ts`
  - calls `process_privacy_request_queue`
  - triages `submitted -> triaged`
  - marks `sla_breached_at` for overdue open requests

## DB migration hooks

- `packages/db/supabase/migrations/202602190398_krux_beta_part4_s057.sql`
- `packages/db/supabase/migrations/202602190399_krux_beta_part4_s058.sql`
- `packages/db/supabase/migrations/202602190400_krux_beta_part4_s059.sql`
- `packages/db/supabase/migrations/202602190401_krux_beta_part4_s060.sql`
