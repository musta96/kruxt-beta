# Disposable UAT and Pilot Protocol

Status: prepared, not executed with hosted accounts or real pilot users.

## Preconditions

- Owner names a disposable DEV gym and synthetic athlete, unrelated athlete,
  coach and operator accounts. No existing customer membership or account is a
  disposable target by inference. Passwords/tokens stay out of reports and chat.
- Confirm the exact revision, DEV URLs, rollback procedure, migration history
  and server authorization contracts. Keep production release on hold.
- Verify recovery and enabled identity providers in the actual browser/device
  used by the participant, without capturing passwords, OTPs or recovery URLs.
- Obtain pilot consent, agree deletion dates and identify a moderation contact.
  Do not enable third-party tracking or record health/training payloads merely
  to measure completion. Use aggregate/manual observations initially.

## Tasks and Evidence

| Task | Success evidence | Negative case |
| --- | --- | --- |
| Gym access | Correct membership/role and retry outcome | Lookup failure never becomes a create-gym path |
| Discover/start | Exact saved or assigned day reaches logger | Removed/ambiguous day does not silently fall back |
| Complete privately | One persisted workout; accurate result | Lost response/readback failure does not invite blind retry |
| Attach media | Registered media playable by permitted audience | Mid-upload failure resumes without another workout |
| Share deliberately | Stored audience matches chosen audience after reload | Unrelated viewer cannot fetch private workout/media directly |
| Follow | Pending request, recipient accepts/declines, feed changes | Wrong-direction/stale request mutation is rejected |
| Block/report | Block/unblock persists; report enters moderation queue | Direct API/media access and comment visibility tested separately |
| Staff task | Correct member and class; actual completion recorded | Double action and unavailable backend do not claim success |
| Recovery | Owner completes password update and next login | Expired/replayed callback fails without revealing tokens |

Local browser fixtures cover selected client failure cases only. Hosted negative
authorization testing requires the separately approved DEV scope. No brute force,
DoS, destructive testing or real-user-data exploration is part of this protocol.

## Pilot Measurements

Report denominators, cohort dates, sample size and missing observations. Establish
a baseline before claiming improvement; do not replace missing values with zero.

| Metric | Definition | Privacy-conscious source |
| --- | --- | --- |
| Completed training | Distinct persisted workout receipts / sessions intentionally started | Aggregate count, not notes or media |
| Repeat participation | Consenting participants completing training on a later day / eligible participants | Temporary pseudonymous cohort key; delete linkage after review |
| Journey completion | Unassisted task completions / attempted tasks | Observer checklist and elapsed seconds |
| Staff effort | Median active minutes and interventions per finished staff task | Timer and intervention count, no customer identity |
| Reliability | Confirmed saves, uncertain outcomes, upload retry success, duplicate incidents | Error category and aggregate counts |
| Safety | Reports, block failures, unauthorized-access findings and time to triage | Restricted incident register; publish aggregate only |
| Cost | Incremental storage bytes, egress and request charges / completed workout | Provider billing interval, currency and measured totals |

Track sharing as optional: private completion is success. Do not optimize watch
time, forced posting or workout volume as a proxy for healthy repeat training.
Review challenge incentives separately for rest, different abilities and cheating.

## Exit and Cleanup

Stop for cross-tenant access, private media exposure, unexpected real-user effects,
unrecoverable duplicate saves, misleading audience state or missing moderation
coverage. Fix and retest before expanding the cohort.

Record actual findings and confidence rather than a blanket compliance claim.
Delete synthetic memberships/media/accounts only through approved scoped cleanup;
verify residual Storage objects and avoid removing unrelated test/customer data.
