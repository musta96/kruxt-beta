# KRUXT Lovable Prompt Master Pack (Beta v2)

Use prompts in strict order. Generate one module at a time, validate wiring, then commit.

## Operating Rules for Lovable Runs

1. Keep mobile screens iOS-first and thumb-friendly.
2. Keep admin screens desktop-first for gym staff operations.
3. Use KRUXT tone: short, declarative, proof-first.
4. Never change backend contracts or SQL table names in UI generation.
5. For each prompt, require explicit loading, empty, error, retry, and success states.
6. Add accessibility baseline: Dynamic Type, AA contrast, keyboard focus order, screen-reader labels.

## Global System Prompt (Run Once First)

```text
Create a design system for app name "KRUXT" with a premium guild/performance aesthetic.

Brand law:
- "No log, no legend."
- Voice is earned, direct, respectful, and non-toxic.
- Copy style: short declarative system rules (example: "Proof counts.", "Rank is earned weekly.").

Visual direction:
- Base colors: charcoal/graphite/off-white.
- Single electric accent: ion blue (#35D0FF).
- Sparse metallic secondary accents (steel/silver).
- No neon overload, no cartoon fantasy styling.
- Card surfaces feel like equipment panels (subtle borders, slightly chamfered corners).

Typography:
- Headline font: modern condensed sans.
- Body font: clean grotesk sans.
- Numeric stats: monospaced digits.

Create reusable tokens and components:
- Color tokens, spacing scale, radii, type scale.
- Buttons, tabs, cards, badges/sigils, list rows, data tables, form controls.
- Status palettes for success/warning/error/info.

Create app shells:
- Mobile shell: tabs [Proof Feed, Log, Guild Hall, Rank Ladder, Profile].
- Admin shell: sidebar [Overview, Members, Classes, Check-ins, Waivers, Billing, Integrations, Compliance, Support, Settings].
```

## Prompt 1: Mobile Auth + Onboarding + Policy Consent

```text
Create module "OnboardingFlow" for KRUXT mobile app.

Flow steps:
1) Welcome (brand statement + CTA "Log to claim")
2) Auth options (email + social auth + Sign in with Apple placeholder)
3) Create profile (username, display name, avatar, units)
4) Select home gym (search + join request if private)
5) Required policy consents (terms, privacy, health data)
6) Completion screen with CTA "Enter Guild Hall"

Data contracts (do not rename):
- createPhase2OnboardingUiFlow.load
- createPhase2OnboardingUiFlow.submit
- policy service methods from apps/mobile/src/services/policy-service.ts
- profile service methods from apps/mobile/src/services/profile-service.ts
- gym service methods from apps/mobile/src/services/gym-service.ts

UX constraints:
- Max 1 primary action per screen.
- Keep each screen under 2 scroll lengths on iPhone 15 Pro viewport.
- Show exact validation text for missing required fields.
- If consent missing, block protected actions with explicit reason.

Microcopy:
- "Proof counts."
- "Rank requires consent to current policy."
- "Guild access starts when profile is complete."
```

## Prompt 2: Workout Logger (Sub-60s)

```text
Create module "WorkoutLogger" optimized for <60-second logging.

Screen structure:
- Header with chain/rank context.
- Exercise blocks list.
- Sticky CTA footer.

Required fields:
- workout_type
- title
- started_at / ended_at
- visibility (public/followers/gym/private)
- exercises with sets (reps, weight_kg, rpe, distance_m, duration_seconds)

Advanced structures:
- block types: straight_set, superset, circuit, emom, amrap
- set duplication, reorder, quick increment controls
- optional notes and RPE summary

Data contract:
- Call log_workout_atomic RPC through workout service + createPhase3WorkoutLoggerUiFlow.
- After success, route to feed detail and show XP/rank delta panel.

Edge states:
- Partial draft recovery after app close.
- Offline submit queue placeholder state.
- Duplicate submit protection (disable CTA while pending).

Primary CTA labels:
- "Post Proof"
- Loading state: "Claiming..."
```

## Prompt 3: Proof Feed + Social Graph

