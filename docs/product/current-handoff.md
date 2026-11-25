# KRUXT Compact Handoff

**Release posture: local verification only.** No broad DEV migration, production
deployment, hosted penetration testing or legal activation is approved by this
handoff. Keep native media disabled. The detailed work log is the
[continuation checkpoint](continuation-checkpoint-2026-10-23.md).

| Workstream | Current evidence and remaining work |
| --- | --- |
| Product | [Journey map](user-journey-map.md), [competitor dossiers](competitors/README.md), and [market horizons](market-horizons-2026-10-23.md) guide the member, gym and operator workspaces. Validate with pilots before treating the product direction as proven. |
| Athlete and social | Local plan-to-log recovery, duplicate protection and optional-share checks exist. Web attachment retries no longer delete a confirmed file after a lost response. Private-media SQL and concurrency checks pass locally; real Storage and legacy-public-object handling remain outstanding. |
| Gyms and operators | Recurring classes, class inbox and custom operator permission work have local contracts. Verify cross-workspace access, repeat schedules, exceptions and targeted announcements with disposable hosted fixtures only after schema reconciliation and approval. |
| Access | Owner confirmed password recovery. Google and Apple setup was reported complete; end-to-end OAuth and role landing are not proven. Member sign-in continuity and the privacy-request escape have local checks. |
| Privacy and security | Privacy defaults received narrowly scoped DEV repairs. Legal drafts are not approved for publication; the purpose-specific consent prototype is not wired into the app. Privacy fulfillment, dependency risks, hosted authorization and approved penetration testing remain release gates. |

## Critical Path

1. **Export received:** On 24 November 2026 the owner completed the guarded session
   export. The external artifact is mode 0600, 1,271,457 bytes, with dump header and
   completion marker. No top-level COPY, INSERT or sequence setval statements were
   detected. These lexical checks do not prove safe executable SQL or completeness.
   SHA-256: `d410f64721af6ce105ed29263366b04b3d1b0a35814f97dc06173de48c02dc7b`.
   Dump headers report server 17.11 and pg_dump 17.7. The SQL remains outside Git;
   no artifact contents, credentials or real rows were published or executed.
2. **Restore:** See the [dependency inventory and rehearsal gates](../security/dev-schema-restore-preparation.md).
   Independently review the dump and its provenance before executing
   it. Prepare a disposable PostgreSQL 17 environment with compatible extensions
   and reviewed managed-role dependencies, no network integrations or real data.
   Match the newly observed 17.11 server, not only the older October catalog's
   17.6 report. Local PostgreSQL exists but does not have `pg_graphql` or `supabase_vault` controls.
   Do not stub those out or drop ACLs to obtain a passing restore.
3. **Reconcile:** Compare the untouched restore against fresh DEV catalog and
   migration evidence. Review exact definitions, grants and effective behavior;
   do not alias timestamps based on object names or rewrite migration history.
   Propose only reviewed forward changes with tested rollback or containment.
4. **Verify:** Exercise real uploads, downloads/signing, audience and block denial,
   old links, retention and erasure in disposable Storage. Then verify OAuth,
   gym/operator switching, class series and the member training loop in DEV under
   explicit scope. Keep release holds until the evidence supports lifting them.

Offline export-guard (16), catalog (9) and release-preflight (9) tests pass. The
installed-tool `--check` passed with a local test certificate and created no file.
This does not attest the DEV certificate, reachability, export or restore.
