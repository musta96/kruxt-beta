# From Customer Friction To KRUXT Decisions

Decision brief, 2026-10-23. Recommendations below are hypotheses and proposed
acceptance gates, not proof that KRUXT already outperforms its competitors.

## Evidence Coverage

The two review ledgers contain **62 coded complaint observations across 31
products**, drawn from 39 testimony source URLs/pages. One review can supply
several observations; this is not 62 independent customers. Negative-search
selection, syndicated reviews, index-only access, older versions, unresolved
dates and counterexamples prevent prevalence or comparative failure-rate claims.
It is a broad discovery sample, not all negative feedback on the internet.

- [Gym/coaching ledger](review-mining-gym-coaching-2026-10-23.md): 29 observations,
  26 selected review/post units, 16 pages, 14 products.
- [Athlete/social ledger](review-mining-athlete-social-2026-10-23.md): 33
  observations, 23 testimony URLs, 17 products; social-control observations are
  grouped, not a claim of identical ranking mechanisms.
- [Market horizons](market-horizons-2026-10-23.md): 16 primary-source entries,
  dated observations separated from inferences, scenarios and missing evidence.

Parent spot-checks directly opened Glofox's Trustpilot page, the Peloton thread,
ACSM's 2027 announcement, EuropeActive's 2026 release and the Commission's 2026
survey summary. This checks selected claims and does not independently verify
every ledger row. Some Capterra pages and Reddit threads could not be opened;
their indexed text is explicitly weaker evidence.

## What We Should Avoid

| Customer friction / evidence | KRUXT decision | Current status / acceptance gate |
| --- | --- | --- |
| Ambiguous saves, missing values and duplicate uploads; athlete R1, gym 20/26/27 | Training is the durable object; feed/media/XP are separate outcomes. | Private-first receipt and retry separation are locally tested. Durable unsaved set/draft recovery and server-wide idempotency remain unfinished. Test interruption before as well as after final save. |
| Staff repeatedly need a laptop; gym 01/10 | Finish roster, attendance and permitted booking tasks on phones. | Responsive shells are done locally; every staff job still needs device/task acceptance. Do not count a responsive sidebar as mobile workflow completion. |
| Seat, pass, payment and attendance disagree; gym 04/08/11/12/16, athlete R10 | Confirm the purchased outcome, not a disconnected transaction. | Test payment authorization, entitlement and reservation together, concurrent waitlists and auditable attendance corrections. Do not mark paid/booked/refunded without the matching receipt. |
| Surprise add-ons, fees and cancellation friction; gym 21, athlete R10 | Show total price, fee owner, cancellation deadline/timezone and durable confirmation. | Required before monetized pilots. Do not invent a current pricing advantage or hide cancellation behind a bot. |
| Support repeats instructions or vendors pass responsibility; gym 15/25/28 | One case owner and an explicit repair state. | Track request accepted, delivered, action completed and corrected separately. Password-reset acceptance did not prove delivery; the owner has now reported completion. |
| Discovery ignores equipment, saved state or prior context; athlete R4/R6 | Constraint-first discovery and continuity before ranking volume. | Personal saved sessions are the library default. Equipment exclusion semantics, retained filters/scroll and reviewed catalog provenance are still work. |
| Unwanted followers/content; athlete R2/R5 | Private defaults; optional Following/My Gym; working negative controls. | Client foundations are locally tested. Server-wide block/media revocation, moderation operations and appeals still gate broader publishing. |
| Streak dread and illness/rest penalties; athlete R3 | Reward chosen consistency and return, not maximal volume or compulsory posting. | Fair challenge deferred: current scoring allows repeated increments without unique evidence. Rest-aware rules require server implementation and comprehension testing. |
| Missing history after changing devices/gyms; athlete R1/R8 | User-controlled continuity and export, not lock-in. | Verified account-scoped handoffs are local. Full export, multi-device reconciliation and former-gym boundaries remain acceptance gates. |
| Authority and scope are confusing; operator audit, separate from review evidence | All six real roles, actual grant provenance, explicit allow/deny/inherit and protected administration. | Local editor/service and forward hardening migration passed isolated tests. Named custom roles, role assignment and invitations are not implied by a permission label. No live grants were changed. |

## Market Direction Worth Testing

**Observed:** ACSM's 2027 professional survey was released on 2026-10-20;
wearables, mobile apps, older-adult programs, strength and group fitness remain
prominent. It is a professional expectations survey, not a consumer purchase
forecast. [ACSM source](https://acsm.org/2027-fitness-trends/).

**Observed:** the Commission's September 2026 EU summary identifies time,
motivation and price as participation barriers. EU averages do not establish
Italian demand for KRUXT.
[Commission source](https://belgium.representation.ec.europa.eu/actualites-et-evenements/actualites/semaine-europeenne-du-sport-les-belges-et-les-europeens-bougent-plus-quavant-2026-09-22_fr).

**Observed:** EuropeActive/Deloitte reports growing club membership and revenues
for 2025. Sector growth does not establish independent-gym software budgets or
KRUXT's obtainable revenue.
[EuropeActive source](https://www.europeactive.eu/blog/press-corner-4/strong-growth-in-members-and-revenues-for-european-health-fitness-market-in-2025-140).

**Our inference:** a useful initial position is dependable, affordable training
continuity with accountable coaches and optional local belonging. It is broader
than an elite-athlete feed but narrower than replacing every gym system.

- **Now to 18 months:** validate reliable private utility, inclusive strength,
  coach follow-through and small local groups. Short sessions, optional devices
  and accessible text-first workflows address practical constraints.
- **Two to three years:** if reviewed AI assistance saves actual coach time,
  use it for accountable drafting and summaries. Integrate only workflows that
  eliminate double entry and survive independent-site renewal.
- **Four to seven years:** a permissioned cross-venue participation network is
  one scenario. Platform bundling, budget pressure or weak social demand could
  instead favor a focused private utility. Preserve portability and reversible
  integrations so the business can adapt.

These are planning horizons, not predictions. The market report contains
disconfirming triggers and bounded experiments; no automation or recruitment is
created by this document.

## Defensibility To Earn

1. **Reliable, permissioned history:** trustworthy workout/booking/media
   reconciliation, provenance and repair operations that users can export.
2. **Dense useful relationships:** reciprocal athlete/coach/gym connections in
   local clusters. More posts without incremental repeat training is not a moat.
3. **Embedded coach/staff workflows:** demonstrable net time saved and fewer
   mistakes, not additional compulsory admin work.
4. **Credible original content:** attribution, versioned plans, reviewed claims,
   staffed safety and a real path from useful content to optional participation.
5. **Operational discipline:** known support, moderation, integration and media
   cost per retained cohort. Founder labor cannot be treated as free.

AI access, a TikTok-like feed, badges, collected health data and artificial data
lock-in are not independently defensible advantages. Social content can remain a
valuable product in its own right, but must earn its delivery and safety costs;
private-only users must retain full training utility.

## Next Funded Slice

Operator write-boundary tests now pass locally. Reconcile migration lineage and
canonical permission mapping; keep custom-role creation on hold. Then prioritize durable drafts/server idempotency,
booking/payment reconciliation and server-side social safety before widening
Discover/challenges. The original eight-part delivery request is not complete.

After explicit hosted-scope approval and release readiness, run the existing
[pilot protocol](pilot-validation-protocol.md). The owner currently authorizes
isolated fixtures only. Use completed training, week-4/week-8 repeat activity,
unassisted task completion, net staff effort, safety incidents and contribution
after media/support/moderation costs. Set baselines before targets and retain
failed or inconclusive results rather than explaining them away with trends.