```text
Create module "ProofFeed" (mobile home feed).

Feed card elements:
- user identity row (avatar, display name, gym chip)
- workout summary (type, duration, total sets, total volume)
- PR/sigil indicators
- caption
- social action bar

Actions:
- reactions (fist, fire, shield, clap, crown)
- comments + reply threads
- follow/accept states where relevant
- report/block quick actions from overflow menu

Data contracts:
- createPhase4ProofFeedUiFlow.load
- createPhase4ProofFeedUiFlow.react
- createPhase4ProofFeedUiFlow.comment
- createPhase4ProofFeedUiFlow.report
- createPhase4ProofFeedUiFlow.block

Feed quality requirements:
- infinite scroll
- pull to refresh
- skeleton loading cards
- blocked/reported content hidden or replaced with safe placeholder

Copy constraints:
- "Post the proof."
- "Protect the chain."
- "Rank decays without receipts."
```

## Prompt 4: Guild Hall (Member + Staff Split View)

```text
Create module "GuildHall" with role-aware view rendering.

Member view:
- active membership summary
- upcoming classes
- waitlist status
- recent check-ins
- waiver/contract acceptance status

Staff view (if user role is leader/officer/coach):
- today operations board
- capacity and waitlist pressure
- unresolved waiver/contract tasks
- check-in anomalies

Data contracts:
- gym service methods in apps/mobile/src/services/gym-service.ts
- createPhase5B2BOpsFlow snapshot patterns where available

Interaction rules:
- member actions never expose staff mutations
- staff controls require explicit confirm dialogs

Theme:
- use banner + sigil language without fantasy roleplay styling
```

## Prompt 5: Admin Members + Roles Console

```text
Create admin module "MembersConsole" for desktop.

Required capabilities:
- member search and segmented filters
- role assignment (leader/officer/coach/member)
- membership status actions (trial/active/past_due/paused/cancelled)
- profile side panel with timeline

Data contracts:
- B2BOpsService list/update methods
- createPhase2StaffConsoleUiFlow for queue + refresh behavior

Table UX:
- sticky header
- bulk action support for staff-only actions
- column visibility presets
- audit note required for role-change actions
```

## Prompt 6: Admin Classes + Waitlist + Check-ins

```text
Create admin module "OpsConsole" for class operations.

Include:
- class calendar/day list
- booking status table
- waitlist queue with promote action
- check-in monitor with denied/override outcomes
- waiver acceptance panel

Data contracts:
- createPhase5OpsConsoleUiFlow
- apps/admin/src/services/b2b-ops-service.ts

Concurrency safeguards:
- optimistic UI with conflict resolution banner
- disable duplicate promote actions while pending
- always refetch class occupancy after mutation
```

## Prompt 7: Integrations Hub (Mobile)

```text
Create module "IntegrationsHub" in mobile profile area.

Providers list (ordered):
1) apple_health
2) garmin
3) fitbit (disabled)
4) huawei_health (disabled)
5) suunto (disabled)
6) oura (disabled)
7) whoop (disabled)

Each provider card:
- connection status
- last sync timestamp
- last error
- CTA based on status (Connect / Reconnect / Sync now / Coming soon)

Secondary section:
- sync jobs list
- import mapping summary
- duplicate activity warning panel

Data contracts:
- createPhase6IntegrationsUiFlow.load
- createPhase6IntegrationsUiFlow.connectProvider
- createPhase6IntegrationsUiFlow.disconnectProvider
- createPhase6IntegrationsUiFlow.queueSync
```

## Prompt 8: Integration Monitor (Admin)

```text
Create admin module "IntegrationMonitor" focused on sync reliability.

KPI cards:
- monitored members
- active connections
- unhealthy connections
- failing/retrying jobs

Data tables:
- connection health
- failed jobs queue
- webhook event processing status

Filters:
- by provider
- by gym
- by failure type
- by time window

Data contracts:
- createPhase6IntegrationMonitorFlow.load
- apps/admin/src/services/integration-monitor-service.ts

Ops messaging:
- "Sync reliability protects rank integrity."
- "Resolve failures before expansion."
```

## Prompt 9: Rank Ladder + Trials

