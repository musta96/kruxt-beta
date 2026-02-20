# KRUXT Lovable Prompt Pack (Phase 10 Detailed v3)

Use this pack after `docs/lovable/prompts-beta-master-pack-v2.md`.
This pack is for high-fidelity generation of Phase 10 screens already wired in runtime.

## Scope

- Founder control plane (admin)
- Growth/Revenue/Data Ops control surfaces (admin)
- Security center with risk-first UX (mobile)
- Connection checklist to bind Lovable output to existing runtime flows

## Runtime Contracts (Do Not Rename)

- Admin runtime flow: `createPhase10PlatformControlPlaneFlow`
- Admin UI wrapper flow: `createPhase10PlatformControlPlaneUiFlow`
- Mobile runtime flow: `createPhase10SecurityCenterFlow`
- Mobile UI wrapper flow: `createPhase10SecurityCenterUiFlow`

Code locations:
- `apps/admin/src/flows/phase10-platform-control-plane.ts`
- `apps/admin/src/flows/phase10-platform-control-plane-ui.ts`
- `apps/mobile/src/flows/phase10-security-center.ts`
- `apps/mobile/src/flows/phase10-security-center-ui.ts`

## Pre-Run Guardrails

1. Keep KRUXT voice declarative: “Proof counts.”, “Access is earned and activated.”, “Rank is earned weekly.”
2. Never rename DB tables, enums, or RPC names.
3. Keep all high-risk actions confirm-gated.
4. Render loading, empty, error, retry, and success states on each async module.
5. Keep feature-flag copy visible where activation is controlled (`billing_live`, provider flags, data export approvals).

## Prompt 20A (Admin): Platform Control Plane Command Deck

```text
Create admin screen module: "PlatformControlPlaneCommandDeck".

Intent:
A founder/operator command center that renders overview + governance + revenue/data risk in one high-signal surface.

Design direction:
- Theme: KRUXT guild-premium, restrained, data-first.
- Background: graphite gradient with subtle panel segmentation.
- Panels: squared/chamfered cards, thin steel borders, one accent color only.
- Stats typography: monospaced numerics for KPI values.
- Interaction: desktop-first split layout (left rail filters, center board, right detail drawer).

Primary layout:
1) Top strip: system status chips + last refresh + "Refresh Snapshot" action.
2) KPI board: operator/approval/revenue/add-on risk cards.
3) Alert rail: severity-stacked cards (critical > warning > info).
4) Domain tabs:
   - Overview
   - Operator Access
   - Support Access
   - Feature Overrides
   - Data Governance
   - Growth Ops
5) Right drawer: selected entity detail + mutation form + audit note field.

Use existing UI wrapper flow only:
- `createPhase10PlatformControlPlaneUiFlow.load`
- Mutation methods from the same UI wrapper flow.

Data usage requirements:
- Source cards from `snapshot.summary`.
- Source alert rail from `snapshot.alerts`.
- Source detail tables from:
  - `operatorAccounts`, `operatorPermissionOverrides`
  - `supportAccessGrants`, `supportAccessSessions`
  - `featureOverrides`
  - `dataPartners`, `dataProducts`, `dataPartnerAccessGrants`, `dataPartnerExports`, `dataReleaseApprovals`
  - `addonCatalog`, `addonSubscriptions`, `advancedAnalyticsViews`, `automationPlaybooks`, `automationRuns`
  - `partnerMarketplaceApps`, `partnerAppInstalls`, `partnerRevenueEvents`
  - `dataAggregationJobs`, `dataAnonymizationChecks`

Required interactions:
- Operator role upsert
- Permission override upsert
- Support grant create/update
- Support session create/update
- Feature override upsert
- Data partner/product/grant/export mutations
- Add-on catalog/subscription mutations
- Advanced analytics view + automation playbook/run mutations
- Partner app/install/revenue mutations
- Data aggregation/anonymization/release approval mutations

Behavior rules:
- Every mutation:
  1) opens confirm dialog
  2) requires reason/notes for sensitive actions
  3) executes wrapper flow method
  4) refreshes snapshot and keeps tab/drawer context
- Disable submit while pending.
- Show toast with action + domain + result.
- Persist local UI state for selected tab and selected row.

Error handling:
- Use `error.step` to focus the tab section that failed.
- Render inline recovery CTA: "Retry".
- Keep existing data visible on mutation failure.

Accessibility:
- Full keyboard navigation for table rows and drawer controls.
- Focus trap in modal dialogs.
- ARIA labels for KPI cards and severity badges.

Microcopy examples:
- "Access expires unless renewed."
- "Approvals unlock release."
- "Rank depends on trustworthy systems."
- "No release without governance checks."
```

## Prompt 20B (Admin): Founder Console Screens (Modular Split)

