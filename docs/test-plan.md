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

## Phase 3 WorkoutLogger UI

75. `createPhase3WorkoutLoggerUiFlow.validate` returns field-level errors for missing exercise IDs and empty set payloads.
76. `submit` returns `WORKOUT_LOGGER_VALIDATION_FAILED` without RPC call when draft validation fails.
77. Successful submit returns verification flags with `totalsUpdated=true`, `proofEventCreated=true`, `progressUpdated=true`.
78. Missing post-submit signals return recoverable `WORKOUT_LOGGER_SIGNALS_INCOMPLETE` error.

## Phase 4 Proof Feed UI

79. `createPhase4ProofFeedUiFlow.load` filters blocked actor IDs from feed cards.
80. `reactToWorkout` persists reaction state and returns refreshed snapshot.
81. `commentOnWorkout` persists comment state and returns refreshed snapshot plus filtered thread.
82. `reportContent` creates moderation record and includes it in refreshed `myReports`.

## Phase 5 Ops Console UI

83. `createPhase5OpsConsoleUiFlow.load` returns class/bookings/waitlist/check-in/waiver/contract/billing snapshot in one call.
84. `createClass`/`updateClass`/`setClassStatus` return refreshed snapshot with selected class state.
85. `promoteWaitlistMember` returns booking id and refreshed booking/waitlist snapshot.
86. `recordCheckinAndAccessLog` records both rows and returns refreshed operational snapshot.
87. `recordWaiverAcceptance` and `recordContractAcceptance` return acceptance IDs plus refreshed evidence lists.

## Phase 6 Integrations UI

88. `createPhase6IntegrationsUiFlow.load` returns only active beta providers (`apple_health`, `garmin`) plus per-provider state summaries.
89. `connectProvider` upserts active provider connection, queues initial sync job, and returns refreshed snapshot.
90. `disconnectProvider` sets provider connection to `revoked` and returns refreshed snapshot.
91. `queueSync` rejects inactive connections and refreshes snapshot after successful queue.
92. `validateActivation` reports missing providers, sync backlog, duplicate import groups, and deterministic mapping coverage.

## Phase 10 Customization + Support

93. Gym staff can upsert `gym_brand_settings` and read back deterministic values (colors/fonts/links) through `CustomizationSupportService`.
94. Per-gym feature toggles upsert by `(gym_id, feature_key)` and preserve rollout percentage bounds (`0..100`).
95. Invoice provider connections enforce single default provider per gym after `setDefaultInvoiceProviderConnection`.
96. Invoice compliance profile accepts Italy-ready fields (`invoice_scheme = it_fatturapa`, `pec_email`, `sdi_destination_code`) and remains staff-scoped.
97. Invoice delivery jobs keep idempotency uniqueness and retry metadata integrity under repeated inserts.
98. `createPhase10CustomizationSupportFlow.load` returns a coherent snapshot across branding, feature controls, invoicing, and support queue.
99. Support ticket list filters (`status/includeClosed/search`) produce deterministic subsets for a fixed dataset.
100. `submit_support_ticket` RPC creates a ticket with audit evidence and returns row data to caller.
101. Support messages append chronologically and enforce ticket-scope access via RLS.
102. `approve_support_automation_run` transitions status (`approved`/`rejected`) and appends audit entries.
103. `createPhase10SupportCenterFlow.load` returns user-scoped tickets with selected-thread messages and automation runs.
104. Mobile support center mutation chain (`submitTicket -> createMessage -> approveAutomationRun`) always refreshes with latest selected ticket state.

## Phase 10 Monetization Readiness

105. `consumer_plans` and `consumer_plan_prices` expose active rows to authenticated users while rejecting non-service mutations.
106. `consumer_entitlements` remains readable only by entitlement owner or service role.
107. `pricing_experiments` enforce scope checks (`b2c` with null gym, `b2b` with non-null gym).
108. Only gym staff can mutate `b2b` pricing experiments, variants, and assignments for their own gym.
109. `pricing_experiment_assignments` enforce subject exclusivity (`user_id xor gym_id`) and uniqueness per experiment subject.
110. `discount_campaigns` enforce type-dependent fields (`percent_off`, `amount_off_cents`, `trial_days_off`) and scope constraints.
111. Public `b2c` discount campaigns are readable only when active; `b2b` campaigns are gym-scoped.
112. `discount_redemptions` remain user/gym scoped and preserve idempotent uniqueness (`campaign_id`, `user_id`, `invoice_id`).
113. Pricing/discount helper functions reject cross-gym management attempts via RLS-aware checks.
114. `platform_plans` allow authenticated reads for active plans while rejecting non-service mutations.
115. `gym_platform_subscriptions` remain readable only to gym staff for that gym (or service role).
116. `gym_platform_invoices` and `gym_platform_payment_transactions` stay gym-scoped for reads and service-scoped for writes.
117. `gym_platform_refunds` visibility follows parent transaction gym access and blocks cross-gym reads.
118. `discount_redemptions.gym_platform_invoice_id` FK integrity holds under invoice deletion (`set null` behavior).

