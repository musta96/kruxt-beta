# Rank Recompute Scheduler Ops

## Objective

Run `rank_recompute_weekly` automatically each week, fail fast on rebuild errors, and verify deterministic ordering on repeated runs.

## Scheduler

- Workflow: `.github/workflows/rank-recompute-weekly.yml`
- Cadence: every Monday at `04:15 UTC`
- Manual trigger: GitHub Actions -> `rank-recompute-weekly` -> `Run workflow`

## Required GitHub repository secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Without both secrets, the workflow fails at the validation step.

## Runtime checks performed each run

1. Invoke edge function: `POST /functions/v1/rank_recompute_weekly`
2. Rebuild active boards for the selected timeframe
3. Run deterministic repeat probe on `determinismProbeCount` rebuilt boards:
   - snapshot leaderboard entries hash
   - rebuild same board again
   - snapshot hash again
   - mismatch -> run marked failed

## Monitoring output

- Step summary in GitHub Actions run logs
- Artifact: `rank-recompute-report-<run_id>` containing full JSON diagnostics
- Determinism diagnostics included as `determinismFailures`

## Alert path

If the workflow fails, it opens a GitHub issue labeled `high-priority` + `phase-7` with run URL and investigation pointer.

## Local/manual run

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
node scripts/run-rank-recompute-weekly.mjs \
  --timeframe weekly \
  --limit 200 \
  --determinism-probe-count 3 \
  --output-file rank-recompute-report.json
```

## Expected success conditions

- `failedCount = 0`
- `determinismMismatchCount = 0`
- `httpStatus = 200`