```text
Create modular admin screens under Platform Control Plane with shared state provider.

Screens:
1) `ControlPlaneOverviewScreen`
2) `OperatorAccessScreen`
3) `SupportAccessScreen`
4) `FeatureOverridesScreen`
5) `DataGovernanceScreen`
6) `GrowthRevenueOpsScreen`

Architecture constraints:
- Build a shared client state hook: `usePlatformControlPlaneSnapshot`.
- Load via `createPhase10PlatformControlPlaneUiFlow.load`.
- Expose mutation actions from same wrapper flow.
- No direct table access in UI components.

UI patterns:
- Overview: KPI cards + alert rail + recent activity lists.
- Operator Access: role matrix table + overrides side panel.
- Support Access: grant board with statuses and session timeline.
- Feature Overrides: segment/global toggle matrix with rollout sliders.
- Data Governance: partner/product/grant/export pipeline board.
- GrowthRevenueOps: add-on lifecycle + partner revenue + data ops queues.

Table requirements:
- Sticky headers
- Column sorting
- Server-safe text filtering
- Empty-state explanations
- Bulk action placeholders (non-destructive only)

Safety requirements:
- Hidden sensitive panels if role permissions unavailable.
- Export release buttons disabled until all required approvals are approved.
- All destructive/critical actions require typed confirmation input.

Observability hooks:
- Emit UI events placeholders:
  - `control_plane.loaded`
  - `control_plane.alert_clicked`
  - `control_plane.mutation_started`
  - `control_plane.mutation_succeeded`
  - `control_plane.mutation_failed`

Brand copy:
- "Proof counts."
- "Governance before release."
- "Permissions define reach."
```

## Prompt 21A (Mobile): Security Center (Risk-First)

```text
Create mobile module: "SecurityCenterV2".

Intent:
A user-facing security command view that turns technical security signals into clear, prioritized actions.

Design direction:
- iOS-first, one-thumb primary actions.
- Cards with restrained metallic borders and single accent.
- Use monospaced numerics for risk counters.
- Keep critical actions visually distinct but not alarming.

Use UI wrapper flow only:
- `createPhase10SecurityCenterUiFlow.load`
- `upsertSettings`
- `upsertTrustedDevice`
- `revokeTrustedDevice`
- `logAuthEvent`

Sections:
1) Security posture header:
   - MFA state
   - high-risk events (24h)
   - failed logins (24h)
   - revoked devices (30d)
2) Action rail from `snapshot.actionCards`
3) Settings controls:
   - MFA required
   - MFA enabled
   - passkey enabled
   - new-device alerts
   - login alert channel
   - session timeout
   - multi-device sessions
4) Trusted devices list:
   - active devices
   - suspicious/revoked group
   - revoke action with confirmation sheet
5) Auth timeline:
   - grouped buckets from `timelineGroups` (24h / 7d / older)
   - risk badge per event

Interaction rules:
- Any sensitive toggle change opens confirmation sheet.
- Revoke device requires explicit reason note input.
- On success, show short declarative toast and refresh snapshot.

Error rules:
- If load fails, full-screen recovery with retry.
- If mutation fails, keep optimistic visuals off and restore previous values.
- Respect `error.step` to scroll/focus failed section.

Accessibility:
- Large tap targets for all toggles and rows.
- VoiceOver labels include event risk and event type.
- Dynamic Type safe card layouts.

Microcopy:
- "Protect the chain."
- "Session trust is earned."
- "High risk requires immediate review."
```

## Prompt 21B (Mobile): Security + Support Cross-Link

```text
Create mobile cross-link patterns between Security Center and Support Center.

Requirements:
- From high-risk auth event card, deep-link to Support ticket composer with prefilled context.
- From support ticket thread, deep-link back to Security timeline event when relevant.
- Keep links optional and metadata-safe (no secrets, no raw tokens).

Data contracts:
- Security flow: `createPhase10SecurityCenterUiFlow`
- Support flow: `createPhase10SupportCenterFlow`

UI behavior:
- "Report this event" CTA on high-risk timeline rows.
- Auto-compose support ticket category `security` with generated summary text.
- Include references:
  - event id
  - risk level
  - timestamp
  - device id (if present)

Safety:
- Never display credentials.
- Require user confirmation before sending ticket.

Copy:
- "Report and review."
- "Proof improves response quality."
```

## Lovable-to-Codebase Link Checklist

Use this every time after Lovable generation.

1) Generate one screen/module only.
2) Export generated component into correct app package (`apps/admin` or `apps/mobile`).
3) Replace mocked data calls with wrapper flow calls:
   - Admin: `createPhase10PlatformControlPlaneUiFlow`
   - Mobile: `createPhase10SecurityCenterUiFlow`
4) Bind loading/empty/error/success explicitly.
5) Ensure mutation buttons route to wrapper flow methods, not direct DB calls.
6) Keep all confirm dialogs and note fields for sensitive actions.
7) Run typecheck.
8) Commit in grouped slices.

## Recommended Commit Slices

1. `feat(admin-ui): platform control plane command deck shell`
2. `feat(admin-ui): operator/support access interaction layer`
3. `feat(admin-ui): data governance and growth ops boards`
4. `feat(mobile-ui): security center risk and settings surfaces`
5. `feat(mobile-ui): security-support cross-link actions`
6. `chore(ui-docs): update wiring notes and QA checklist`

## QA Checklist Before Merge

- Wrapper flow methods are the only runtime entry points.
- Sensitive actions have confirmation and notes.
- Export/release actions are approval-gated.
- Error step mapping focuses correct UI section.
- Keyboard/screen reader support is complete.
- Typecheck passes in admin and mobile packages.
