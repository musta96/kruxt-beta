# BZone Four-Account Route-Smoke UAT

This suite advances issue #96 with an executable, credential-safe browser
scaffold for the deployed KRUXT platform, gym admin, and member web apps. It is
route-smoke scaffolding, not completed end-to-end acceptance: it does not create
accounts, complete real business journeys, or exercise the Expo app. Keep #96
open until the manual checklist and real four-account UAT have passed.

## Automated Scope

The bounded checks cover:

1. Public URLs, login gates, and runtime Supabase project evidence.
2. Exact platform operator email/role and exact BZone tenant ID/slug.
3. Gated Platform -> BZone admin handoff.
4. Owner/admin identity, role evidence, and core operations routes.
5. One idempotent audited bulk update against an exact disposable membership.
6. Exact PT assignment, staff routes, and denial of owner-only controls.
7. Exact member identity/role, BZone membership, and consumer routes.

The manual journey and Expo/device coverage remain in
`docs/uat/bzone-four-account-checklist.md`.

## Environment Target

Production URLs are defaults. Override them for staging or previews:

```bash
export KRUXT_UAT_PLATFORM_URL="https://kruxt-platform.vercel.app"
export KRUXT_UAT_ADMIN_URL="https://kruxt-admin.vercel.app"
export KRUXT_UAT_WEB_URL="https://kruxt-beta.vercel.app"
export KRUXT_UAT_GYM_NAME="BZone Fitness"
```

The canonical testing Supabase ref is `hgomsmhsybrxjdxbgkjy`. The browser suite
derives deployed evidence from actual Supabase request hosts and loaded runtime
bundles; there is no self-attested Vercel-ref variable. Password sign-in also
asserts the actual Supabase auth request host for each app.

Strict mode parses the actual mobile local env file and reads only
`EXPO_PUBLIC_SUPABASE_URL`:

```bash
export KRUXT_UAT_MOBILE_ENV_FILE="/absolute/path/to/apps/mobile/.env.local"
```

Mobile local was known to point elsewhere on 2026-08-03. Strict mode must stay
blocked until the parsed file points to the canonical ref. Never commit anon
keys, service-role keys, passwords, tokens, or the mobile env file.

## Four Accounts

Configure secrets only in the local shell/session. All four emails must be
distinct, and the platform role must match what the deployed top bar displays:

```bash
export KRUXT_UAT_PLATFORM_EMAIL="..."
export KRUXT_UAT_PLATFORM_PASSWORD="..."
export KRUXT_UAT_PLATFORM_EXPECTED_ROLE="founder"
export KRUXT_UAT_OWNER_EMAIL="..."
export KRUXT_UAT_OWNER_PASSWORD="..."
export KRUXT_UAT_STAFF_EMAIL="..."
export KRUXT_UAT_STAFF_PASSWORD="..."
export KRUXT_UAT_MEMBER_EMAIL="..."
export KRUXT_UAT_MEMBER_PASSWORD="..."
```

Allowed platform roles are `founder`, `ops_admin`, `support_admin`,
`compliance_admin`, `analyst`, and `read_only`.

## Exact Targets

Strict UAT requires an exact BZone gym and UUID-backed disposable records. No
test falls back to the first row or a partial name match:

```bash
export KRUXT_UAT_GYM_ID="00000000-0000-4000-8000-000000000000"
export KRUXT_UAT_GYM_SLUG="exact-bzone-uat-slug"

export KRUXT_UAT_BULK_MEMBERSHIP_ID="00000000-0000-4000-8000-000000000000"
export KRUXT_UAT_BULK_USER_ID="00000000-0000-4000-8000-000000000000"
export KRUXT_UAT_BULK_MEMBER_MARKER="BZone UAT Bulk Member (@bzone_uat_bulk)"
export KRUXT_UAT_BULK_EXPECTED_STATUS="active"
export KRUXT_UAT_BULK_EXPECTED_ROLE="member"

export KRUXT_UAT_ASSIGNED_MEMBERSHIP_ID="00000000-0000-4000-8000-000000000000"
export KRUXT_UAT_ASSIGNED_MEMBER_USER_ID="00000000-0000-4000-8000-000000000000"
export KRUXT_UAT_ASSIGNED_MEMBER_MARKER="BZone UAT Assigned Member"
export KRUXT_UAT_ASSIGNED_EXPECTED_STATUS="active"
```

Markers must contain `.test` or `UAT`. The bulk target must already be an active
member so the status write is idempotent. UUIDs above are format-only examples,
not usable IDs.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm uat:bzone:preflight
pnpm uat:bzone:typecheck
pnpm uat:bzone:list
pnpm uat:bzone
pnpm uat:bzone:strict
```

`uat:bzone` safely runs public checks and skips unavailable protected journeys
with actionable variable names. `uat:bzone:strict` requires all four accounts,
mobile env evidence, exact gym/bulk/assignment targets, mutation opt-in, and no
skipped tests.

## Mutation Safety

State-changing checks remain skipped unless explicitly enabled:

```bash
export KRUXT_UAT_ALLOW_MUTATIONS=1
```

Every non-local deployed target additionally requires a separate deliberate
production confirmation:

```bash
export KRUXT_UAT_PRODUCTION_CONFIRMATION="I_CONFIRM_DISPOSABLE_PRODUCTION_UAT"
```

The platform handoff creates an audited support/operator session. The bulk test
first proves exact gym, membership, user, profile marker, role, and current
status from runtime responses; it then intercepts and validates the exact RPC
body before allowing the request. Use only disposable UAT records.

Tracing is off by default because artifacts may contain session/account data.
Set `KRUXT_UAT_ENABLE_TRACE=1` only for controlled local debugging. Reports,
screenshots, videos, and traces are written to `output/playwright/bzone-uat/`
and must be treated as sensitive local files.
