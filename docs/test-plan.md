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

## B2B Operations

11. Waitlist promotion books first pending user by position.
12. Check-in logs preserve result and source channel.
13. Waiver and contract acceptances are immutable evidence records.

## Integrations

14. Duplicate webhook events remain idempotent.
15. Sync job retries update status and preserve cursor integrity.
16. Imported activities dedupe by `(user_id, provider, external_activity_id)`.
17. `device_sync_cursors` updates only by service role; users can read only their own cursors.

## Compliance

18. Consent records retain policy version evidence.
19. Privacy request transitions are valid (`submitted -> triaged -> in_progress -> fulfilled/rejected`).
20. Audit log rows are append-only.
21. Admin consent/privacy RPCs only return members linked to the requested gym.
22. Consent rows are immutable (`update/delete` attempts fail for all roles).
23. Policy version rows are immutable after insert (new versions publish as new rows only).
24. `record_user_consent` always writes audit + outbox events with policy bindings.
25. `list_missing_required_consents` returns deterministic gaps for missing/revoked/reconsent-required states.
26. `user_has_required_consents` blocks protected actions when re-consent is required.

## Rank + Trials

27. `join_challenge` allows visible, non-ended challenges only.
28. `leave_challenge` rejects completed participants and only removes caller-owned rows.
29. `submit_challenge_progress` enforces per-type anti-cheat delta thresholds.
30. `rebuild_leaderboard_scope` tie ordering is deterministic (`score desc`, stable user tie-break).
31. `rank_recompute_weekly` returns deterministic failure diagnostics when one board rebuild fails.

## Performance targets for pilot

- Feed p95 load < 500ms for 50-card page.
- Workout submit p95 < 700ms.
- Waitlist promotion operation < 300ms.
- Weekly leaderboard rebuild < 60s for first 50k users.
