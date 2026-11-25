# KRUXT User Journey Map

Draft product/design discovery, 2026-10-22. Evidence baseline: `82853d1`.
Scope: member web, native athlete routes, gym admin, platform console, and their handoffs.
This is a source-backed current-state map and proposed future-state brief, not user research or live UAT.
Priority audience and invited-beta versus public-launch goal await owner confirmation.

Research extension: [competitive strategy](competitive-strategy-2026-10-22.md),
[31 competitor dossiers](competitors/README.md), and the dedicated
[social/short-video/gamification brief](social-gamification-brief.md). The latter
adds three first-class journeys (S01 discovery, S02 creation, S03 competition)
to the twelve operational journeys below. Social is not merely an account utility.

## Executive View

KRUXT has three connected jobs, not one universal dashboard:

1. Athlete: know what to train, record it, and see meaningful progress.
2. Gym: bring members in and run today's coaching, classes, and attendance.
3. Platform operator: resolve tenant and access issues without losing control of permissions or data.

The proposed value loop is:

```text
Gym prepares service -> member joins -> member trains/books -> gym delivers
       ^                    |                  |                 |
       |                    v                  v                 v
       +-------------- support/recovery <- progress <- attendance/results
```

Design complete journeys before decorating individual pages. A successful login,
an attractive dashboard, or a created booking is not the whole outcome.

## Evidence And Confidence

| Label | Meaning |
| --- | --- |
| Source-backed | Route, component, service call, or state exists at the baseline revision. |
| Fixture-tested | Automated local/CI coverage uses controlled data; not real-user acceptance. |
| Prototype | Static/mock data, inert controls, or missing persistence in the inspected page. |
| Proposed | Future experience or measurement, not shipped behavior. |
| Unverified | Needs real account, provider, legal, hosted, or physical-device evidence. |

Auth/recovery and browser compatibility have fixture coverage. That does not prove
every journey works with hosted data. `READINESS.md`, `SECURITY_READINESS.md`, and
existing PRs remain release gates, not statements that the current checkout is complete.
Older route/readiness documents are historical inputs; inspected source wins on conflicts.

## People, Context, And Success

| Actor | Situation and job | Successful outcome | Important constraint |
| --- | --- | --- | --- |
| New athlete | Arrives from a gym invite/QR or public entry; uncertain which account to use | Correct identity activated; required policies reviewed; first useful activity reached | Do not force staff signup or duplicate accounts. |
| Returning athlete | Phone in a training session, limited attention | Resume plan, save training reliably, choose whether to share | Avoid social/public defaults and lost drafts. |
| Gym owner/manager | Setting up the gym or supervising delivery | Members and staff can use the correct gym; today's work is actionable | Tenant context and server permissions must remain explicit. |
| Front-desk staff | Rapid repeated lookup, booking and attendance | Correct member checked in with clear eligibility/outcome | Phone/tablet efficiency; no unnecessary finance/governance exposure. |
| Coach | Prepares training and reviews athletes | Assigned plan reaches athlete; session/result can be followed up | Coach is a gym role/capability, not an assumed operator. |
| Platform operator | Investigates tenant problems and sensitive requests | Correct case resolved with scoped access, reason, outcome and audit | No implicit impersonation or UI-only authorization. |

These contexts are design hypotheses grounded in the existing feature set, not
validated interview findings. Confirm them with representative pilot users.

## Entry, Identity, And Handoffs

```text
Public site / gym invite
  -> choose athlete or gym workspace
  -> authenticate existing identity or create ordinary identity
  -> resolve activation, required policies, role and gym independently
  -> resume original safe destination

Platform sign-in -> active operator check -> platform console
  -> select tenant -> explicitly scoped support context -> gym workspace
  -> end support context -> return to operator queue
```

One backend does not mean one browser session: each hosted origin has its own
session storage. UI must explain a required sign-in without suggesting another
account must be created. Preserve only validated internal destinations and
non-secret gym context. Never move tokens in cross-app links.

## J01 - Discover And Enter The Right Workspace

