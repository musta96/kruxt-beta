# KRUXT Legal Draft Pack

Prepared 26 October 2026 at the owner's request. **Review drafts, not adopted
policies, legal advice, compliance certification or authorization to process
health data.** No policy was published, activated, bound to a consent record or
accepted on a user's behalf. These files do not unblock the login policy gate.

## Documents

1. [Terms of Service](drafts/terms-of-service.md): accounts, training safety,
   independent gym services, content rights, community rules, payments,
   suspension, consumer protections and disputes.
2. [Privacy Notice](drafts/privacy-notice.md): data/source/purpose matrix,
   controller roles, recipients/transfers, local storage, retention, rights and
   safeguards. Supplier/retention facts that are not verified remain explicit.
3. [Health Data Processing Notice and choices](drafts/health-data-processing-notice.md):
   sensitive-data scope, separate purpose/recipient choices, refusal/withdrawal,
   health-specific limitations and the implementation gap.

English is the initial review language, matching the current app. Provide a
reviewed Italian version before relying on these documents for an Italian-language
audience; decide how localized versions and updates remain consistent. Do not
declare one language controlling in a way that removes consumer protections.

## Owner Inputs Still Required

The owner supplied his current individual operator identity, Italian postal
address and support/privacy email directly in chat. Those fields are now filled
in all three version-0.2 drafts. This is not a statement of incorporation,
business registration, VAT status or legal review. **The drafts contain personal
contact details: keep them local until exact publication is separately approved.**

- Confirm any applicable registration/VAT details and the operational handling
  of support/privacy requests through the supplied mailbox.
- Confirm safety/security/report-review contacts and DPO/representative
  assessment where relevant. A support address does not prove a staffed incident
  response or statutory contact process.
- Launch territories and an enforceable age policy. Adults-only beta is a
  proposed owner decision, not an assertion that age verification exists.
- Actual supplier entities, contracts, processing/backup locations, remote access
  and transfer mechanisms. Supabase/Vercel use is evidenced; that does not prove
  every supplier, region, agreement or transfer assessment.
- A purpose-specific retention schedule and a working staffed rights/withdrawal
  process. A technical TTL or a successful request submission is not completed
  organization-wide deletion.
- Paid offers and purchase/cancellation details, if enabled. Neither a Stripe
  field nor marketing pricing establishes a live seller/payment contract.

## Product And Legal Review

