# Consent Transition Engineering Plan

Status: local implementation plan, 26 October 2026. Not an approved legal basis,
release authorization, migration approval or declaration of compliance.

## Current Coupling

The account gate currently combines Terms, Privacy and Health Data decisions.
Changing checkbox copy alone would not change enforcement consistently:

- `apps/web/src/lib/auth/access.ts` checks `user_has_required_consents`.
- `apps/web/src/lib/auth/required-consents.ts` loads and accepts the required
  policy set, with immutable version/checksum verification.
- `apps/mobile/src/services/policy-service.ts` checks the same RPC and exposes
  `assertRequiredConsents`.
- `apps/mobile/src/services/workout-service.ts` checks that combined gate before
  workout writes.
- `202608030004_consent_activation_hardening.sql` contains missing-policy,
  atomic acceptance and protected-workout enforcement tied to the combined set.

This is a minimum verified inventory, not an exhaustive authorization audit.
Preserve these protections until replacement contracts and callers are ready.
Do not edit historical migrations or activate these drafts to unblock login.

## Target Decisions

Agree the actual purposes and legal bases with the owner and legal reviewer
before selecting which features require which decisions. The proposed separation
is Terms agreement, Privacy Notice receipt/acknowledgment, and specific optional
health-data authorizations. A privacy acknowledgment is not blanket consent.

Keep separate states for missing publication, changed version, not yet reviewed,
declined, accepted and withdrawn. Unavailable documents are a configuration fault,
not a member refusal. Basic account management and rights requests need an
explicit access matrix rather than accidental dependence on workout consent.

Scope any health authorization by actual purpose and recipient: private training,
coach/gym access, provider imports and optional public sharing must not silently
authorize one another. Document which features remain available on refusal and
withdrawal; do not promise that behavior until tested end to end.

## Coordinated Delivery

1. Resolve the draft decisions, operational supplier/retention inventories and
   exact reviewed policy versions. Define the purpose/feature access matrix.
2. Add versioned database contracts separating account eligibility from
   purpose-specific authorization. Bind every operation to the authenticated
   actor; reject cross-user authorization writes. Preserve existing evidence
   without fabricating granular consent from historical blanket acceptance.
3. Audit every workout, feed, media, gym/coach, storage and worker access path.
   Enforcement belongs in server-side contracts/RLS as well as client UX.
   Background jobs must recheck current authorization before processing.
4. Implement refusal, withdrawal and changes of scope transactionally, including
   visibility/access changes, queued processing and export/erasure retention
   exceptions. Repair existing rights/worker coverage and session-denial gaps.
5. Update web and native together: separate actions and pending/declined states,
   purpose-specific routes and clear recovery. No preselected optional consent,
   implicit acceptance on login, or client-only bypass of the combined gate.
6. Run isolated contracts and browser/native acceptance tests before requesting
   the separately reviewed DEV schema and application deployment. Reconcile
   migration lineage first; do not replay the local migration set onto DEV.

## Required Acceptance Evidence

- An unreviewed or checksum-mismatched document cannot be accepted. Concurrent
  policy changes invalidate the stale review; retries do not duplicate evidence.
- Terms and Privacy decisions cannot confer health-purpose authorization.
  Refusal leaves only the explicitly agreed non-health functions available.
- Cross-user, cross-gym, direct RPC, storage and worker attempts cannot bypass
  the purpose/access matrix, including existing sessions after withdrawal.
- Withdrawal prevents newly unauthorized processing and explains retained data
  and lawful exceptions without promising universal immediate deletion.
- Sharing and coach access require their own actual choices; changing audience
  or blocking a user applies server-side, not just in feed rendering.
- Web/native behavior agrees for missing policies, version changes, decline,
  withdrawal, offline/retry, account recovery and already accepted historical
  records. Use disposable identities; never accept policies for real users.

## Work Completed In This Step

Offline draft-readiness checks and sanitized policy-review errors are implemented
locally. The combined consent gate, hosted metadata and existing acceptance
records are unchanged. Nothing in this plan authorizes deployment or publication
of the owner's personal details in the local drafts.

The next local increment now permits active authenticated members awaiting
policy review to use only the privacy-request center, without recording consent
or opening training access. Own-request backend authorization was verified in
an isolated PostgreSQL contract; the existing schema required no change.
This is not the full Terms/Privacy/health-purpose separation. See the
[scope and evidence](../security/privacy-request-access-2026-10-26.md), including
the remaining disabled/missing-profile and overall session-error limitations.

## Disabled Decision Contract Prototype

On 31 October 2026 a disposable-only PostgreSQL contract was added under
`packages/db/consent-prototypes/`, outside the deployment migration set. It
separates Terms agreement, Privacy acknowledgment and purpose/recipient-specific
health decisions, with own-only evidence, default denial, stale-version rejection,
negative decisions and idempotent transaction/audit behavior. It does not import
old consents or change application eligibility. Both global/catalog enablement
default off, and the application does not consume the prototype.

Run `pnpm db:test:processing-permissions` for the owned-local-cluster contracts
and real two-connection retry/withdrawal races. These checks do not establish
production enforcement or legal approval. Before connecting any UI, resolve the
[access-point inventory](../security/processing-enforcement-inventory-2026-10-31.md),
including native public proof storage, coach disclosures, provider ingest,
derived statistics and worker/signed-URL withdrawal behavior. The exact purposes,
scope wording, recipient validation and rights/retention behavior remain reviewed
delivery requirements, not facts supplied by these table/column names.
