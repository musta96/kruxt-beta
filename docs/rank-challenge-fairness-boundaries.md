# Challenge Participation and Fairness Boundaries

Source inspection at base 82853d1, with the local #98 participation fix.
This is a repository-contract audit, not verification of a hosted deployment.
No migration, remote query, challenge seed, scoring change, or library change
was performed.

## Delivered: Truthful Participation

RankScreen labels join and leave actions explicitly. A persisted completed
entry is a non-actionable status, not a leave control. The leave action states
that deletion removes the entry and score. Other challenge actions and refresh
are disabled during a participation mutation, with an immediate
duplicate-action guard. A failed mutation reloads persisted participation
before displaying its error.

The ranks service reports leave success only when leave_challenge returns
the boolean true. False, null, and malformed acknowledgments are not success.
The server remains authoritative; local controls cannot change eligibility.

## Existing Server Contract

All SQL references below are in
packages/db/supabase/migrations/00000000000000_baseline.sql.
No later definition of these challenge functions was found in either migration
tree during this inspection.

- challenges (line 312) persists type, visibility, gym, dates, description and
  points_per_unit. It does not persist a structured scoring unit, evidence
  policy, division/cohort, daily cap, or recovery/rest rule.
- join_challenge (line 4140) requires authentication and an unexpired challenge.
  Visibility permits public challenges, the creator, or gym-visible access.
  can_view_gym (line 948) accepts a public gym or active/trial membership:
  gym visibility is not a reliable members-only eligibility promise.
  Joining before starts_at is allowed by this RPC; discovery currently lists
  only challenges within their active dates.
- submit_challenge_progress (line 4263) requires a joined participant, an active
  date window, and a positive delta. Per-call maxima are 1 for consistency,
  21600 for time_based, 1000 for max_effort, and 50000 for volume. It multiplies
  the delta by points_per_unit, rounds to two decimals, and adds it to the score
  with a 1000000 total ceiling. Completion is sticky when requested.
- There is no per-day deduplication, unique workout/evidence reference, recovery
  allowance, or type-specific best-effort replacement in that RPC. Consistency
  can be incremented repeatedly; max_effort also adds rather than retaining a
  maximum. Enum names alone do not establish fair or non-volume scoring.
- challenge_participants insert/update policies (lines 2527 and 2535) also allow
  self writes; RPC-only validation is not a complete integrity boundary.
- leave_challenge (line 4213) deletes only the caller's incomplete entry. It
  returns false when no eligible row was deleted, including a completed entry
  or one already absent.
- rebuild_leaderboard_scope (line 3944) uses stored challenge points, with
  completion/time/user tie-breaks. The athlete rank service separately orders
  visible participants by score and updated_at and limits the list to ten;
  it is not an authoritative full-population ranking or a verification claim.

A genuinely fair non-volume challenge therefore requires server-owned evidence
and idempotency rules, explicit units and eligibility, a rest-aware scoring
policy, and write-path enforcement. Those are blockers, not capabilities
implemented by this UI patch. No new challenge, fairness badge, verified-result
claim, scoring incentive, or replacement leaderboard was invented.

## Library Discovery Inspection

apps/web/src/lib/public/library.ts reads public exercises, the viewer's recent
workouts, and active saved workout templates. Exercise discovery is bounded to
220 rows; personal history spans 180 days and at most 160 workouts/600 exercise
links. Counts are observations within those bounds, not quality ratings.

EDITORIAL_PROGRAMS is a local constant, including coach labels and saved,
scheduled, and locked statuses; those labels are not loaded from a user's
persisted enrollment or entitlement. Technique progressions are generated from
the first exercises in each movement-pattern group, not a persisted reviewed
curriculum. LibraryScreen sorts exercises by personal completion count, which
is familiarity rather than editorial quality, and its program/session links
open generic Plan/Log routes without persisting a selected program.

Truthful curated enrollment, coaching attribution, reviewed progressions, and
entitlement claims need persisted provenance and selected-program persistence.
No such capability is asserted here. Library, Plan, and Log are parent-owned
and were inspected read-only.