```text
Create mobile modules "RankLadder" and "Trials".

RankLadder:
- tabs: Global, Guild, Lift, Challenge
- row item: rank, avatar, name, score, trend
- tie handling UI for equal score
- weekly reset countdown and status notice

Trials:
- discover, join, leave, progress tracking
- challenge detail with rules + anti-cheat flags
- completion state with sigil reward visualization

Data contracts:
- createPhase7RankTrialsFlow.load
- CompetitionService.joinChallenge
- CompetitionService.leaveChallenge
- CompetitionService.submitChallengeProgress
```

## Prompt 10: Compliance Center (Mobile + Admin)

```text
Create:
1) mobile "Privacy Center"
2) admin "Compliance Queue"

Mobile Privacy Center:
- submit access/export/delete request
- request timeline with SLA status
- policy version history + consent records

Admin Compliance Queue:
- queue filters by status/request type/SLA risk
- transition actions with required note
- legal hold indicator for delete requests

Data contracts:
- apps/mobile/src/flows/phase8-privacy-requests.ts
- apps/admin/src/flows/phase8-compliance-ops.ts
- submit_privacy_request RPC
- transition_privacy_request_status RPC
```

## Prompt 11: Gym Customization Studio (Admin, New)

```text
Create admin module "GymCustomizationStudio" with two tabs:
1) Branding
2) Module Controls

Branding tab:
- upload logo/icon/banner
- set color palette and typography
- live preview for mobile + web components
- support links (terms/privacy/support email)

Module Controls tab:
- per-gym feature toggles with rollout percentage
- lock/unlock core modules (feed, trials, classes, check-in, waivers, billing, integrations)
- save notes on why feature changed

Data contracts (new schema):
- public.gym_brand_settings
- public.gym_feature_settings

Constraints:
- Block disabling modules required by legal/compliance paths.
- Keep audit trail note on each staff mutation.
```

## Prompt 12: Billing + Invoicing Adapters Console (Admin, New)

```text
Create admin module "BillingConnections".

Sections:
1) Payment/invoice provider connections
2) Compliance profile (VAT/tax + locale)
3) Delivery jobs monitor

Capabilities:
- connect provider account (test/live)
- set default provider
- configure compliance profile including Italy SDI destination code and PEC email
- view delivery job queue, retries, errors, and last acknowledged invoice IDs

Data contracts (new schema):
- public.invoice_provider_connections
- public.invoice_compliance_profiles
- public.invoice_delivery_jobs

Guardrails:
- live charging controls behind feature flag `billing_live`
- test mode default for new gyms
```

## Prompt 13: Support Center + Agent Approval Queue (Mobile + Admin, New)

```text
Create:
1) mobile "Support Center"
2) admin "Support Ops Console"

Mobile Support Center:
- create ticket (subject, description, category, optional gym context)
- conversation thread
- ticket status timeline

Admin Support Ops Console:
- triage queue and SLA filters
- AI summary panel
- proposed fix/actions panel
- explicit Approve / Reject controls for agent actions
- audit history drawer

Data contracts (new schema + RPC):
- public.support_tickets
- public.support_ticket_messages
- public.support_automation_runs
- public.submit_support_ticket(...)
- public.approve_support_automation_run(...)

Copy:
- "Support is logged. Actions are reviewed."
- "High-risk changes require approval."
```

## Prompt 14: Gym Staff Surfaces + Permission Matrix (Mobile/Admin, New)

```text
Create:
1) admin "Role & Permissions Matrix" module
2) admin "Staff Scheduler + Hours" module
3) admin "Gym Insights + CRM" module
4) mobile "Staff Ops Lite" module (phone-first)

Role & Permissions Matrix:
- role grid for leader/officer/coach/member against permission keys
- per-user overrides panel
- mutation audit note required
- import/export JSON templates for permission presets

Staff Scheduler + Hours:
- weekly staff shift board
- create/edit shifts
- time entry review and approve/reject workflow
- worked-hours summary by staff and date range

Gym Insights + CRM:
- KPI cards (active members, check-ins, booking fill, no-show rate, MRR trend)
- daily chart surfaces from snapshot records
- lead pipeline board (new -> contacted -> trial -> won/lost)
- lead activity timeline and follow-up reminders

Staff Ops Lite (mobile):
- class occupancy monitor
- waitlist promote action
- shift clock-in/clock-out
- quick lead note capture
- hide finance/compliance/admin-heavy modules by default on phone

Data contracts:
- public.gym_permission_catalog
- public.gym_role_permissions
- public.gym_user_permission_overrides
- public.staff_shifts
- public.staff_time_entries
- public.gym_kpi_daily_snapshots
- public.gym_crm_leads
- public.gym_crm_lead_activities
- public.user_has_gym_permission(...)

Device behavior constraints:
- desktop + iPad: full admin modules
- phone: operations-only subset (classes/waitlist/check-ins/shifts/quick CRM notes)
- enforce permission checks before rendering mutation controls
```