| Stage | Current touchpoint/evidence | Desired experience | Failure/recovery |
| --- | --- | --- | --- |
| Understand | Web `/`, `/product`, `/for-athletes`, `/for-gyms`, `/pricing` | Literal product/audience orientation; returning-user entry remains obvious | Do not present an unavailable capability as already live. |
| Choose | `AuthGateway.tsx`, marketing chrome, gym-admin URL helper | Member and gym entry are distinct; operator entry remains restricted | Wrong portal offers a deliberate switch, not another registration. |
| Continue | Web role resolver can route to `/admin` or `/org` | Preserve task intent; dual-role people choose workspaces deliberately | A member following a class link returns to that class, not an unrelated dashboard. |

Completion: user reaches the intended sign-in/task, not merely a CTA click.
Proposed measure: correct-workspace arrival rate and wrong-workspace recovery rate.

## J02 - Join, Activate, And Complete First Use

| Stage | Current touchpoint/evidence | Desired experience | Failure/recovery |
| --- | --- | --- | --- |
| Arrive | `/join`, `/accept-invite`, `/activate-invite`; invite clients | Recognize gym and invite state without exposing private details | Expired/revoked/used invite has a safe request-new-invite path. |
| Authenticate | Web auth gateway; native `(auth)` routes | Existing/new account paths stay distinct; show email-confirmation state | Wrong email, pending email confirmation, provider cancellation and offline error are separate. |
| Activate | Activation client, server profile/activation checks | One continuous journey with explicit completion | Already-active accounts continue; disabled accounts do not loop through signup. |
| Review | `RequiredConsentReview`; native `(onboarding)` routes | Review bound required policy versions; separate optional marketing choices | Missing/unverifiable policy blocks safely with retry/help, not fake acceptance. |
| Choose gym | Join flow, native gym-select | Preserve invited gym; distinguish choosing affiliation from approved membership | No eligible gym is a useful state, not a backend error. |
| First value | Member `/plan`, `/log`, gym classes | One relevant next action: train, start a plan, or book | Empty account offers a real task rather than an empty feed. |

Completion: server-verified activation and required policies, then first saved
workout or confirmed booking. Account creation alone is not activation.
Proposed measures: stage conversion, median/p90 time to first value, invite expiry rate.
Open verification: approved legal content, live invite/email behavior and native gate parity.

## J03 - Return, Train, And Save A Workout

| Stage | Current touchpoint/evidence | Desired experience | Failure/recovery |
| --- | --- | --- | --- |
| Orient | `/plan`, `/library`, `/log` | Today/next session first; distinguish assigned plan from own plan | No assigned plan offers exercise/template selection. |
| Prepare | Plan/library screens and workout-plan import helpers | Plan context carries into logger; editable before committing | Unsupported import stays recoverable without deleting existing work. |
| Record | `LogScreen.tsx`, workout-log helpers; native log/logger modules | Clear exercises, sets, units, progress and one save action | Preserve input on validation/network failure; prevent duplicate submissions. |
| Save | Workout atomic RPC/service boundary | Persisted result is the success point | Workout saved but proof failed is partial success, not a failed workout. |
| Finish | Proof/feed handoff | Summary and next action; sharing optional and visibility explicit | Retry media independently; do not re-log workout to retry upload. |

Completion: exactly one persisted workout with a recoverable draft until confirmed.
Proposed measures: successful-save/attempt rate, duplicate rate, abandoned drafts,
time from opening logger to first recorded set. Never collect exercise/health payloads
in generic UX telemetry.

## J04 - Find, Book, Attend, Or Cancel A Class

