# KRUXT Beta Test Plan (Phase-Gated)

## Security and RLS

1. Cross-user reads are blocked for `device_connections`, `consents`, `privacy_requests`, `notification_preferences`.
2. Gym member cannot mutate staff-only objects (`gym_membership_plans`, `waivers`, `contracts`).
3. Service-only tables (`integration_webhook_events`, `event_outbox`) reject non-service writes.

## Workout + Social

4. `log_workout_atomic` rolls back if any nested exercise/set insert fails.
5. Workout insert creates feed event and increments profile XP/chain.
6. Visibility rules enforce `public/followers/gym/private` feed access.
7. Blocked users cannot view/interact with blocked workouts.
8. PR detection marks `workout_sets.is_pr` and inserts one `pr_verified` feed event per workout.

## B2B Operations

9. Waitlist promotion books first pending user by position.
10. Check-in logs preserve result and source channel.
11. Waiver and contract acceptances are immutable evidence records.

## Integrations

12. Duplicate webhook events remain idempotent.
13. Sync job retries update status and preserve cursor integrity.
14. Imported activities dedupe by `(user_id, provider, external_activity_id)`.

## Compliance

15. Consent records retain policy version evidence.
16. Privacy request transitions are valid (`submitted -> in_review -> completed/rejected`).
17. Audit log rows are append-only.
18. Admin consent/privacy RPCs only return members linked to the requested gym.

## Performance targets for pilot

- Feed p95 load < 500ms for 50-card page.
- Workout submit p95 < 700ms.
- Waitlist promotion operation < 300ms.
- Weekly leaderboard rebuild < 60s for first 50k users.
