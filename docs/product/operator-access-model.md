# Operator Access Model

Owner request: edit individual operator permissions and eventually define more
operator types. Scope: the KRUXT platform workspace, not gym staff memberships.
Status: local implementation and isolated testing; no live permissions changed.

## What Is Supported

Six real database roles exist: `founder`, `ops_admin`, `support_admin`,
`compliance_admin`, `analyst`, `read_only`. Their actual configured defaults must
be read separately. Compliance is not an alias for Operations; Analyst is not an
alias for Read-only. A role name does not establish all of its effective rights.

The local editor supports a search/filterable operator list, real catalog
defaults and individual **Inherit / Allow / Deny** overrides. Missing defaults
are shown as not configured rather than an invented grant. Inactive accounts
are not represented as having effective access merely because grants remain.

Founder administration requires a verified second factor, an audit reason,
explicit review and confirmed server acknowledgement/readback. Each existing
override RPC is its own transaction: a batch may partly apply. The client stops
at the first unconfirmed outcome and reloads rather than blindly repeating all
changes. This is not server-side compare-and-swap or atomic batch administration.

The hardening migration closes ordinary API direct writes to account, role,
catalog and override tables; guarded override RPCs are the supported write path.
It does not add invitations, account role reassignment or account deletion. A
service-role/database owner remains a separate trusted maintenance boundary.
See the [technical boundary audit](../security/operator-permission-boundaries-2026-10-23.md)
for exact protections, tests and residual gaps.

## Named Custom Types: Next Contract, Not A Fake Dropdown

Custom operator types are not available yet. Adding a new label or expanding
the enum alone would not make their permissions work consistently. Some current
consumers still use legacy capability keys or direct role checks. Those must be
aligned first; a granular deny must not coexist with a broader legacy bypass.

Proposed design after canonical enforcement and migration-lineage approval:

1. Persist versioned **role profiles** with immutable IDs, owner, name,
   description, active/archive state and explicit catalog grants. Do not add a
   PostgreSQL enum value for every organization-defined job title.
2. Preview assignments against the current effective rights: added, removed,
   unchanged and scope/condition requirements. Sensitive administration requires
   step-up authentication and an audit reason.
3. Use one documented precedence model everywhere: inactive account/catalog
   denies; explicit individual deny wins; then explicit allow/profile default;
   otherwise deny. Founder/breakglass authority needs an explicit, narrow policy,
   not an undocumented display assumption.
4. Enforce tenant scopes, approval separation, expiry and PII restrictions on the
   server. Boolean grants and explanatory metadata cannot enforce those rules.
5. Assign a profile version deliberately. Updating a shared profile must show
   every affected operator, have a concurrency token and commit atomically.
6. Provide guarded invitation, suspension/revocation and reassignment APIs with
   concurrent last-founder protection, audit integrity and session/support-access
   invalidation. Never use editable identity metadata for authorization.
7. Archive a profile without deleting audit history. In-use profiles require an
   explicit reassignment plan. Exports reveal policy and provenance, not secrets.

Possible jobs worth validating include customer success, content moderation,
billing review, privacy operations and integration operations. These are examples,
not created roles or pre-approved grants. A finance reviewer should not inherit
member health data; a moderator should not inherit billing or operator management.

## Acceptance Gate

Test every real role against RPCs and direct table/API writes, not just hidden
buttons. Include missing/disabled keys, explicit denials, inactive accounts,
stale sessions, wrong tenants, concurrent founder changes, AAL1/AAL2, failed audit
writes and partial network responses. Require server equality between legacy
and canonical consumers before custom-profile rollout.

Reconcile the divergent migration trees against actual DEV history before any
deployment. No migration synchronization, hosted SQL, real-account MFA setup,
permission assignment or production rollout is authorized by these local tests.