| Stage | Current touchpoint/evidence | Desired experience | Failure/recovery |
| --- | --- | --- | --- |
| Find | `/gyms`, `/gyms/[gymId]/classes`, `/guild` | Gym, local date/time, instructor, capacity and eligibility visible together | No classes, no membership and query failure must be distinguishable. |
| Decide | Gym classes screen and class service | Booking and waitlist outcomes are clearly different | Slot lost to another booking offers refreshed availability. |
| Reserve | Booking/waitlist/cancellation contracts in class lane | Confirm server outcome; show reserved versus waiting | Duplicate click is idempotent; no success before response. |
| Return | Booking summary entry point, gym schedule | Find reservation and cancellation without repeating discovery | Cancellation cutoff, cancelled class and promoted waitlist have clear outcomes. |
| Attend | Admin classes/check-ins | Member/staff share class and reservation identity | Duplicate scan/check-in shows prior success; denied access gives next action. |

Completion: booking reaches attendance, cancellation, or explicit no-show outcome.
Proposed measures: discovery-to-confirmed-booking, waitlist promotion, attendance,
cancellation completion and duplicate mutation rate. Hosted concurrency/UAT still required.

## J05 - Progress, Community, And Return

Current web routes: `/feed`, `/guild`, `/rank`, `/profile`. Active native tabs are
Feed, Gyms, Log, Profile and conditional Work; native guild/rank route files exist
but are not reachable through the configured runtime.

Sequence: finish activity -> optionally attach proof -> select audience -> publish
-> interact -> inspect progress/challenge -> return to the next training action.

Design opportunity: training completion should produce a meaningful private result
before prompting public engagement. Rank/guild must explain no eligible activity,
no membership and unavailable recomputation separately. Never fabricate rank freshness.

Recovery cases: proof upload failure, unavailable media, removed post, denied action,
empty leaderboard, recomputation failure and lost network. Native feature modules
are not evidence that every shipped tab reaches those modules.

Completion: useful progress understood and a deliberate next activity chosen.
Proposed measures: repeat workout users in a defined seven-day cohort, progress-view
return to training, optional-share completion. Do not optimize forced sharing.

## J06 - Recover Access, Manage Privacy, Or Get Help

Current touchpoints: admin/platform `/forgot-password` and `/reset-password`,
member `/profile`, `/privacy`, `/support`, `/integrations`; native change-password/edit-profile.

Sequence: identify problem -> choose reset/help/privacy action -> submit once
-> understand current state -> receive result -> return or sign out safely.

Critical distinctions: bad credentials versus no role; ordinary sign-in versus
verified password recovery; privacy request received versus fulfilled; export
ready versus expired; connector enabled versus successfully syncing.

Recovery must include expired/missing links, unsupported providers, revoked
permissions, failed upload, unavailable export, and pending manual review. Account
deletion must not be styled as an immediate one-click completion if work is queued.

Completion: access restored, request outcome actually delivered, or support case
has a reference and next status. Google/Apple controls exist, but live providers
were disabled in the last DEV check. Hosted recovery redirect/email verification
remains separate from the fixture-tested UI.

Proposed measures: reset request-to-completion, support resolution, request aging
and delivery failure counts. No tokens, emails, ticket text or request contents in analytics.

## J07 - Set Up A Gym And Invite The First People

Current touchpoints: admin no-gym gate and `GymOnboardingForm`, settings,
members/profile invites/staff; platform tenants and web `/admin/gyms` are alternative paths.

Sequence: sign in -> distinguish no gym from failed gym lookup -> create/select
authorized gym -> establish identity/timezone -> prepare required policies/service
-> invite staff/member -> observe invite/activation state -> deliver first session.

The admin gym context currently converts lookup errors into `noGymFound`, which
can incorrectly show gym creation during a backend failure. This is a first-run
journey defect, not just copy polish. Staff waiting for an invite must not be
encouraged to create an unintended gym.

Completion: one correctly scoped staff account and one member can complete the
first scheduled/training task. A saved gym record alone is not gym activation.
Proposed measures: time to operational gym, invite acceptance, setup abandonment.

## J08 - Run Today's Gym Operations

Current routes: admin `/`, `/members`, `/classes`, `/checkins`, `/staff`, `/waivers`.

Sequence: select gym -> inspect actionable schedule/issues -> find member/class
-> inspect eligibility -> book/promote/check in -> see persisted outcome -> continue queue.

