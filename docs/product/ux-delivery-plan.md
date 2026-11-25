# KRUXT Journey-Led UX Delivery Plan

Draft for owner confirmation, 2026-10-22. Companion: [user journey map](user-journey-map.md).
No app code, production configuration or permissions changed in discovery.

Competitive extension: [strategy](competitive-strategy-2026-10-22.md),
[competitor dossiers](competitors/README.md), and
[social/gamification brief](social-gamification-brief.md). These add explicit
discovery/creator/competition journeys; no longer treat community as secondary
account functionality or assume the combined feature set is unique.

## Design Brief

Build a task-first KRUXT experience for athletes, gym teams and platform operators.
Preserve the existing brand; improve hierarchy, navigation, state clarity and
continuity before adding visual flourishes. This is refinement, not a rebrand.
The first delivery audience and beta/public-release goal await owner confirmation.

Every key screen should answer: where am I, which person/gym is this, what needs
attention, what can I do, and did it actually work? Product-specific status and
feedback belong in the UI; explanations of the UI itself do not.

## Current State Versus Target

| Today | Proposed target | Journey benefit |
| --- | --- | --- |
| Eleven equal member navigation links | Five primary destinations; utilities in relevant account/training/community context | Less scanning while training; deep links preserved. |
| Staff member automatically routes to legacy org/founder web tools | Deliberate workspace choice and a canonical gym backoffice | Dual-role users can train without losing context. |
| Desktop sidebar offsets remain on phone in admin/platform | Mobile drawer with independent desktop collapse, focus return and Escape close | Content has usable phone width and keyboard navigation. |
| Same dashboard pattern for many unrelated jobs | Athlete next session; gym today's work; operator triage queue | First screen helps finish a real job. |
| Errors can resemble empty data or no membership | Distinct loading, empty, filtered-empty, denied, unavailable and partial-success states | Fewer wrong retries and accidental setup. |
| Prototype controls and invented platform data | Authoritative values or honest unavailable state; integrate existing truthfulness repairs | Users know which outcomes they can trust. |
| Disconnected plan, logger and proof steps | Context-preserving task with a stable saved-workout identity | Less re-entry and duplicate risk. |

## Ordered Delivery Slices

Priorities below are recommendations, not a promise that the product is released.
P0 is a blocking correctness/trust defect; P1 is a core journey improvement;
P2 is secondary depth/polish after the core journey passes.

| Order | Slice and priority | Specific work | Acceptance evidence |
| --- | --- | --- | --- |
| 1 | Trust and recovery, P0 | Separate gym lookup errors from no membership; remove/disable inert promises using existing #112/#113 work; distinguish partial workout save; review role presentation | Injected failure never offers unintended gym creation; no false success or duplicate workout retry; role/denial fixtures pass. |
| 2 | Shared navigation foundations, P1 | Member five-destination nav; admin/platform responsive shells; active route, skip link, focus and workspace identity | Phone/desktop/tablet screenshots; keyboard drawer tests; old deep links work; no page-level horizontal overflow at 320/390/768/1440 widths. |
| 3 | Athlete first value, P1 | Separate confirmation/activation/consent; preserve invite and task destination; meaningful first-run Plan | New and existing identity/invite fixtures reach their intended task; expired/disabled/missing-policy states offer correct recovery. |
| 4 | Training continuity, P1 | Plan/day/template handoff; recoverable draft; multiple-set semantics; saved result and independent proof retry | Selected session populates correct draft; interruption/reload behavior tested; proof failure cannot create a second workout. |
| 5 | Gym-to-class loop, P1 | Request membership status, approval next action, booking-window freshness, reservation/waitlist/cancel outcomes | Clock boundary and concurrent-capacity tests; booked/waitlisted/cancelled states agree across member and staff. |
| 6 | Daily gym work, P1 | Accurate Today view; name-based member lookup; real check-in action and refresh contract; retain gym/date/filter | Timezone/midnight/large-fixture test; correct member checked in once; refresh/source status truthful. |
| 7 | Coaching delivery, P1 | Preserve athlete context; draft/assignment states; member-visible plan; partial broadcast outcomes | Athlete switch cannot publish stale content; assignment visible to intended member; retry sends only unfinished recipients. |
| 8 | Account, help and governance, P1/P2 | Make support/privacy/waiver actions operational or explicitly unavailable; request status; honest integration state | Mutation survives reload; expired export and unavailable provider handled; no compliance or connection claim without evidence. |
| 9 | Secondary modules and native parity, P2 | Reachable community/progress, optional services, rich native logging and media | Verify configured native entrypoint and actual device flow; no feature counted solely because its file exists. |

Social is a cross-cutting vertical slice, not postponed wholesale to order 9:
after identity/save/safety prerequisites, implement Following/My gym creation and
feedback alongside core training, then curated Discover and a fair opt-in challenge.
Broader algorithmic distribution, commerce, live streaming and native parity are
later expansion decisions. Validate both social-led and training-led entry; users
must be able to enjoy community or train privately without compulsory posting.

