# Processing Permission Contract Prototype

**Local/disposable only, disabled by default, not a deployment migration.**
No application currently consumes this ledger. It does not unblock login or
replace the existing combined consent checks. No legacy consent records are
copied, upgraded, rewritten or treated as purpose-specific permission.

## Run

From the repository root, run `pnpm db:test:processing-permissions`.
It ignores a supplied consent-test database URL, creates an owned local PostgreSQL
cluster, applies the ordered application migrations, runs existing contracts,
then installs and tests this prototype. The cluster is stopped and deleted on
exit. PostgreSQL 17 binaries are required. In the separate CI job, the same
runner uses its explicitly configured empty disposable PostgreSQL service.

Installing `processing-permissions-v2.sql` requires the explicit test-session
setting `kruxt.disposable_processing_contract=on`. The runner checks refusal
without that setting first. This is an accidental-install guard, not proof that
an arbitrary database is safe; never set it on hosted DEV or production.
The prototype is deliberately outside `supabase/migrations/`, with no history
entry and no bulk deployment authorization.

## Proposed Decisions

| Decision Key | Scope | Positive Action |
| --- | --- | --- |
| `terms_agreement` | `account` | `accept` |
| `privacy_acknowledgment` | `account` | `acknowledge` |
| `private_training` | `self` | `grant` |
| `coach_access` | Exact `coach:<uuid>` or `gym:<uuid>` | `grant` |
| `provider_import` | Exact provider key | `grant` |
| `public_sharing` | `public`, `followers`, or exact `gym:<uuid>` | `grant` |

This is an engineering proposal, not approved purpose wording or legal bases.
Recipient existence, gym membership, coach assignment, provider field scope and
actual resource access still require enforcement before rollout. Recording a
decision alone neither sends data nor grants a gym/operator permission.

Account readiness requires current Terms agreement and Privacy acknowledgment;
it does not grant any health purpose. Health checks additionally require that
readiness and the exact current-purpose/scope grant. Scopes and the global
switch start disabled; no catalog entries or usable policy documents are seeded.
Tests enable only synthetic fixtures inside the disposable database.

`decline` and `withdraw` remain available for known scopes when configuration,
scope or profile is disabled, or a policy version is retired. A later negative
decision applies across versions of the same purpose/recipient. Replaying an old
request returns its old receipt without changing the latest state. Accepting a
new Terms/Privacy version does not create a new health grant; an independently
withdrawn health grant remains withdrawn. Account checks do not determine which
own-data/rights functions must remain available after refusal.

## Boundaries

The private `consent_v2` schema holds version references and append-only decision
evidence. Public wrappers accept no target user ID and derive the subject from
verified Auth context; anonymous and service-role execution are not granted.
Authenticated SQL reads are own-row only, with no direct ledger/config/catalog
write privileges. Internal helper execution is revoked. Scopes cannot silently
change purpose, recipient or policy version. Recorded checksums bind the
referenced policy metadata, not proof of a human reading the document.

Per-subject transaction locks serialize decisions and retries. Requests are
idempotent within an actor; a changed action/scope on the same reference conflicts.
Each new decision and its audit record commit together or roll back together.
The contract includes actual competing PostgreSQL backend lock waits, not only
sequential mocks. This is not exhaustive interleaving or load testing.

Grants require an active profile and current policy metadata with an HTTPS
content/checksum binding. A qualified final-purpose review, accessible immutable
review copy, client byte verification, deployment approval and session-revocation
strategy are still required. There is no new frontend/native consent control,
withdrawal propagation, queue cancellation, signed-URL revocation or rights worker
integration in this increment. In particular, immutable evidence and the subject
foreign key need a reviewed retention/erasure design before any real data enters
the ledger. Keeping this disabled is not a substitute for those repairs.

See the [enforcement inventory](../../../docs/security/processing-enforcement-inventory-2026-10-31.md)
and [transition plan](../../../docs/legal/consent-transition.md). Security patterns
were checked against Supabase's [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [database-function](https://supabase.com/docs/guides/database/functions) guidance;
passing these local checks is not a compliance certification.