Proposed homepage: today's work and exceptions before aggregate reporting.
Preserve selected gym, date, roster filters and return location. Read-only roles
must not discover restrictions only after filling an edit form.

Completion: staff handles a real booking, attendance, or membership exception
without a fallback spreadsheet. Phone prioritizes lookup, schedule, attendance;
deep configuration remains a desktop/tablet task.
Proposed measures: task success, time to find/check in a member, retries, wrong-gym
near misses and permission denials. Baselines must be established, not invented.

## J09 - Coach An Athlete Through A Plan

Current touchpoint: admin `/coaching` and coaching services; member `/plan` and `/log`.

Sequence: find eligible athlete -> inspect assignment/history -> prepare or choose
template -> assign/publish plan -> athlete sees assignment -> logs work -> coach reviews/follows up.

Separate draft, assigned and completed states. Carry athlete and gym identity
through edits. Save confirmation must refer to persistence, not merely closing a
drawer. Inspect whether a submitted assignment is visible in the actual member
surface; two independently built pages do not prove the handoff.

Completion: assigned plan reaches the intended athlete and a completed activity
returns to a reviewable context. Proposed measures: assignment-to-first-session,
unassigned athletes and plan-save failures. Coach capability and real-device
acceptance need explicit validation.

## J10 - Manage Gym Administration And Service Health

Current routes: admin `/billing`, `/waivers`, `/integrations`, `/compliance`,
`/support`, `/settings`, `/staff`, `/preview`.

Sequence: choose issue or setting -> review gym-specific state -> inspect impact
-> authorized change -> persisted confirmation/audit -> verify resulting experience.

Distinguish member billing from gym-to-KRUXT subscription, waiver from platform
policy consent, gym support from operator delegation, and member preview from a
real member session. Preview must not silently gain member mutation capabilities.

External dependencies: payments/providers, legal documents, privacy processors,
notifications and support operations. UI may show unavailable state but must not
claim these services are connected or compliant without evidence.

Completion: setting/service outcome verified in the affected journey, not only saved.
Proposed measures: failed service actions, outstanding administrative tasks and
time to resolve an issue. No live billing or new data-sharing activation in this design pass.

## J11 - Operate KRUXT And Support A Tenant

| Stage | Current evidence | Proposed experience | Boundary |
| --- | --- | --- | --- |
| Enter | Platform `/login`, operator context | Distinguish authentication, operator access and query failure | No public operator signup or self-granted role. |
| Triage | Platform `/` reads live tables | Prioritized queues, freshness and unavailable-source states | Unknown is not zero; query failure is not no alerts. |
| Find tenant | `/tenants` | Search, inspect tenant, choose task | Preserve tenant and intended return path. |
| Enter workspace | `ensureOperatorGymSession`, admin URL handoff | Show requested scope, reason, duration and visible support context | Current helper can create self-approved grants; review policy/RLS before extending this path. |
| Resolve | Gym admin handoff | Task result plus explicit end/return | Session storage is not cross-origin single sign-on. |
| Review access | `/operators`, role/capability RPCs | Read current permissions, explain changes, reason and audit | Client hiding is not authorization. |

Completion: tenant issue resolved under authorized, expiring, auditable access and
operator returns to the queue. Proposed measures: resolution time, orphan support
sessions, failed handoffs, access denials and reviewed permission changes.

## J12 - Govern Data, Revenue, And Platform Configuration

Current platform routes: `/support-access`, `/features`, `/data-governance`,
`/revenue`, `/addons`, `/marketplace`, `/analytics`, `/settings`.

Several baseline pages use static data and inert actions. Examples:
`mockGrants` in support-access; `mockReleases` and random partner export counts in
data-governance; fixed analytics history; settings advertising enabled MFA and a
"GDPR Compliance Mode" without reading configuration. These are prototypes,
not evidence of active security controls, data releases, business results or compliance.

Proposed sequence: inspect real request/configuration -> verify authority and
impact -> authorized action/approval -> persisted outcome and audit -> monitor.
Unavailable modules must not look like operational queues. Preserve existing
truthfulness repairs in PR #112 during integration rather than building a second
competing solution. No new approval/data-release wiring as a cosmetic UX change.

