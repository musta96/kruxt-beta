# Codex Tooling Assessment for KRUXT

Checked: 2026-10-21. Scope: relevant callable tools, plugin discovery results,
selected connection/permission reads and local executable availability. This
is not an exhaustive execution test of every installed integration.

## Use Now

| Capability | Verified State | Application |
| --- | --- | --- |
| Supabase | Installed; successful project restore and Auth availability checks | Schema/history reconciliation, RLS/advisor/log inspection, isolated DB tests. Hosted writes remain explicitly controlled. |
| GitHub | Installed; current identity read succeeded | Issues/PRs, CI diagnostics, reviewed release changes; plan code scanning and dependency alerts without exposing unpatched findings publicly. |
| Vercel | Installed; known KRUXT project read succeeded | Deployment/build logs, preview checks and runtime configuration. Generic account lookup returned 404; project access still works. Write/deploy operations were not exercised by this assessment. |
| Browser automation / Playwright | Callable browser tools; existing project Playwright test infrastructure | Multi-role journey tests, responsive checks, console/network diagnosis and accessibility regressions. Hosted active security tests need their approved scope. |
| PostgreSQL / pnpm / Supabase CLI | Executables on current PATH | Disposable real migration/RLS tests, negative authorization tests, dependency audit and reproducible builds. |
| Figma | Installed; identity read succeeded | Review a supplied design system, screen consistency and design-to-code handoff. A specific file's permissions remain untested. |
| Product Design / Impeccable | Product Design reported installed; local design skill present | Flow/accessibility/visual audits. Not authentication or security assurance. |
| Security/review skills | Semgrep, CodeQL, insecure-defaults and review workflows present | Guide scoped static analysis, threat modeling and finding triage; skill presence alone is not a completed scan. |

## Gaps and Optional Tools

- Semgrep, CodeQL, OWASP ZAP, Nuclei and Docker were not found on the current
  shell PATH. This does not prove they are absent everywhere on the machine.
  No scanner was installed or started during this assessment.
- First add a deliberately scoped static-analysis run/CI plan. The Semgrep skill
  requires approval of exact target, engine and rulesets before execution and
  disables metrics. CodeQL needs verified source extraction and query coverage.
- Existing code review and dependency audit are useful but do not replace a
  deployed authorization test or independent penetration test.
- PostHog and Datadog were returned as available but not installed. They are
  optional future observability choices, not a reason to add both. Account,
  project, pricing, region, data retention, processor agreement and telemetry
  behavior have not been verified. Do not enable session replay, broad captures,
  or personal/health-data logging while privacy controls remain unresolved.
- No Sentry plugin was returned by the targeted search. Codex Security was in
  the app's recommended list, but the targeted directory search did not resolve
  an exact eligible entry; its availability/entitlement remains unverified.
  Directory search is not exhaustive.
- Firecrawl is reported installed and can help fetch current technical docs.
  Marketing/sales/content integrations do not address current auth/privacy
  blockers. Avoid duplicating hosting/auth/task-tracking systems merely because
  an integration is available.

## Permissions and Data Handling

Supabase, GitHub and Vercel currently inherit the default "Allow low-risk
actions" permission mode. These are app action-approval settings, not verified
OAuth/database scopes or a substitute for least privilege. No permissions were
changed. Keep secrets, user exports, health data and unresolved exploit details
out of public issues and third-party tools unless explicitly authorized and
covered by the applicable processing arrangements.

## Recommended Order

1. Finish and test local authorization/privacy repairs; keep real-tester hold.
2. Reconcile DB history and release revisions; add CI negative tests and scoped
   static analysis, triaging dependency advisories by actual reachability.
3. Run browser regressions and the approved synthetic-account DEV test matrix.
4. Obtain independent penetration-test/retest evidence and privacy/legal review.
5. Use Figma/Product Design for UI consistency, then choose one observability
   service only after its need and privacy configuration are documented.

No installation, subscription purchase, telemetry SDK addition, permission
change, hosted scan or code publication was performed by this assessment.
