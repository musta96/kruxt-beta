# KRUXT Lovable Diff + PR Workflow

Use this flow after every Lovable generation.

## 1) Commit on a feature branch (not `main`)

From local repo:

```bash
git checkout -b codex/lovable-<module-name>
git add .
git commit -m "feat(lovable): <module-name> generation"
git push -u origin codex/lovable-<module-name>
```

## 2) Open PR link quickly

```bash
gh pr create --base main --head codex/lovable-<module-name> --fill
```

If you prefer GitHub UI:
1. Open repository page.
2. Click `Compare & pull request` on the pushed branch.
3. Copy URL from browser (that is the PR link).

## 3) Share diff when no PR exists yet

```bash
git diff --name-status main...HEAD
git diff --stat main...HEAD
```

Paste those outputs in chat for fast validation.

## 4) Reject unsafe generations immediately

If Lovable creates root app scaffolding (`src/`, `index.html`, `vite.config.*`, `tailwind.config.*`, `package-lock.json`) in this monorepo, do not merge.
Create a new branch from `main`, rerun with monorepo constraints, and regenerate.
