# KRUXT Beta Test Plan (Phase-Gated)

## Security and RLS

1. Cross-user reads are blocked for `device_connections`, `consents`, `privacy_requests`, `notification_preferences`, `push_notification_tokens`.
2. Gym member cannot mutate staff-only objects (`gym_membership_plans`, `waivers`, `contracts`).
3. Service-only tables (`integration_webhook_events`, `event_outbox`) reject non-service writes.

## Workout + Social

4. `log_workout_atomic` rolls back if any nested exercise/set insert fails.
5. Workout insert creates feed event and increments profile XP/chain.
6. Visibility rules enforce `public/followers/gym/private` feed access.
7. Blocked users cannot view/interact with blocked workouts.
8. PR detection marks `workout_sets.is_pr` and inserts one `pr_verified` feed event per workout.
9. Feed ranking v1 remains deterministic for a fixed event snapshot and scoring inputs.
10. Push token registration/deactivation is limited to token owner by RLS.
11. `createPhase2OnboardingUiFlow.validate` returns step-targeted field errors (`auth/profile/consents/gym`).
12. `Phase2OnboardingService.run` rejects when required baseline consent persistence cannot be confirmed.
13. `Phase2OnboardingService.run` rejects when requested home gym is not persisted to profile.

## B2B Operations

14. Waitlist promotion books first pending user by position.
15. Check-in logs preserve result and source channel.
16. Waiver and contract acceptances are immutable evidence records.

## Integrations

17. Duplicate webhook events remain idempotent.
18. Sync job retries update status and preserve cursor integrity.
19. Imported activities dedupe by `(user_id, provider, external_activity_id)`.
20. `device_sync_cursors` updates only by service role; users can read only their own cursors.

## Compliance

21. Consent records retain policy version evidence.
22. Privacy request transitions are valid (`submitted -> triaged -> in_progress -> fulfilled/rejected`).
23. Audit log rows are append-only.
24. Admin consent/privacy RPCs only return members linked to the requested gym.
25. Consent rows are immutable (`update/delete` attempts fail for all roles).
26. Policy version rows are immutable after insert (new versions publish as new rows only).
27. `record_user_consent` always writes audit + outbox events with policy bindings.
28. `list_missing_required_consents` returns deterministic gaps for missing/revoked/reconsent-required states.
29. `user_has_required_consents` blocks protected actions when re-consent is required.
30. `queue_privacy_export_jobs` queues only open `access/export` requests and is idempotent under retries.
31. `claim_privacy_export_jobs` respects retry schedule and does not double-claim rows under concurrency.
32. Export payload excludes secret credentials (no encrypted device tokens present in output).
33. `complete_privacy_export_job` writes expiring response link metadata and emits `privacy.export_ready`.
34. `fail_privacy_export_job` schedules retries and hard-fails with request rejection at max retry count.
35. `queue_privacy_delete_jobs` queues only open `delete` requests and remains idempotent under retries.
36. `has_active_legal_hold` blocks delete fulfillment for held users, with terminal fail when forced final.
37. `apply_user_anonymization` is idempotent and removes/scrubs targeted rows without FK breakage.
38. `complete_privacy_delete_job` marks request fulfilled and stores anonymization summary payload.
39. `fail_privacy_delete_job` retries with backoff and rejects the request at final failure.
40. Audit log rows are immutable and reject `update/delete` with append-only guardrails.
41. `audit_log_integrity_drift` detects sequence/hash mismatches after forced tamper simulation.
42. Security-relevant `event_outbox` inserts produce `security.event_outbox` audit entries.
43. Staff/user direct inserts into `audit_logs` are denied; service pipeline inserts remain valid.
44. `create_security_incident` enforces gym-staff or service access and writes action/outbox/audit records.
45. `transition_security_incident_status` enforces valid lifecycle transitions and stage timestamps.
46. `admin_list_security_incidents` exposes deadline countdown and breached flags to operators.
47. `queue_incident_escalation_notifications` creates drill/live jobs with auditable escalation actions.
48. `incident_notifier` drill mode processes jobs without external sends while preserving completion metadata.
49. `fail_incident_notification_job` retries with backoff and marks terminal failures deterministically.
50. `normalize_legal_locale` + `legal_locale_fallback_chain` always produce deterministic fallback (`requested -> en-US`).
51. `resolve_legal_copy` and `list_legal_copy_bundle` return localized legal strings with stable fallback rank.
52. Legal checklists in mobile/admin Phase 8 flows are key-driven (no hardcoded legal copy in flow definitions).
53. Legal timestamp formatting returns locale/timezone-correct output for EU and US timezone inputs.
54. `admin_get_privacy_ops_metrics` returns deterministic open/overdue counters and bounded measurement window.
55. Phase 8 compliance queue filters (`status/type/SLA/user`) return stable subsets for identical inputs.
56. SLA badge derivation in admin flow is deterministic at boundary conditions (`breached`, `at_risk`, `on_track`, `no_due_date`).
57. Compliance runbook mapping exists and matches admin queue actions (`load`, `transition`, `metrics`).
58. Admin compliance view exposes active policy versions with effective dates for operator verification.

## Rank + Trials

59. `join_challenge` allows visible, non-ended challenges only.
60. `leave_challenge` rejects completed participants and only removes caller-owned rows.
61. `submit_challenge_progress` enforces per-type anti-cheat delta thresholds.
62. `rebuild_leaderboard_scope` tie ordering is deterministic (`score desc`, stable user tie-break).
63. `rank_recompute_weekly` returns deterministic failure diagnostics when one board rebuild fails.
64. `rank_recompute_weekly` deterministic probe reports `determinismMismatchCount = 0` for stable inputs.

## Rollout Gates

65. Pavia pilot readiness checklist is fully completed before invite activation.
66. Weekly KPI board is updated on cadence with explicit gate outcome (`Pass`, `Conditional`, `Fail`).
67. Incident rollback playbook includes ordered flag rollback actions and communication SLA.
68. US+EU expansion criteria are tracked and require two consecutive passing weekly reviews.
69. Weekly `rank-recompute-weekly` scheduler run produces artifact report and exits non-zero on recompute failure.
70. Failed scheduler run creates a high-priority phase-7 alert issue with workflow run URL.

## Phase 2 Admin Console

71. Non-staff actor receives `ADMIN_STAFF_ACCESS_DENIED` on load and all membership mutations.
72. `approvePendingMembership` transitions pending member to active and returns refreshed snapshot with queue update.
73. `rejectPendingMembership` transitions pending member to cancelled and removes it from pending queue on refreshed snapshot.
74. `assignMembershipRole` updates role and refreshed snapshot reflects new role immediately.

## Performance targets for pilot

- Feed p95 load < 500ms for 50-card page.
- Workout submit p95 < 700ms.
- Waitlist promotion operation < 300ms.
- Weekly leaderboard rebuild < 60s for first 50k users.
