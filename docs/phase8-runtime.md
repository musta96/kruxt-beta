# Phase 8 Runtime Implementation

Phase 8 runtime includes compliance execution slices and hardening increments:

- Mobile privacy-request center service + flow
- Admin compliance ops flow for open request triage
- SQL transition pipeline for auditable request lifecycle state changes
- Edge processor queue for submitted triage + overdue SLA breach marking
- Immutable policy registry publishing with audit/event emission
- Immutable consent records captured through audited RPCs
- Re-consent gate RPCs wired into protected workout logging flow
- Export job queue + storage delivery with signed URL expiration
- Delete/anonymize job queue with legal-hold guardrails and retry-safe fulfillment
- Audit log hardening with append-only integrity chain and drift checks
- Breach-response incident lifecycle + deadline/escalation notifier stubs
- Localization baseline for legal copy with locale fallback + timestamp formatting
- Compliance ops console hardening with queue filters, SLA badges, runbook mapping, and privacy metrics

## Mobile entrypoints

- `apps/mobile/src/services/privacy-request-service.ts`
- `apps/mobile/src/flows/phase8-privacy-requests.ts`
- `apps/mobile/src/app.tsx`

Core methods:

- `PrivacyRequestService.submit(...)`
- `PrivacyRequestService.listMine(...)`
- `PrivacyRequestService.listDownloadableExports(...)`
- `PolicyService.upsertConsent(...)` (RPC-backed append-only write)
- `PolicyService.listRequiredConsentGaps(...)`
- `PolicyService.hasRequiredConsents(...)`

## Admin entrypoints

- `apps/admin/src/flows/phase8-compliance-ops.ts`
- `apps/admin/src/services/gym-admin-service.ts`

Core methods:

- `GymAdminService.listOpenPrivacyRequests(...)`
- `GymAdminService.getPrivacyOpsMetrics(...)`
- `GymAdminService.transitionPrivacyRequest(...)`
- `GymAdminService.listSecurityIncidents(...)`

## SQL / RPC hooks

- `public.submit_privacy_request(public.privacy_request_type, text)`
- `public.transition_privacy_request_status(uuid, public.privacy_request_status, text)`
- `public.process_privacy_request_queue(integer, integer)`
- `public.admin_list_open_privacy_requests(uuid)` (now includes overdue/SLA fields)
- `public.is_privacy_request_open_status(public.privacy_request_status)`
- `public.publish_policy_version(public.policy_type, ...)`
- `public.record_user_consent(public.consent_type, ...)`
- `public.list_missing_required_consents(uuid)`
- `public.user_has_required_consents(uuid)`
- `public.queue_privacy_export_jobs(integer)`
- `public.claim_privacy_export_jobs(integer)`
- `public.build_privacy_export_payload(uuid)`
- `public.complete_privacy_export_job(...)`
- `public.fail_privacy_export_job(...)`
- `public.has_active_legal_hold(uuid)`
- `public.apply_user_anonymization(uuid, uuid)`
- `public.queue_privacy_delete_jobs(integer)`
- `public.claim_privacy_delete_jobs(integer)`
- `public.complete_privacy_delete_job(uuid, jsonb)`
- `public.fail_privacy_delete_job(uuid, text, integer, integer, boolean)`
- `public.audit_log_integrity_drift(integer)`
- `public.audit_log_integrity_summary(integer)`
- `public.create_security_incident(...)`
- `public.transition_security_incident_status(uuid, text, text, jsonb)`
- `public.recompute_security_incident_deadlines(uuid, integer, integer, text)`
- `public.admin_list_security_incidents(uuid, integer, text)`
- `public.queue_incident_escalation_notifications(...)`
- `public.claim_incident_notification_jobs(integer)`
- `public.complete_incident_notification_job(uuid, jsonb)`
- `public.fail_incident_notification_job(uuid, text, integer, integer)`
- `public.normalize_legal_locale(text)`
- `public.legal_locale_fallback_chain(text)`
- `public.resolve_legal_copy(text, text)`
- `public.list_legal_copy_bundle(text, text)`
- `public.admin_get_privacy_ops_metrics(uuid, integer)`

## Edge function behavior

- `supabase/functions/privacy_request_processor/index.ts`
  - calls `process_privacy_request_queue`
  - triages `submitted -> triaged`
  - marks `sla_breached_at` for overdue open requests
  - queues and claims export jobs
  - uploads export JSON into `privacy-exports` bucket
  - writes expiring signed links and marks requests fulfilled
  - queues and claims delete jobs
  - blocks delete fulfillment when active legal hold exists
  - applies anonymization and marks delete requests fulfilled
  - retries or hard-fails delete jobs with audited events
  - maintains coverage via `security.event_outbox` audit entries for security-relevant domain events
- `supabase/functions/incident_notifier/index.ts`
  - claims incident notification jobs
  - runs provider-agnostic email/webhook stub notifiers
  - supports drill mode (`forceDrill`) to avoid live external notices
  - completes/retries notification jobs via SQL RPCs
- `packages/types/src/legal-localization.ts`
  - translation-key resolver for legal/compliance copy
  - deterministic locale fallback chain (`requested -> en-US`)
  - timezone-safe legal timestamp formatter
- `docs/compliance-ops-runbook.md`
  - operator playbook mapped to queue actions, SLA badges, and escalation rules

## DB migration hooks

- `packages/db/supabase/migrations/202602190398_krux_beta_part4_s057.sql`
- `packages/db/supabase/migrations/202602190399_krux_beta_part4_s058.sql`
- `packages/db/supabase/migrations/202602190400_krux_beta_part4_s059.sql`
- `packages/db/supabase/migrations/202602190401_krux_beta_part4_s060.sql`
- `packages/db/supabase/migrations/202602190402_krux_beta_part4_s061.sql`
- `packages/db/supabase/migrations/202602190403_krux_beta_part4_s062.sql`
- `packages/db/supabase/migrations/202602190404_krux_beta_part4_s063.sql`
- `packages/db/supabase/migrations/202602190405_krux_beta_part4_s064.sql`
- `packages/db/supabase/migrations/202602190406_krux_beta_part4_s065.sql`
- `packages/db/supabase/migrations/202602190407_krux_beta_part4_s066.sql`
- `packages/db/supabase/migrations/202602190408_krux_beta_part4_s067.sql`
- `packages/db/supabase/migrations/202602190409_krux_beta_part4_s068.sql`
- `packages/db/supabase/migrations/202602190410_krux_beta_part4_s069.sql`
- `packages/db/supabase/migrations/202602190411_krux_beta_part4_s070.sql`
- `packages/db/supabase/migrations/202602190412_krux_beta_part4_s071.sql`
- `packages/db/supabase/migrations/202602190413_krux_beta_part4_s072.sql`
- `packages/db/supabase/migrations/202602190414_krux_beta_part4_s073.sql`