Completion: authoritative state and audited outcome, not a simulated success.
Proposed measures: pending request age, verified action success, audit completeness
and stale/unavailable sources. Production/legal/security signoff is separate.

## Proposed Information Architecture

This is a recommendation for confirmation, not a route migration already made.

| Surface | Primary navigation | Secondary/contextual destinations |
| --- | --- | --- |
| Member web | Plan, Feed, Log, Gyms, Profile (proposed) | Feed has Following/Discover/My gym and direct community/challenge access; Library under Plan; integrations, privacy and support from Profile. Social-led versus training-led default requires testing. |
| Gym admin | Today, Members, Classes, Check-ins, Coaching | Staff, waivers, billing, integrations, compliance, support and settings grouped by job and capability; preview is a contextual action. |
| Platform | Overview, Gyms, Operators, Governance | Revenue/catalog/analytics only as clearly scoped available modules; task-specific context in page header. |
| Native | Training, logging, community and account priorities aligned with web | Preserve native navigation conventions; do not copy a desktop sidebar onto phone. |

Keep old URLs reachable through existing authorization gates; navigation changes
must not break deep links. Do not redirect user intent solely because they also
have a staff role. Name the current workspace and gym, especially during support.

## Route Inventory

All paths below are relative to their own app origin. Equal paths are not the same workspace.

| App | Route family | Journey coverage |
| --- | --- | --- |
| Web | `/`, `/product`, `/for-athletes`, `/for-gyms`, `/pricing`, `/contact` | Discover/entry J01. |
| Web | `/join`, `/accept-invite`, `/activate-invite` | Gym entry, invitations and activation J02. |
| Web | `/plan`, `/library`, `/log` | Training J03; coaching handoff J09. |
| Web | `/gyms`, `/gyms/[gymId]/classes` | Booking and gym discovery J04. |
| Web | `/feed`, `/guild`, `/rank`, `/profile` | Community/progress J05; account J06. |
| Web | `/privacy`, `/support`, `/integrations` | Help, data rights and connections J06. |
| Web | `/legal/terms`, `/legal/privacy`, `/legal/cookies` | Public notices; not proof of approved onboarding policy bindings. |
| Web | `/admin`, `/admin/gyms`, `/admin/users`, `/admin/invites`, `/admin/classes` | Legacy founder/backoffice J07/J08/J11. |
| Web | `/org`, `/org/users`, `/org/invites`, `/org/classes` | Legacy gym operations J07/J08. |
| Admin | `/login`, `/forgot-password`, `/reset-password` | Identity/recovery J02/J06/J07. |
| Admin | `/`, `/members`, `/staff`, `/classes`, `/checkins`, `/coaching` | Gym setup and daily work J07-J09. |
| Admin | `/billing`, `/waivers`, `/integrations`, `/compliance`, `/support`, `/settings`, `/preview` | Gym administration J10. |
| Platform | `/login`, `/forgot-password`, `/reset-password` | Restricted operator entry/recovery J06/J11. |
| Platform | `/`, `/tenants`, `/operators` | Triage, tenant and permission operations J11. |
| Platform | `/support-access`, `/features`, `/data-governance`, `/revenue`, `/addons`, `/marketplace`, `/analytics`, `/settings` | Governance/business operations or prototypes J12. |
| Native active | `index.js -> App.tsx -> src/native/NativeApp.tsx` | Server-verified auth/onboarding gate, invite handling, Feed/Gyms/Log/Profile and conditional Work. |
| Native dormant | `src/app/(auth)`, `(onboarding)`, `(tabs)`, edit-profile/change-password | Alternative Expo Router implementation, not the configured entry point; do not count as reachable features. |

## Cross-Journey Service Blueprint