## Prompt 15: Monetization Control Surfaces (Mobile + Admin, New)

```text
Create:
1) mobile "Membership & Access" module (consumer paywall)
2) admin "Pricing Experiments" module
3) admin "Discount Campaigns" module
4) admin "Gym SaaS Subscription" module

Mobile Membership & Access:
- show current entitlement status (free/trialing/active/past_due/canceled)
- show available plans with local currency and period labels
- allow code entry for discounts/promotions
- show trial/renewal timing, policy copy, and restore-purchases CTA placeholders
- include "billing is unavailable" state when feature flag `billing_live` is disabled

Admin Pricing Experiments:
- experiment list with status tabs (draft/running/paused/completed/archived)
- create experiment form (scope, hypothesis, target filters, dates)
- variant editor with allocation percentages and control marker
- assignment health panel (assigned/exposed/converted counts, conversion trend)
- guardrails for invalid scope (b2c must not have gym_id, b2b must have gym_id)

Admin Discount Campaigns:
- campaign list and detail views
- create/edit campaign (percent/amount/trial-days)
- audience filters (global or gym-scoped)
- redemption monitor (total, per-user, by period)
- expiry and deactivation controls

Admin Gym SaaS Subscription:
- show current gym plan, billing status, next renewal, and invoice history
- show past_due / trialing / active state banners
- show payment method placeholder and "update billing method" CTA slot
- include invoice download actions and billing contact management
- include "billing is unavailable" state when `billing_live` is disabled

Data contracts (new schema):
- public.consumer_plans
- public.consumer_plan_prices
- public.consumer_entitlements
- public.pricing_experiments
- public.pricing_experiment_variants
- public.pricing_experiment_assignments
- public.discount_campaigns
- public.discount_redemptions
- public.platform_plans
- public.gym_platform_subscriptions
- public.gym_platform_invoices
- public.gym_platform_payment_transactions
- public.gym_platform_refunds

Behavior constraints:
- no live payment execution in generated UI paths while `billing_live` is false
- all mutation forms require explicit validation and server error surface
- include loading, empty, error, retry, success states for each list/form

KRUXT microcopy:
- "Access is earned and activated."
- "Proof unlocks progress."
- "Pricing changes are tested, not guessed."
```

## Prompt 16: Founder Control Plane + Delegated Access Governance (Admin, New)

```text
Create admin module "PlatformControlPlane" (founder/operator-only).

Sections:
1) Global Overview
2) Operator Access
3) Gym Support Access Grants
4) Feature Overrides
5) Data Governance

Global Overview:
- KPI cards for users, gyms, workouts, support health, MRR trend
- source from `get_platform_admin_overview()` and platform snapshots

Operator Access:
- list platform operators and roles
- manage permission overrides
- show MFA-required status and last activity

Gym Support Access Grants:
- request/approve/revoke temporary access grants
- define scope, reason, start/end windows
- launch/close support sessions with mandatory justification
- tie sessions to support tickets where possible

Feature Overrides:
- global/region/segment level feature toggles
- rollout percentage controls + reason logs

Data Governance:
- partner registry
- data product catalog
- access grant status board
- export queue with explicit approval checkpoints

Data contracts:
- public.platform_operator_accounts
- public.platform_operator_permission_overrides
- public.gym_support_access_grants
- public.gym_support_access_sessions
- public.platform_kpi_daily_snapshots
- public.platform_feature_overrides
- public.user_data_sharing_preferences
- public.data_partners
- public.data_products
- public.data_partner_access_grants
- public.data_partner_exports
- public.get_platform_admin_overview()

Guardrails:
- no direct destructive actions without explicit confirmation
- sensitive panels hidden if operator lacks permission
- include immutable activity/audit timeline UI placeholders
```

