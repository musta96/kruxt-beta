# Phase 9 Closed Beta Rollout (Pavia -> US + EU)

## Objective

Ship KRUXT closed beta with controlled cohort expansion, measurable KPI gates, and rollback safety.

## Timeline Baseline

- Pilot readiness freeze: 2026-02-27
- Pavia cohort launch window: 2026-03-02 to 2026-03-08
- First KPI gate review: 2026-03-13
- US + EU cohort expansion decision window: 2026-03-16 to 2026-03-20

## 1) Pavia Pilot Readiness Checklist

Mark each item complete before opening pilot invite links.

### Product + Ops

- [ ] `billing_live` flag remains `false` for pilot gyms.
- [ ] Privacy request flow tested end-to-end (`submit -> triage -> fulfill/reject`).
- [ ] Compliance queue shows SLA badges and metrics for pilot gyms.
- [ ] Runbook owner assigned for every staffed day (`docs/compliance-ops-runbook.md`).
- [ ] Class booking/waitlist/check-in flows validated with pilot staff.

### Reliability + Security

- [ ] `privacy_request_processor` and `sync_dispatcher` schedulers configured.
- [ ] Incident notifier drill mode validated in staging and production.
- [ ] Audit integrity checks pass (`audit_log_integrity_summary`).
- [ ] Feature-flag rollback path verified for critical modules.
- [ ] Error budget alerts configured for API/edge-function failures.

### Support + Launch Logistics

- [ ] Support rotation owner and escalation contacts documented.
- [ ] Pilot onboarding guide sent to Pavia gym operators.
- [ ] Known-issues list prepared for first week triage.
- [ ] Daily launch standup schedule confirmed.

## 2) KPI Gates (Weekly)

These are go/no-go thresholds for progression.

| KPI | Definition | Gate |
|---|---|---|
| Workout logging repeat rate (week 2) | Users with 2+ logs / active users | >= 45% |
| Feed interactions per active user | Reactions + comments / active users | >= 3.0 |
| Class booking completion | Successful bookings / booking attempts | >= 70% |
| Week-4 retention | Users active in week 4 / users active in week 0 | >= 25% |
| Chain survival rate | Users maintaining chain >= 7 days / active users | >= 40% |
| Gym weekly active staff rate | Staff active weekly / total staff | >= 60% |
| Sync success rate (connected users) | Successful sync jobs / total sync jobs | >= 95% |
| Sev-1 incident rate | Sev-1 incidents per week | 0 |

## 3) Weekly Tracking Board

Update this table every Friday before rollout decision meetings.

| Week Of | Cohort | Repeat Rate | Feed Interactions/Active | Booking Completion | W4 Retention | Chain Survival | Staff WAU Rate | Sync Success | Sev-1 Count | Gate Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 2026-03-06 | Pavia | - | - | - | - | - | - | - | - | Pending | Launch week |
| 2026-03-13 | Pavia | - | - | - | - | - | - | - | - | Pending | First gate |
| 2026-03-20 | Pavia + US/EU Canary | - | - | - | - | - | - | - | - | Pending | Expansion gate |

Gate status values:
- `Pass`: all mandatory thresholds met
- `Conditional`: one threshold missed but mitigation accepted
- `Fail`: critical threshold missed; rollback or hold required

## 4) Incident Rollback Playbook

Trigger rollback when either condition is true:

- Any Sev-1 incident active > 30 minutes
- KPI gate status = `Fail` on a critical metric (retention, sync success, or security incident count)

### Rollback Actions (Ordered)

1. Freeze cohort expansion invites.
2. Disable risky flags:
   - `public_feed_boost_enabled`
   - `provider_fitbit_enabled`
   - `provider_oura_enabled`
   - `ml_recommendations_enabled`
3. Keep privacy/compliance flows online; do not disable legal request intake.
4. Route new high-risk modules to safe fallback UI paths.
5. Publish incident note to support/gym operators within 30 minutes.
6. Run root-cause capture and attach action items with owners.
7. Re-open gate review only after two stable days with no Sev-1 recurrence.

## 5) US + EU Expansion Criteria

Expansion is allowed only if all criteria are true for two consecutive weekly reviews.

- [ ] Pavia gate status is `Pass` or approved `Conditional`.
- [ ] Sync success rate remains >= 95% for connected users.
- [ ] Zero unresolved compliance SLA breaches older than 7 days.
- [ ] Support response SLA within target for pilot gyms.
- [ ] No open Sev-1 incidents at expansion decision time.
- [ ] Localization/legal copy coverage confirmed for release locales.

## 6) Ownership Matrix

| Area | Owner | Backup | Cadence |
|---|---|---|---|
| KPI scorecard update | Founder | Ops lead | Weekly (Friday) |
| Compliance queue operations | Compliance ops | Support | Daily |
| Incident command | Founder | On-call engineer | As needed |
| Cohort invite controls | Founder | Gym success | Weekly gate |
| Rollback execution | Founder | On-call engineer | Incident-driven |