| User-visible moment | System responsibility | Required feedback | Operational owner |
| --- | --- | --- | --- |
| Signed in | Verify session separately from activation, policies and roles | Correct next step or specific recoverable gate | Auth/backend + client |
| Invited | Deliver expiring invite and validate issuer/target/state | Sent/pending/accepted/expired; never pretend delivery | Gym/platform + email ops |
| Gym selected | Resolve authorized membership/support scope | Persistent tenant identity; explicit switch | Gym auth/RLS |
| Workout saved | Atomic persistence and independent proof upload | Saved result; partial upload outcome | Training/storage |
| Class booked | Transactional capacity/waitlist and eligibility | Authoritative reservation state | Booking/backend |
| Plan assigned | Persist assignment and surface to member | Assignment and acknowledgement status | Coaching/member |
| Privacy request submitted | Queue, process, deliver and expire artifacts | Trackable status; honest timing | Privacy operations |
| External service enabled | Verify provider, delivery and sync freshness | Connected is separate from last successful sync | Integrations/operations |
| Support access used | Validate scope/duration and audit lifecycle | Visible support context; explicit expiry/end | Platform governance |

## Validation Plan

1. Establish baseline with task-based sessions: new athlete, returning athlete,
   gym owner, front desk, coach and operator. Include a dual-role user and a user
   with no gym. Do not invent interview quotes or conversion data.
2. Walk signup/invite, first workout, booking/cancel, staff check-in, plan assignment,
   and support handoff across desktop and phone; include tablet for gym operations.
3. Cover first-run, empty, loading, offline/query failure, denied, expired, stale,
   partial success, duplicate submission and back/refresh for every mutation journey.
4. Run keyboard and screen-reader checks, visible focus, contrast, long names,
   zoom and narrow layouts. Propose WCAG 2.2 AA as the design target; not a certification.
5. Use disposable accounts for hosted acceptance. No real-user penetration testing,
   production writes, payments or data-release activation in this work.

## Measurement Contract - Proposed, Not Instrumented

Use explicit journey stages and authoritative completion events rather than page
views as success. Report sample size, cohort definition, median/p90 duration and
failure reason buckets. No numeric conversion targets until a baseline exists.

Candidate events: `journey_started`, `journey_step_completed`, `journey_blocked`,
`journey_completed`, with allowlisted journey/step identifiers, coarse surface,
device class and non-sensitive error category. Do not include raw URLs/query
strings, tokens, email, names, workout/health content, ticket text or media.
Define purpose, lawful basis, retention and access before enabling telemetry;
keep audit/security logs separate from optional product analytics. Optional
analytics choices must not block the core journey.

## Decisions Before Implementation

- Which audience leads the first redesign slice?
- Is the immediate release an invited beta or public launch? The older pilot
  strategy recommends web-first; it is evidence, not a newly confirmed decision.
- Preserve the KRUXT brand and refine the existing product rather than rebrand?
  This is the working recommendation, not an invented aesthetic brief.
- Confirm one canonical gym backoffice and an intentional path for dual-role users.
- Confirm no-gym independent training versus gym-required activation rules.
- Confirm support-access policy before making operator handoffs easier or broader.

## Primary Source Index

- `apps/web/src/components/public/MemberShell.tsx`: eleven equal-priority member links.
- `apps/web/src/components/public/usePublicSession.ts`: post-auth workspace resolution.
- `apps/web/src/lib/auth/access.ts`: activation, consent, role and failure states.
- `apps/web/src/components/auth/AuthGateway.tsx`: public/account entry.
- `apps/admin/src/contexts/gym-context.tsx`: gym selection and error-to-no-gym collapse.
- `apps/admin/src/app/(dashboard)/layout.tsx`: no-gym onboarding and fixed desktop offsets.
- `apps/platform/src/app/(dashboard)/layout.tsx`: fixed sidebar/main offsets on mobile too.
- `apps/platform/src/app/(dashboard)/page.tsx`: live overview, mixed loading/error/empty semantics.
- `apps/platform/src/services/operator-session-service.ts`: support-session handoff policy.
- `apps/platform/src/app/(dashboard)/support-access/page.tsx`: mock grants and inert actions.
- `apps/platform/src/app/(dashboard)/data-governance/page.tsx`: mock releases/random counts.
- `apps/platform/src/app/(dashboard)/settings/page.tsx`: unverified static control claims.
- `apps/mobile/package.json`, `index.js`, `App.tsx`, `src/native/NativeApp.tsx`:
  configured entry point and active tabs; onboarding uses server-verified state.
