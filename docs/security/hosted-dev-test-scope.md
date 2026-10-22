# Proposed Hosted DEV Penetration Test Scope

Status: **DRAFT, NOT AUTHORIZED TO RUN**. Local/disposable testing is authorized.
The owner must approve this completed scope and a time window before hosted
active tests. Restoring a project is not testing approval.

## Explicit Targets

Proposed application origins, only after the operator confirms they are
DEV-only and no real users/data are present:

- `https://kruxt-beta.vercel.app`
- `https://kruxt-admin.vercel.app`
- `https://kruxt-platform.vercel.app`
- Supabase project `hgomsmhsybrxjdxbgkjy` (`kruxt-beta-dev`), only its
  application APIs, RLS/RPC endpoints, Storage and explicitly listed KRUXT Edge
  Functions. Confirm exact function slugs and deployed release SHA first.
- Matching local/native preview build connected to that same synthetic DEV.

Exclude other Supabase projects, Vercel/Supabase infrastructure and dashboards,
provider APIs, email providers, payment processors, other tenants and external
links. An application hosted by a provider is not permission to test that
provider's infrastructure. Confirm applicable provider testing terms first.

## Required Approval Record

Owner/authorizing person: PENDING.
Tester and source IP(s): PENDING.
UTC start/end window and emergency contact: PENDING.
Release SHA/build identifiers: PENDING.
Confirmed target origins/ref and provider terms: PENDING.
Synthetic account IDs and allowed fixture IDs/buckets: PENDING.
Backup/recovery and fixture cleanup operator: PENDING.
Incident stop/restart decision maker: PENDING.

Use four isolated disposable identities (platform operator, gym owner, staff,
member) plus a second synthetic tenant/member to prove isolation. Supply secrets
through ignored local config, never a tracked file or chat transcript. No real
customer identifiers, mailbox credentials, gym records or payment data.

## Allowed Test Matrix Once Approved

| Surface | Bounded Test |
| --- | --- |
| Auth/session | Missing, expired, forged and revoked fixture tokens; sign-out, recovery and callback redirect constraints; inspect configured MFA/rate-limit evidence without guessing passwords |
| Tenant/role controls | Attempt read/write against exact second-tenant canary IDs; staff cannot elevate roles, accept stale privileged invites or use platform actions |
| Workers/Edge | Member/anon calls denied before privileged side effects; approved operator test calls only against isolated queues with synthetic jobs |
| Consent/privacy | Changed/missing policy failure, explicit optional choice, withdrawal/restriction behavior; complete synthetic export/erase with recorded approved retention exceptions |
| Storage | Cross-user read/upload denial, signed-link expiry and cleanup, bounded harmless format/size cases; no executable files or public exposure |
| Input/browser | Inert reflected/stored markers, validation, redirects, headers, cache isolation and error redaction; do not exfiltrate session tokens |
| Replay/business logic | One repeat per synthetic invite/event/booking test, concurrency capped at two requests; verify no duplicate writes or capacity bypass |
| Dependencies | Passive version/reachability review and patched-build checks, not exploitation of RCE/DoS advisories |

## Hard Limits

- Maximum 1 request/second, one active test case, two concurrent requests only
  for a specifically approved atomicity case; maximum 100 active requests in
  the window. Inventory the case count first; do not silently increase limits.
- No brute force, credential stuffing, password spraying, DoS/load testing,
  command execution, persistence, destructive scanners, auth-policy weakening,
  production migrations or purge. No actual external email/webhook/payment send.
- Mutations limited to approved synthetic fixture rows. Synthetic erasure is
  still destructive: it needs separate explicit approval for those exact records.
- On the first unexpected access success, stop that case. Record only the
  synthetic canary ID/status; do not enumerate, download real data or broaden it.
- Stop all testing on real data, service degradation, unexpected external
  delivery, a target/ref mismatch, or the owner/emergency contact's request.
- Do not change secrets or restore/pause projects as part of testing. All
  remediation/deployment actions require their normal authorization.

## Evidence and Exit Criteria

Store a timestamped case matrix: release SHA, principal category, exact approved
fixture, expected/actual status, minimal redacted response, side-effect assertion
and retest result. Never store authorization headers, login links, passwords or
complete sensitive exports in reports. Restrict evidence access and agree a
retention/deletion date before execution.

An independent tester should review coverage against OWASP WSTG v4.2 and the
application's threat model. Release requires remediation/retest of critical/high
findings and recorded acceptance of residual risk by the responsible owner.
A passing matrix is not GDPR certification and does not cover untested targets.
