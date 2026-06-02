# KRUXT — UX/UI + Functionality + IA Review (3 apps)

_Reviewed: admin (:3000), platform (:3100), web (:3200). Based on full page inventory + mock-vs-wired analysis._

Legend: 🟢 wired to Supabase · 🟡 partial · 🔴 mock/placeholder

---

## A. WEB — member app (:3200)

**Inventory:** 23 routes. Member screens all 🟢 wired. Two parallel consoles (`/admin/*` and `/org/*`) + invite flows.

### 🔴 Biggest problem: 11 flat top-level tabs
`Feed · Plan · Library · Log · Gyms · Guild · Rank · Integrations · Privacy · Support · Profile`
11 peers is unusable on mobile and dilutes the social-first identity. **Regroup into 4–5:**

| New tab | Absorbs | Rationale |
|---|---|---|
| **Feed** (home) | Feed | The TikTok-style core — lands here. |
| **Train** | Log, Plan, Library | Everything you *do*. Log = primary CTA. |
| **Compete** | Rank, Guild | Social/gamification. |
| **Discover** | Gyms | Find/join gyms. |
| **Me** | Profile, Integrations, Privacy, Support | Settings-style stack inside Profile. |

Integrations/Privacy/Support are **settings**, never primary tabs. Move them into a Profile → sub-menu.

### 🔴 Two admin surfaces (`/admin/*` + `/org/*`) — redundant
`admin/{classes,gyms,invites,users}` and `org/{classes,invites,users}` overlap. Pick one (`/org` reads like the gym-staff console, `/admin` like KRUXT-staff). **Consolidate to one**, delete the other, or this confuses every operator. Gym ops already live in the admin app (:3000) — the web console may be entirely redundant; confirm before duplicating effort.

### Other
- Feed should be full-bleed vertical paging (matches mobile work in progress), not a tab-framed list.
- `Library` vs `Plan` distinction is unclear to users — label as "Exercises" vs "My Plan".

---

## B. PLATFORM — KRUXT super-admin (:3100)

**Inventory:** 11 pages. **Only `/tenants` is 🟢. The other 10 are 🔴 mock** (Overview, Operators, Support-Access, Features, Data-Governance, Revenue, Add-ons, Marketplace, Analytics, Settings).

### 🔴 Critical gap: the engine exists but isn't plugged in
`PlatformControlPlaneService` (~40 real methods: operators, permission overrides, support-access grants/sessions, feature overrides, GDPR data-sharing, data partners/products/exports, add-ons) lives in **`apps/admin/`** and is **never imported into platform**. Every governance page is hand-coded mock data. **This is the #1 fix** — wire the service in and the platform becomes real.

### 🔴 Revenue group contradicts strategy
You decided KRUXT doesn't bill gyms yet. **Hide `Revenue`, `Add-ons`, `Marketplace`** behind a feature flag or remove from nav until monetization phase. Showing fake revenue invites mistakes.

### 🔴 GDPR/compliance not operational
DB has `privacy_requests`, `consents`, `audit_logs`, `data_partner_exports` — **no platform page reads them.** For "100% GDPR compliant + manage everything from the UI" you need:
1. **Data Subject Requests** queue (access/export/delete/rectify) with SLA timers — table exists, build the console.
2. **Audit log viewer** (who-did-what, immutable) — `audit_logs` exists, surface it read-only with filters.
3. **Consent ledger** per user + version history.
4. **Support-access = break-glass impersonation** must write an audit row on every grant/use, with mandatory reason + auto-expiry (schema supports it; wire it).
5. **Data-retention policy** controls + export/erasure runner.

### IA regroup (platform)
Keep **Platform** (Overview, Tenants, Operators). Rename **Governance → Trust & Compliance** and put (Support Access, Audit Log, Data Subject Requests, Consents, Feature Overrides). **Drop Revenue group for now.** Keep **Insights** (Analytics, Settings).

### Operators page needs real RBAC
Mock shows founder/admin/support/readonly. Wire to `platform_operator_accounts` + permission overrides so you can actually invite/suspend colleagues and scope what they can touch — this is the core "me + future colleagues" requirement.

---

## C. ADMIN — gym ops (:3000)

**Inventory:** 13 dashboard pages, grouped Main/Operations/Admin. Mostly 🟢. Heaviest remaining mock: **coaching (20)**, members (9), settings (9), billing (16 — but mixed with real).

### Grouping fixes
- **`Preview` sits in "Main"** — it's a member-app preview utility, not daily ops. Move to a top-bar "Preview as member" button or into Settings.
- Suggested groups:
  - **Daily Ops:** Overview, Members, Check-ins, Classes
  - **Coaching:** Coaching, Staff
  - **Money:** Billing, Waivers
  - **Setup:** Settings, Integrations, Compliance, Support

### Functional gaps
- **Coaching** is the least-wired page — finish wiring to `gym_member_workout_plans` + coach assignment (tables already exist).
- **Members**: confirm the no-UUID search/invite flow is fully live (it was added) — that was a top pain point.
- **Settings**: branding form needs the `brand_applies_to_admin` toggle + live preview + real logo upload (Supabase Storage), replacing paste-URL fields.
- **Billing**: 16 mock markers — verify manual-payment + invoice flows read real data end-to-end.

---

## D. Cross-cutting (all 3)

1. **Empty states everywhere** — with seed data they look fine, but each list needs a real empty + "create first X" CTA.
2. **Loading/error/retry** — admin has the pattern (`useAsync`); platform pages don't (they're static mock). Standardize on one `useAsync` across apps.
3. **Consistent top-bar** — gym/operator identity, environment badge (prod/dev), sign-out. Admin has it; platform/web inconsistent.
4. **Audit trail** is the connective tissue for GDPR — every destructive action in all 3 apps should write to `audit_logs`.
5. **i18n** — BZone is Italian; member-facing web/mobile need IT locale, admin/platform stay EN.

---

## Priority order (what to build next)

1. **Platform: wire `PlatformControlPlaneService`** → kills 10 mock pages at once.
2. **Platform: GDPR console** (DSR queue + audit viewer + consent ledger + break-glass support access).
3. **Platform: real Operators RBAC** (invite/suspend/scope colleagues).
4. **Platform: hide Revenue/Add-ons/Marketplace** until monetization.
5. **Web: collapse 11 tabs → 5**, fold settings into Profile, kill the duplicate `/admin` vs `/org` console.
6. **Admin: finish Coaching wiring + branding upload + move Preview out of Main.**