- `apps/mobile/src/app/_layout.tsx`: alternative, dormant Expo Router tree; its
  metadata gate must not be confused with the active runtime.
- `docs/strategy/pavia-pilot-distribution-and-surface-strategy-2026-02-20.md`:
  historical web-first pilot and phone operations guidance.
- `READINESS.md`, `SECURITY_READINESS.md`, PRs #112/#113/#118/#130/#131/#134:
  release and integration dependencies; do not infer they are all merged or deployed.

## Detailed Audit Corrections And Gaps

- Invitation types are distinct: `/join?code=` redeems gym membership codes;
  `/accept-invite?token=` accepts staff access and ends at `/org`;
  `/activate-invite?inviteId=&attempt=` uses an authenticated email-link session
  and profile activation. Do not collapse these into one generic invite page.
- Consent review during code redemption requires another redeem action afterward.
  Preserve intent and explain the remaining step rather than implying membership
  was already granted.
- Active native onboarding is server-verified, but inactive profiles can land in
  generic profile onboarding without an activation-specific recovery path.
- Web plan/library actions currently navigate to bare `/log` or `/plan`, losing
  selected program/day/template identity. Some scheduling/reordering controls
  change only component state; distinguish a preview from a saved plan.
- Web workout persistence precedes progress readback and proof upload. A later
  failure can fall through a generic submit error while retaining the draft.
  Preserve the committed ID and retry only unfinished work before polishing this flow.
- Active native logging is one exercise/one set, and its feed is a limited text
  list. Rich logger/proof modules elsewhere do not establish active feature parity.
- `GymClassesScreen.tsx` captures booking eligibility time once at mount; schedule
  refresh alone cannot update a booking-window boundary. This needs a focused
  time-transition regression, not just a screenshot.
- Admin check-ins are read-only, fetched once, and labeled Today/Live without a
  matching daily query/refresh contract. Search uses user IDs rather than member names.
- Admin waivers offer inert New Template/row actions. Support offers inert New
  Ticket/Reply/Assign/Resolve commands. Compliance exposes queue/metrics, not a
  complete staff fulfillment journey. Do not imply those operations are available.
- Admin invitations display role options broader than ordinary issuer authority;
  Owner/Admin/Staff/PT labels do not equal four independent permission profiles.
  Resolve effective authority before presenting sensitive commands.
- Admin gym setup has multiple writes; injected failure can leave partial setup.
  Backend atomicity/idempotency and error classification are prerequisites to
  a reliable first-run redesign.
- Coaching broadcasts are sequential; partial-send recovery must identify which
  recipients succeeded. Switching athletes must not carry stale drafts into a new context.
- Web integration connection creation can mark a connection active with provider
  handoff pending. Display authorization and sync success separately.

These findings are source-backed hypotheses for repair and tests, not exploit
demonstrations or observed production incident reports.

## Added Social Journeys

The [dedicated brief](social-gamification-brief.md) owns the detailed flow/state
contracts so they are not duplicated or drifted here:

- **S01 Discover to participate:** find enjoyable/relevant people and content;
  optionally carry a suitable session/class/challenge into a real completed task.
- **S02 Create and connect:** capture an original post or optional session recap,
  review audience/rights, publish reliably, receive feedback and manage the content.
- **S03 Belong and compete:** opt into a compatible community challenge, understand
  scoring/evidence, participate safely, resolve provisional/disputed outcomes and return.

These include Following/Discover/My gym views, an optional immersive short-video
viewer, independent training utility, creator attribution, cold-start supply,
notification controls, moderation, rights and media economics. Do not interpret
them as already implemented or as permission to profile private health information.
