# KRUXT Agent Team Protocol

Two coding agents work this repo in parallel, coordinated through GitHub.
Edoardo arbitrates and handles anything requiring dashboards or logins.

## One worktree per agent — never share a checkout

**Hard rule.** Each agent operates in its own dedicated checkout. They share the
same `.git` (via `git worktree`) so branches and history stay in sync, but the
working tree and `HEAD` are physically separate.

| Agent | Workspace |
|-------|-----------|
| **Claude** | `.claude/worktrees/infallible-nobel` (Claude Code-managed) |
| **Codex** | `~/Documents/kruxt-codex` |

- **Never `cd` into or check out a branch inside the other agent's worktree.**
  Git refuses to check out the same branch in two worktrees — that protection
  only works if each agent stays in its own.
- A shared checkout caused a real incident: a branch switch in one session
  moved the other agent's in-flight commit onto the wrong branch. Don't repeat
  it.
- Create a new worktree **outside** `Documents/Personal 1` and **outside**
  `.claude/worktrees/` (that path is Claude Code-managed):
  `git worktree add ~/Documents/<name> main`.
- Only install `node_modules` in the worktree you actually build in — each
  install is ~1.4 GB.

## Roles & lanes

| Agent | Lane | Owns |
|-------|------|------|
| **Claude** | Mobile + cloud infra | `apps/mobile/**`, `apps/web/**`, `vercel.json` files, `.devcontainer/`, `eas.json`, `CLOUD_SETUP.md`, this file |
| **Codex** | Backend + admin | `supabase/**`, `packages/db/**`, edge functions, RLS, UAT seeds, `apps/admin/**` app code |
| **Edoardo** | Decisions + consoles | Vercel/GitHub/Expo/Supabase dashboards, merges when contested, spend limits |

Shared surfaces (`packages/types`, `packages/ui`, root config): **announce before
touching** — comment on the relevant issue or open a tiny PR early so the other
agent sees it. Cross-lane work is fine when an issue says so; the labels decide,
not the table.

## The board

GitHub Issues = task board. Labels route work:

- `agent:claude` / `agent:codex` — who picks it up
- `agent:human` — needs Edoardo (dashboard clicks, logins, purchases)

Rules:
1. **Session start ritual** — each agent begins a session with:
   `gh issue list --label "agent:<me>" --state open` and
   `gh pr list --state open`. Work the board before inventing new work.
2. **Claim** — comment "taking this" on the issue when starting; reference the
   issue number in the branch name and PR (`Closes #NN`).
3. **New work** — anything non-trivial discovered mid-task becomes an issue with
   the right label, not a detour.
4. **Blocked?** — comment on the issue describing the blocker and tag the label
   of whoever can unblock; move on to the next item.

## Attribution

Both agents currently operate GitHub as the same account (`musta96`), so
usernames don't identify the author. Instead:

- **Sign every issue/PR comment** with a trailing `— Claude` or `— Codex`.
- **Branch prefixes** (`claude/`, `codex/`) identify PR authorship.
- **Commits** carry a `Co-Authored-By:` trailer naming the agent.

Unsigned comments are assumed to be Edoardo.

## PRs & messaging

- PR comments are the inter-agent channel. Questions, review findings, and
  handoffs go on the PR/issue — not through Edoardo's clipboard (he relays only
  when an agent has no repo access in its current session).
- **Cross-review when it matters**: schema changes, auth/RLS, money paths, and
  anything touching the other agent's lane get a review request via
  `gh pr comment` before merge.
- Merge bar: GitHub `validate` green + Vercel preview green (for web apps).
  Squash-merge. Don't merge the other agent's PR unless its issue says to.
- Branch naming: `claude/<topic>` or `codex/<topic>`.

## Conflict rules

- Infra/config files have one owner (see table). The non-owner proposes changes
  via PR comment instead of pushing to those paths.
- If both agents need the same file at once: smaller change rebases on the
  bigger one; disagreements go to Edoardo on the issue.
- Never force-push a branch you didn't create.

## Conventions recap (binding for both agents)

- pnpm 10.6.5 only (never npm/yarn for installs); Vercel builds invoke
  `corepack pnpm@10.6.5 ...` directly.
- Services map snake_case→camelCase; flows orchestrate; screens handle
  loading/empty/error/retry/success.
- DB types regenerate after migrations:
  `supabase gen types typescript --local > packages/types/src/database.ts`.
- Commit style: `feat|fix|chore(scope): ...` with issue refs.
