# Minimal Runtime Monitoring

`pnpm health:check` checks only fixed local preview endpoints:
web `3290`, admin `3291`, platform `3292`. Exit 0 requires all checks to pass.
Use only when those preview servers are expected to be running.

`KRUXT_HEALTH_PUBLIC_KEY=<DEV-public-key> pnpm health:check --hosted` is an
explicit read-only hosted check of the three known KRUXT page origins and the
canonical DEV Auth health endpoint. Keep the key in ignored local configuration,
not shell history or tracked docs. A public key is not a login credential, but
service/secret keys are rejected before any network request.

The checker omits cookies, refuses redirects, has per-request timeouts, never
returns upstream response bodies/errors, and does not submit user credentials.
It sends the public API key only to canonical DEV Auth. A healthy page does not
prove authenticated access, RLS, deployed migrations or GDPR/security readiness.

No third-party analytics SDK, session replay, remote log sink, recurring schedule
or alert recipient is configured. Alert ownership and cadence remain deployment
decisions. Before adding a provider, review region, retention, processor terms,
redaction and consent needs. Never attach email, health content, passwords,
authorization headers, invite links or export packages to telemetry.

The local admin preview on `3291` intentionally uses an unreachable loopback
Auth endpoint for the error-state regression; it cannot sign in to hosted DEV.