## Prompt 17: Account Security Center (Mobile + Admin, New)

```text
Create:
1) mobile "Security Center"
2) admin "Security Audit Panel" (staff/support limited)

Mobile Security Center:
- toggle security settings (MFA required, new-device alerts, session timeout)
- trusted device list with revoke action
- recent auth activity timeline with risk badges
- explanatory copy for high-risk alerts

Admin Security Audit Panel:
- searchable auth event queue (for authorized support/compliance operators)
- suspicious-login filters by risk level
- link to support incident/ticket creation actions
- no credential/token payload display

Data contracts:
- public.user_security_settings
- public.user_trusted_devices
- public.user_auth_events
- public.log_user_auth_event(...)

Guardrails:
- users can only edit their own security settings
- all sensitive actions require confirm dialog
- device revoke and MFA changes emit audit events
```

## Prompt 18: Add-ons Marketplace + Partner Revenue + Data Ops (Admin, New)

```text
Create admin module "GrowthRevenueOps" with three sections:
1) Add-ons
2) Partner Ecosystem
3) Data Product Ops

Add-ons:
- catalog view with categories (analytics/workforce/automation/engagement)
- per-gym add-on subscription state and trial/active/past-due banners
- advanced analytics saved view manager
- automation playbook builder and run history

Partner Ecosystem:
- partner app catalog and status
- gym install monitor with sync/error status
- revenue events board (pending/recognized/invoiced/paid)
- margin split cards (gross/platform/partner)

Data Product Ops:
- aggregation job queue and status
- anonymization check results (k-anonymity, suppression checks)
- release approval checklist (compliance/security/business)
- export readiness state tied to approvals

Data contracts:
- public.gym_addon_catalog
- public.gym_addon_subscriptions
- public.gym_advanced_analytics_views
- public.gym_automation_playbooks
- public.gym_automation_runs
- public.partner_marketplace_apps
- public.gym_partner_app_installs
- public.partner_revenue_events
- public.data_aggregation_jobs
- public.data_anonymization_checks
- public.data_release_approvals

Guardrails:
- no export release actions without visible approval state
- clearly mark features behind rollout flags
- surface legal/compliance warning copy for non-aggregate flows
```

## Prompt 19: Final UX Polish + Accessibility + Telemetry

```text
Apply final pass to all KRUXT modules.

Deliver:
- consistent spacing/typography token usage
- haptics on critical actions (log submit, challenge join, approval actions)
- accessibility validation (labels, focus order, contrast, dynamic text)
- event instrumentation hooks for critical funnels:
  - onboarding completed
  - workout logged
  - proof posted
  - challenge joined
  - class booked
  - provider connected
  - privacy request submitted
  - support ticket created
  - staff shift created
  - lead status changed

Include no-code analytics placeholders and TODO annotations for runtime wiring.
```

## Commit Sequence (Safe)

1. `feat(ui): establish KRUXT global design system and shells`
2. `feat(mobile): onboarding + consent flow`
3. `feat(mobile): workout logger flow`
4. `feat(mobile): proof feed + social interactions`
5. `feat(mobile): guild hall split view`
6. `feat(admin): members + ops console`
7. `feat(mobile): integrations hub`
8. `feat(admin): integration monitor`
9. `feat(mobile): rank ladder + trials`
10. `feat(compliance): privacy center + compliance queue`
11. `feat(admin): gym customization studio`
12. `feat(admin): billing + invoicing adapters console`
13. `feat(support): support center + agent approval queue`
14. `feat(admin): role matrix + staff scheduler + gym insights + crm`
15. `feat(monetization): paywall + pricing experiments + discount campaigns`
16. `feat(admin): founder control plane + delegated access governance`
17. `feat(security): account security center + security audit panel`
18. `feat(admin): add-ons marketplace + partner revenue + data ops`
19. `chore(ui): final accessibility and telemetry pass`