## Phase 10 Gym RBAC + Workforce + CRM

119. `seed_default_gym_permissions` creates deterministic role matrix rows for each gym without duplicates.
120. `user_has_gym_permission` respects precedence order: owner/service -> user override -> role permission -> deny.
121. Staff with `staff.shifts.manage` can create/update shifts; staff without it are denied by RLS.
122. Shift assignment trigger rejects non-staff users (`member` role or inactive memberships).
123. Time entry trigger rejects mismatched `(shift_id, gym_id, staff_user_id)` combinations.
124. Staff can submit own time entries, but cannot self-approve without `staff.time_entries.manage`.
125. `gym_kpi_daily_snapshots` are readable to users with `analytics.view` and service-only writable.
126. `gym_crm_leads` and `gym_crm_lead_activities` remain inaccessible to users lacking `crm.leads.manage`.
127. Gym-level permission overrides (`gym_user_permission_overrides`) immediately affect effective access checks.

## Phase 10 Platform Control Plane + Governance

128. `platform_operator_has_permission` resolves effective access by role + override with deterministic fallback deny.
129. Non-operator users cannot read platform-operator, feature-override, or data-governance tables.
130. `gym_support_access_grants` can be created by operator request flow but approval/revocation remains constrained to authorized actors.
131. `gym_support_access_sessions` require active approved grants at insertion time.
132. `get_platform_admin_overview()` rejects unauthorized callers and returns deterministic KPI payload shape for authorized operators.
133. `user_data_sharing_preferences` remains user-owned for writes and cannot be mutated cross-user.
134. `data_partner_exports` enforce aggregate-only rule when `export_level = aggregate_anonymous` (`includes_personal_data = false`).
135. Platform feature override uniqueness (`feature_key`,`target_scope`,`target_value`) prevents duplicate conflicting rows.

## Phase 10 Account Security Foundations

136. `user_security_settings` rows are user-owned and immutable cross-user by RLS.
137. `user_trusted_devices` upsert/revoke is limited to the owning user (or service role).
138. `user_auth_events` are append-only from user/service inserts and readable only by owner/service.
139. `log_user_auth_event(...)` rejects unauthenticated callers and writes actor-bound event rows.
140. Session timeout and login-alert channel constraints enforce valid bounds/enum values.

## Phase 10 Add-ons + Partner + Data Ops

141. `gym_addon_subscriptions` remain gym-scoped and mutable only by users with `addons.manage`.
142. `gym_advanced_analytics_views` are writable only with `analytics.advanced.view`; staff without it remain read-only/denied.
143. `gym_automation_playbooks` and `gym_automation_runs` remain gated by `automation.manage`.
144. `partner_marketplace_apps` catalog is publicly readable when active and protected for mutation by platform governance roles.
145. `gym_partner_app_installs` enforce gym permission checks (`partner.apps.manage` or `integrations.manage`).
146. `partner_revenue_events` balance check holds (`gross = platform + partner`) for non-zero rows.
147. `data_aggregation_jobs` and `data_anonymization_checks` are restricted to platform analytics/governance operators.
148. `data_release_approvals` enforce one row per required approval type per export.

## Phase 5 Members Console UI

149. `createPhase5MembersConsoleUiFlow.load` returns searchable segmented rows with queue summary and column preset visibility.
150. Role change actions (`assignRole`, `bulkAssignRole`) fail with `MEMBERS_CONSOLE_AUDIT_NOTE_REQUIRED` when audit note is missing.
151. `setStatus` and `bulkSetStatus` support `past_due` by upserting member subscription status via `B2BOpsService`.
152. Bulk actions return partial success metadata (`updatedMembershipIds`, `failedMembershipIds`) and refreshed snapshots.
153. Selected profile side panel returns timeline entries from membership, check-in, subscription, and open privacy request signals.

## Performance targets for pilot

- Feed p95 load < 500ms for 50-card page.
- Workout submit p95 < 700ms.
- Waitlist promotion operation < 300ms.
- Weekly leaderboard rebuild < 60s for first 50k users.
