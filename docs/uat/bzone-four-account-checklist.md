# BZone Four-Account UAT Checklist

Issue: #96

Use this alongside `tests/uat/bzone/README.md`. Do not record passwords, magic
links, access tokens, or service keys in this document or in GitHub comments.
The automated suite is route-smoke scaffolding only. Keep #96 open until every
required manual journey below has passed with the real four-account setup.

## Run Record

| Field | Value |
|---|---|
| Date/time | |
| Tester | |
| Git commit | |
| Canonical Supabase ref | `hgomsmhsybrxjdxbgkjy` |
| Runtime-observed platform Supabase ref/source | |
| Runtime-observed admin Supabase ref/source | |
| Runtime-observed member-web Supabase ref/source | |
| Parsed mobile env-file Supabase ref | |
| Platform URL | |
| Admin URL | |
| Member web URL | |
| Expo build/version | |

## Readiness Dependencies

- [ ] #103 rank recompute is green, or rank assertions are marked blocked.
- [ ] #104 demo/test data policy is confirmed for the target project.
- [ ] Browser runtime evidence proves every deployed app uses `hgomsmhsybrxjdxbgkjy`.
- [ ] Mobile local/Expo points to `hgomsmhsybrxjdxbgkjy`; it currently differs.
- [ ] #105 cross-app URLs are configured for the canonical environment.
- [ ] The BZone tenant shown in Platform is the intended UAT tenant.
- [ ] Four distinct accounts exist: platform, owner/admin, PT/staff, member.
- [ ] The PT account is assigned to the disposable member used for UAT.

## Automated Run

```bash
pnpm uat:bzone:preflight
pnpm uat:bzone:strict
```

| Journey | Result | Evidence / blocker |
|---|---|---|
| Public entry/login gates | [ ] Pass [ ] Fail | |
| Platform tenant inspection | [ ] Pass [ ] Fail | |
| Platform -> BZone admin handoff | [ ] Pass [ ] Fail | |
| Owner/admin operations | [ ] Pass [ ] Fail | |
| Audited exact-target bulk member update | [ ] Pass [ ] Fail | |
| PT/staff coaching surfaces | [ ] Pass [ ] Fail | |
| Exact PT assignment visibility | [ ] Pass [ ] Fail | |
| Member web/private-gym path | [ ] Pass [ ] Fail | |

## Manual Owner/Admin Checks

- [ ] Approve a disposable pending member and confirm the status changes.
- [ ] Assign that member to the UAT PT and confirm the assignment persists.
- [ ] Change a disposable member role, verify the audit reason, then restore it.
- [ ] Create/edit/cancel a disposable class; verify capacity and instructor.
- [ ] Check in the disposable member and verify the live feed.
- [ ] Open waiver, billing, compliance, and support views; file visible no-ops.
- [ ] Confirm the demo-seed control is absent unless intentionally enabled.

## Manual PT/Staff Checks

- [ ] Sign in with the distinct PT/staff account, not the owner session.
- [ ] Only assigned athletes are unmasked in Coaching.
- [ ] The owner-assigned disposable member appears under My athletes.
- [ ] Open the member plan, messages, notes, goals, and session scheduling.
- [ ] Verify classes/check-ins needed for the PT role are visible.
- [ ] Confirm owner-only actions are absent or rejected by authorization.

## Manual Member and Expo Device Checks

- [ ] Sign in with the distinct normal-member account.
- [ ] BZone appears under Gyms, Guild Hall, and Profile memberships.
- [ ] Redeem a disposable invite or request access; owner can approve it.
- [ ] On Expo, complete profile, consent, and gym-selection onboarding.
- [ ] Log a workout and attach photo proof from camera/library.
- [ ] Publish proof; verify it appears in the vertical feed with poster/media.
- [ ] Add and remove a reaction; add and remove a disposable comment.
- [ ] Verify Guild Hall roster/classes and Rank Ladder render real BZone data.
- [ ] Edit profile, units, and password; verify privacy export/delete entrypoints.
- [ ] Confirm support and legal links open their real destinations.

## Blocker Template

Create a follow-up issue for every non-trivial failure:

```text
Title: [UAT][role] short failing outcome

Account role:
Environment and app URL:
Commit/build:
Preconditions:
Steps:
Expected:
Actual:
Evidence path (no secrets):
Severity / blocks real testers?:
```

Apply the appropriate agent label and link the issue back to #96.
