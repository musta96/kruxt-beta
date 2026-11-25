# KRUXT: Claude Audit Handoff

Give Claude this file and [the audit prompt](claude-audit-prompt.md). Start with a
local, read-only audit. GitHub is useful for history; inspect local changes
separately rather than assuming a checkout and its remote are identical.

## Local Access

| Priority | Absolute path | What it is |
| --- | --- | --- |
| Required | `/Users/edoardomustarelli/Documents/Personal 1 /codex-worktrees/journey-design` | Active integration checkout, branch `codex/98-journey-design`, observed HEAD `97beac1` on 25 November 2026 (history rewritten that day; old IDs `4fb1fd7`/`18ddcfa`/`9da4e46` became `c853bbf`/`90f9c76`/`97beac1`). Recheck HEAD and local changes at audit start. |
| Historical | `/Users/edoardomustarelli/Documents/Personal 1 /.claude/worktrees/infallible-nobel` | Prior Claude/Fable work, branch `claude/j1-hardening`. Start with `READINESS.md`; verify claims against code. |
| Optional | `/Users/edoardomustarelli/Documents/Personal 1 ` | Parent repository and Git worktree metadata. Scope access to repository operations; do not recursively ingest this folder. It contains credentials. There is a trailing space before the closing backtick. |
| Optional | `/Users/edoardomustarelli/Documents/KRUXT-continuation` | Historical continuation checkout, not the current source of truth. |
| Optional | `/Users/edoardomustarelli/Documents/kruxt-codex` | Historical UI rescue checkout, not the current source of truth. |
| Optional | `/Users/edoardomustarelli/Documents/kruxt-issue-96-uat` | Historical B-Zone UAT scaffold. |

Use `git worktree list` for the full map and `git log` / `git diff` to decide
what actually differs. Ignore prunable temporary worktrees. If the tool cannot
grant narrow folder/file access, use a reviewed, sanitized audit copy containing
selected tracked and untracked source/evidence, not a zip of the raw checkout.

### Audit Baseline

- `c853bbf` (formerly `4fb1fd7`) is the November 24 working-tree snapshot, not
  evidence that its changes were reviewed or deployed. On 25 November its history
  was rewritten: personal contact details in the legal drafts became placeholders,
  `docs/security/` and `SECURITY_READINESS.md` were left out of Git (local only),
  and the dev login line in `KRUXT_PLAN.md` was removed. The repository was public
  when the original commit was pushed; treat the removed details as exposed.
  The original drafts are kept locally in `output/runtime/legal-drafts-with-contact-details/` (git-ignored).
- `90f9c76` (formerly `18ddcfa`) consolidates gym-workspace routing and shared app URLs and removes
  duplicate web consoles. Verify that class, member and invite workflows survive
  the redirects, including authorization and session continuity. The commit
  alone is not evidence that hosted behavior changed.
- `97beac1` (formerly `9da4e46`) is the mobile tab order and `CLAUDE.md` navigation
  change. The two files Codex saw as locally modified at intake were byte-identical
  to this commit; the checkout had simply not pulled it yet.
- Claude's audit reports are private Claude docs, not files in the checkout:
  "KRUXT Technical Cofounder Audit" and "KRUXT Product, Brand & UX Review"
  (24 Nov 2026). They contain security findings, so keep them out of Git.

### What To Read In The Active Checkout

- **Current state:** [compact handoff](current-handoff.md),
  [continuation log](continuation-checkpoint-2026-10-23.md),
  [implementation checkpoint](implementation-checkpoint-2026-10-23.md).
- **Product and evidence:** [journeys](user-journey-map.md),
  [competitor dossiers](competitors/README.md),
  [competitive strategy](competitive-strategy-2026-10-22.md),
  [market horizons](market-horizons-2026-10-23.md),
  [research-to-roadmap](research-to-roadmap-2026-10-23.md),
  [pilot protocol](pilot-validation-protocol.md), and [Pavia pilot strategy](../strategy/pavia-pilot-distribution-and-surface-strategy-2026-02-20.md).
- **Surfaces:** `apps/web` (member/marketing), `apps/mobile` (Expo),
  `apps/admin` (gym operations), `apps/platform` (platform operators).
- **Shared and backend:** `packages/ui`, `packages/types`, `packages/db`,
  both `supabase/` and `packages/db/supabase/`. Treat them as distinct lineages.
- **Trust and release:** [migration lineage](../security/migration-lineage-2026-10-23.md),
  [restore preparation](../security/dev-schema-restore-preparation.md),
  [release preflight](../security/dev-release-preflight.md),
  [monitoring](../security/runtime-monitoring.md),
  [processing inventory](../security/processing-enforcement-inventory-2026-10-31.md),
  [consent transition](../legal/consent-transition.md).
- **Verification:** `.github/workflows/`, `tests/uat/`, `scripts/`,
  `packages/db/tests/`, app test folders and root `package.json`.

## Links

| Surface | Link |
| --- | --- |
| Canonical GitHub | [kruxt-beta](https://github.com/musta96/kruxt-beta), [issues](https://github.com/musta96/kruxt-beta/issues), [PRs](https://github.com/musta96/kruxt-beta/pulls), [Actions](https://github.com/musta96/kruxt-beta/actions) |
| Secondary/Lovable remote | [kruxt-foundation-kit](https://github.com/musta96/kruxt-foundation-kit), [historical site](https://kruxt-foundation-kit.vercel.app) |
| Hosted member/web | [kruxt-beta.vercel.app](https://kruxt-beta.vercel.app) |
| Hosted gym admin | [kruxt-admin.vercel.app/login](https://kruxt-admin.vercel.app/login) |
| Hosted platform operator | [kruxt-platform.vercel.app](https://kruxt-platform.vercel.app) |
| DEV backend | [kruxt-beta-dev project dashboard](https://supabase.com/dashboard/project/hgomsmhsybrxjdxbgkjy) |
| Deployment dashboard | [Vercel project view](https://vercel.com/edoardos-projects-61f55e37/kruxt-admin) |
| Prior local preview | [Member privacy page](http://127.0.0.1:3306/privacy), only when local server is running |

Treat links as entry points, not proof of deployed revision, uptime or access.
Read-only GitHub access to the named repos is sufficient. Public pages may be
reviewed normally; supply screenshots or synthetic fixtures for private journeys.
Vercel/Supabase links identify systems; do not grant account-wide admin access.

## Do Not Share By Default

No whole-Mac access. Exclude real `.env*` files, keys/tokens, Apple `.p8` files,
credential stores, account sessions, logs/caches/browser profiles, personal legal
details, member data, payments and raw analytics. Redact examples and screenshots.
Do not upload `*.restricted.sql`, `*.restricted.json*` or dump contents. The
owner-operated DEV schema export succeeded; its checksum and inventory are
already documented. It has not been executed or restored. Use the sanitized
inventory rather than giving Claude dump access.

Useful optional business input: anonymized usage/cohort counts, actual monthly
costs by category, gym interviews, pilot commitments, pricing conversations,
available budget, runway and founder time. Provide aggregates and dates only.
Unknown inputs must stay unknown until there is evidence.