Do not make all changes in one unreviewable diff. Finish a vertical task slice,
verify it, then extend the same interaction rules to the remaining routes.

## Page Contracts

| Page family | Primary content/action | Supporting content | States to design |
| --- | --- | --- | --- |
| Member entry | Existing/new identity and intended destination | Gym invite/workspace identity, recovery | Confirmation pending, disabled provider, invalid link, offline. |
| Plan | Assigned/next session and start/resume | Schedule and library | No assignment, draft, changed plan, unavailable source. |
| Log | Exercises/sets and save | Units, notes, optional proof/visibility | Invalid entry, draft restored, saving, saved, proof partial failure. |
| Gym/classes | Relevant schedule/reservation | Membership, eligibility, capacity/timezone | Pending approval, full, waitlist, cancelled, window changed. |
| Feed/progress | Real activity/result | Optional social interaction and challenge context | First activity, no media, no eligible rank, stale computation. |
| Profile | Identity and memberships | Privacy, connections, help, workspace switch | Saving, invalid image, permission change, request pending. |
| Gym Today | Current schedule and actionable exceptions | Factual summaries with freshness | No classes, no arrivals, failed section, stale data. |
| Members/staff | Searchable list and scoped detail | Filters, invites and audit context | No members, no matches, denied edit, partial bulk result. |
| Classes/check-ins | Schedule/roster/arrival task | Capacity, eligibility, attendance | Double action, time boundary, already checked in, cancelled. |
| Coaching | Selected athlete and next plan/session task | Messages, notes and progress | No assignment, unsaved draft, switched athlete, partial send. |
| Platform overview/gyms | Cases requiring review and tenant lookup | Verified source status and supporting metrics | No cases, query failure, missing source, restricted access. |
| Access/governance | Scoped request and authoritative status | Reason, duration, impact and audit | Unauthorized, expired, approval needed, unavailable module. |

## Interaction And Accessibility Floor

- One dominant task per compact surface; supporting tools use familiar labeled icons.
- Stable toolbar/control dimensions; long names and translated text wrap safely.
- Use labels, selected state, errors and focus independent of color. Status dots
  never substitute for status text or a verified health check.
- Mobile navigation is not a squeezed desktop sidebar. Preserve scroll position,
  dismiss overlays deliberately and return focus to the trigger.
- Dialogs/drawers have names, focus containment, Escape, and unsaved-work protection
  where data loss is possible. Disabled controls have a meaningful reason nearby.
- Tables may scroll inside a named region; primary content must not disappear
  behind fixed navigation. Dense operational screens stay restrained and scannable.
- Keyboard, screen-reader, contrast and zoom checks accompany responsive tests.
  Proposed accessibility target is WCAG 2.2 AA, not a certification claim.
- Use established tokens/components; no blanket palette replacement, decorative
  dashboard heroes, fake numbers, nested section cards or unnecessary animation.

## Test Matrix

| Dimension | Minimum coverage |
| --- | --- |
| Identity | Signed out, unconfirmed, active, pending activation, disabled, stale session, ordinary member and active operator. |
| Gym roles | Leader/owner, officer, coach, member; pending/inactive membership; two gyms; unsupported privilege attempt. |
| Device | 320/390px phone, tablet, desktop; portrait/landscape for gym tasks; actual native device for native release. |
| Data | Empty, typical, large/paginated, long names, no search results, mixed statuses. |
| Network | Slow initial load, failed section, failed mutation, partial success, expired callback, retry after commit. |
| Continuity | Deep link, browser Back, refresh, new tab, role/gym/athlete switch and interrupted draft. |
| Safety | No permission widening, no tokens in URLs/logs, private defaults, explicit high-impact confirmation. |

Use loopback fixtures and disposable environments. Existing hosted penetration
scope, account reset and security release gates stay separate from UI approval.
No migration, payment, provider secret, role grant or data-sharing rollout is implied.

## Measurement And Research

Measure completion of the journey, not clicks on a disconnected action. Establish
baselines before setting targets: first workout/booking, repeat training, staff
task completion, coaching handoff and scoped support resolution. Record sample
size, time-to-task and recoverable failure category, not health or identity payloads.

Suggested first usability tasks: accept a gym invite; find and log today's session;
recover a failed proof upload; book then cancel a class; find and check in a member;
assign an athlete plan; open and end a scoped operator support session. Observe
where users hesitate without teaching them the interface during the task.

## Review Gate

Confirm priority audience and release goal, then approve the first slice before
page redesign begins. Capture confirmed product truth in Impeccable `PRODUCT.md`;
record the incumbent visual system separately instead of inventing a new brand.
Design and code changes must preserve authorization and existing release gates.