Personal-data notices need actual controller/purpose/recipient/retention facts,
not generic permission. The review checklist follows the
[Commission's transparency and rights guidance](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en).
The rights/response provisions in the draft should be checked against
[GDPR Articles 12-22](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679).

The existing required-consent gate bundles Terms acceptance, Privacy Notice
acknowledgment and health-data acceptance before entry. **Do not activate these
drafts into that flow unchanged.** Separate the contract from informational
acknowledgment and specific consent-based features; implement refusal and
withdrawal in both client and server paths. The relevant principles are covered
by [EDPB consent guidance](https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en)
and the [Garante's guidance on valid and explicit consent](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/8981258).
Do not treat all fitness records as harmless or automatically public; the
[Garante's fitness-tracker guidance](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/9968193)
informs the field minimization and sharing cautions.

Cookie/local-storage inventory and optional tracking choices need their own
verification; blanket acceptance is not a replacement for the
[Garante's cookie and tracking guidance](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876).
No claim that analytics is currently configured, consent-exempt or absent across
all providers follows from the drafts.

Consumer review must cover the actual sale, mandatory information and lawful
remedies, including relevant digital-service contracts. The draft preserves
rights rather than inventing a universal disclaimer, waiver or refund rule:
[pre-contract information](https://europa.eu/youreurope/citizens/consumers/shopping/contract-information/index_en.htm),
[unfair terms](https://europa.eu/youreurope/citizens/consumers/unfair-treatment/unfair-contract-terms/index_en.htm).
Social-service classification and reporting/moderation duties need a separate
assessment against the [Digital Services Act framework](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package),
including size/service-specific rules. Generic report/block buttons do not prove
DSA compliance. Do not link to the discontinued EU ODR platform.

Have qualified EU/Italian counsel review the completed facts and agreements,
particularly health processing, gym/controller relationships, DPIA requirements,
consumer provisions, minors and any professional/medical claims. Recheck actual
app behavior before approval. Drafting words cannot repair an incompatible gate
or unimplemented rights workflow.

## Source-Backed Product Boundaries

Reviewed code and records include member Auth/profile/required-consent helpers;
the plan/log/feed/privacy screens; workout draft helpers; and the security
readiness, privacy-worker, CAPTCHA and provider rollout records. A read-only
sidecar checked the supplier/storage claims against those sources. No env values,
real account records or hosted data were inspected to draft this pack.

- Google/Apple sign-in configuration is not Apple Health/fitness authorization.
- Wearable/provider/AI schemas and stubs are not evidence of operational imports
  or an AI training provider.
- Optional hCaptcha integration is not proof of hosted enforcement or its lawful
  device-access basis.
- New private defaults do not make historical content private.
- Export/erasure automation remains gated; session revocation and full retention
  handling are not proven complete.
  Missing attachment coverage, retained Auth identifiers and immediate-session
  denial require actual repairs/verification, not merely an inventory attestation
  or enabling a worker. A manual fulfillment process also needs proven coverage.
- Web draft expiry is read-time validation; legacy/native/admin storage differs.
  Retire or repair the legacy unscoped workout draft before making a unified
  per-account/opt-in storage claim. A new notice does not fix old storage code.

## Approval And Publication Sequence

1. Resolve every bracketed field and agree the actual operational commitments.
2. Complete legal review and repair consent/withdrawal, rights and retention
   behaviors; keep unavailable features disabled rather than claiming compliance.
3. Obtain owner approval of the exact final bytes/version and effective date.
4. Render accessible, readable, immutable copies as PDF or UTF-8 plain text.
   The current verifier accepts those types, not an HTML marketing summary.
   Verify HTTPS, MIME type, CORS, size and the actual downloaded bytes.
5. Calculate SHA-256 over those final downloaded publication bytes. A digest of
   this editable Markdown draft is neither approval nor a final-document binding.
6. Review the exact DEV policy-version update separately, preserve old evidence,
   test version changes/refusal/withdrawal with disposable accounts and obtain
   deployment approval. No SQL mutation is authorized by this draft pack.

Existing public legal summary pages and policy metadata are unchanged. They must
not be represented as these full drafts or as approved, verified review copies.

## Offline Readiness Checks

Run `pnpm legal:check` to inspect `docs/legal/review-manifest.json` without any
network connection, database update or publication. The current result must be
`BLOCKED` (exit 1): all three documents are drafts, with unresolved decisions,
no effective date and no exact-byte approval/review bindings.

`pnpm test:legal-readiness` exercises that fail-closed behavior in CI using
isolated synthetic files. CI passing does not mean the legal pack is approved.
Invalid inputs exit 2; locally consistent candidates exit 0. A custom pack can
be checked with `node scripts/legal-readiness.mjs --manifest /path/manifest.json`.
Document sources resolve relative to that manifest, not the shell directory.

After real review, record final UTF-8 `.txt` candidate paths, final semantic
versions, canonical UTC effective dates and the exact SHA-256 values associated
with owner approval and legal review. Set the six operational review statuses
only after those reviews actually happen. Do not remove draft warnings or fill
hashes merely to make the check pass. The checker detects common unresolved
markers, not every possible ambiguity or legal defect.

Even a consistent result always reports `releaseAuthorization: false`,
`humanApprovalProven: false`, `hostedPublicationVerified: false` and
`legalComplianceCertified: false`. Local fields cannot prove who reviewed a
document; retain separate review evidence. Hosted bytes, MIME/CORS, accessibility,
backend enforcement and publication approval still need independent verification.
The checker supports plain-text candidates; the application also supports PDF,
which needs a separate reviewed publication workflow rather than this checker.

See [Consent Transition](consent-transition.md) for the coordinated product and
backend repairs required before changing the current account-access gate.
