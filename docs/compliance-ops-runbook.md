# Compliance Ops Runbook (Phase 8)

## Objective

Process privacy requests inside the admin console with auditable transitions, visible SLA risk, and deterministic escalation.

## On-Screen Mapping

- Queue load: `createPhase8ComplianceOpsFlow().load(gymId, filters)`
- Queue filters: `statuses`, `requestTypes`, `sla`, `userQuery`
- SLA badges:
  - `breached`: overdue or explicit `sla_breached_at`
  - `at_risk`: due date within threshold window (default 24h)
  - `on_track`: due date beyond threshold window
  - `no_due_date`: due date missing/invalid
- Transition action: `transition(gymId, requestId, nextStatus, notes, filters)`
- Metrics panel: `GymAdminService.getPrivacyOpsMetrics(gymId, windowDays)`

## Operating Cadence

1. Every 4 hours during staffed periods, filter queue by `submitted`.
2. Move validated requests to `triaged` with actionable notes.
3. Move actively handled requests to `in_progress` immediately after ownership assignment.
4. Resolve each request as `fulfilled` or `rejected` with evidence in notes.
5. Keep queue free of `breached` items by end of staffed day.

## Request Lifecycle Controls

1. `submitted -> triaged`
   - Verify requester scope and request type.
   - Confirm legal basis and any hold constraints.
2. `triaged -> in_progress`
   - Assign operator.
   - Attach execution notes and expected completion target.
3. `in_progress -> fulfilled|rejected`
   - `fulfilled`: attach proof artifact/link when applicable.
   - `rejected`: capture explicit legal rationale.

## SLA Escalation Rules

1. If badge is `at_risk`, owner reviews immediately and updates notes.
2. If badge is `breached`, start incident escalation:
   - Open security incident workflow.
   - Notify compliance owner through incident notifier path.
   - Record escalation trace in audit metadata.
3. If breach persists past next staffed checkpoint, escalate to leadership on-call.

## Metrics Interpretation

- `openRequests`: current unresolved queue load.
- `overdueRequests`: unresolved requests already overdue/SLA breached.
- `avgCompletionHours`: mean turnaround for fulfilled/rejected requests in measurement window.
- `fulfilledRequestsWindow` / `rejectedRequestsWindow`: outcome mix for quality and legal follow-up.

## Evidence and Audit Requirements

1. Every status transition requires notes.
2. Rejections must include legal basis summary.
3. Export/delete completions must store proof metadata.
4. Incident escalation events must be written to audit trail.
