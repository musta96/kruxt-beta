# KRUXT Change Management Workflow

## How Changes Are Implemented

Use the path with the lowest risk and fastest safe turnaround.

## Path A: Configuration/Flag Changes (No deploy)

Use when:

- enabling/disabling existing features
- changing rollout percentages
- changing gym-level settings

Process:

1. Change through admin/control-plane UI.
2. Log reason and expected impact.
3. Monitor KPI/error deltas.

## Path B: UI/Flow Changes

Use when:

- changing screen structure, copy, interaction flow

Process:

1. Generate/update UI scaffold with Lovable prompt.
2. Wire logic/contracts in repo (Cursor/Codex).
3. Run lint/typecheck/tests.
4. Roll out behind flags if risky.

## Path C: Schema/Logic Changes

Use when:

- adding tables/RLS/RPC/functions/integrations
- changing critical business logic

Process:

1. Open issue/change request.
2. Implement SQL migration + typed contracts + tests.
3. Validate in staging.
4. Apply with `./scripts/bootstrap.sh`.
5. Roll out with canary + rollback notes.

## Operating Model (You + Codex)

- Yes, you can continue requesting changes in this chat.
- Recommended: open a GitHub issue first, then ask Codex to implement issue `#id`.
- For urgent incidents: apply temporary flag/config mitigations first, code changes second.

## Non-Negotiables

1. No direct prod DB hotfixes outside migrations unless incident protocol requires emergency patch.
2. Any access to sensitive gym data must be delegated, approved, and time-boxed.
3. Privacy/security/compliance changes always include audit evidence.
