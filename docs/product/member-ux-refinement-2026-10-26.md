# Member Workspace Refinement

Scope: existing member web shell, assigned-plan journey, feed presentation and
logger hierarchy. Operate mode: an athlete returning to training, often on a
phone with limited attention. This is a source-backed refinement informed by
the existing journey map, not a new brand system or completed user research.

## Problems Addressed

- Desktop used a stretched mobile bottom bar, with secondary destinations hidden
  behind a generic More disclosure. Sidebar navigation now makes both levels
  visible on desktop; mobile retains five thumb-reachable primary destinations.
- The plan page placed unsaved setup/reorder tools between the assigned session
  and its movements. The page now centers on a real assigned-session selector,
  exercise targets, coach notes and a reference-only workout handoff. Removed
  previews never persisted a plan; no stored plan data or authoring API changed.
- No-plan and loading failure looked too similar. Empty state now offers library
  and independent logging; failures have a distinct retry action.
- Feed moderation appeared before the athlete/workout, and media rendered as a
  tiny tile in a wide post. Actor/time and workout now lead; media uses available
  width without cropping. Account & safety remains available after interactions.
- Template authoring overwhelmed logging. It is now an explicit disclosure;
  save remains private and sharing optional. Technical submission commentary was
  removed, while draft disclosure and all mutation/recovery behavior remain.

## Verification

The member production build passes. The complete isolated browser suite passes
103 checks with one intentional desktop skip for the mobile-only narrow test.
Added checks exercise assigned/empty/error plan states, retry, desktop sidebar,
mobile secondary navigation, 320px targets/overflow, selected-day handoff into
logging, and screenshots. Existing tests still verify one save, media retry,
explicit sharing, lost-response recovery, private guidance and account switching.
Journey contracts: 169 pass. Workspace checks: 35 pass. Security suite passes.
Screenshots are fixture evidence under ignored `output/playwright/next-upgrade/`.
No real member data, pilot acceptance or hosted deployment is implied.

## Next Member Work

1. Focus the logger on completed exercise/set entry. Preserve drafts, receipt
   reconciliation and privacy while moving optional configuration out of the
   recording task. Validate how volume and planned targets map to actual sets.
2. Improve library filtering, saved-session recognition and return to the
   selected session without requiring template-authoring terminology.
3. Make gym membership, upcoming bookings and cancellation/rebooking outcomes
   easier to distinguish. Retain truthful class-series and waitlist states.
4. Simplify profile/progress hierarchy and distinguish private training history
   from audience-controlled social activity. Do not fabricate adherence metrics.
5. Walk the full loop with consenting pilot users after migration/security gates
   clear. Measure training completion, recovery success, repeated participation
   and safety, not forced sharing or time spent scrolling.

The broader platform UI is not declared complete. No new legal, security or
accessibility certification follows from this refinement or passing fixtures.
