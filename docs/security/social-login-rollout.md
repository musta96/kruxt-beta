# Social Login and Platform Access

Status: implemented locally and fixture-tested, 2026-10-22. Not deployed.
No hosted provider settings, account roles, passwords or deployments changed.

## Access Diagnosis

Read-only checks against `kruxt-beta-dev` found the project healthy, the known
owner account email confirmed, and an active founder operator record. The hosted
platform login loads and its browser bundle points to the canonical DEV project.
These checks do not establish that a password is correct or reproduce a reported
authenticated failure. No password or real social-provider login was submitted.

The owner clarified that the actual message is **invalid credentials**. A further
read-only check confirms a password is set and the account is not banned. The
failure precedes the founder-role gate; reset the existing identity rather than
granting new roles or creating a duplicate account.

Local previews were intentionally built with `http://127.0.0.1:9` and a public
placeholder key. Real accounts cannot sign in there. Each hosted portal also has
its own origin-local browser session; signing in to one portal does not establish
a session in another origin automatically.

The public Auth settings endpoint currently returns `google: false` and
`apple: false`. Provider buttons alone cannot enable real OAuth.

## Required Provider Configuration

Configure secrets only in the provider dashboards and Supabase Auth settings,
never in source control, a public environment variable, screenshots or chat.

1. Google: create a Web OAuth client, configure its consent screen and permitted
   test users/publishing status, then add its client ID and secret to Supabase's
   Google provider. Register the Supabase callback below as an authorized redirect.
2. Apple: configure Sign in with Apple for an App ID and associated Services ID,
   verify the website domain, and create the signing key/client secret. The web
   Services ID must be first in Supabase's Apple client-ID list when native App IDs
   are also present. Record secret expiry and a rotation owner.
3. Provider callback for this DEV project:
   `https://hgomsmhsybrxjdxbgkjy.supabase.co/auth/v1/callback`.
4. Add only reviewed exact application return URLs to Supabase's redirect allowlist:
   `https://kruxt-beta.vercel.app/`,
   `https://kruxt-admin.vercel.app/login`, and
   `https://kruxt-platform.vercel.app/login`.
   The member flow returns to the `#member-login` anchor on the member origin.
   Confirm fragment matching against the actual allowlist during DEV acceptance.
   Add the deployed admin/platform `/reset-password` destinations for recovery.
5. Approve exact localhost callback URLs separately for interactive DEV OAuth.
   Automated preview tests do not require live providers or real accounts.

## Acceptance Boundaries

- First-time provider authentication can create a normal identity, not operator
  access or gym permissions. Platform operators still require an active database
  role. Public platform operator signup must not be added.
- Existing member consent/activation review remains mandatory after OAuth.
  Clicking a provider button must not accept policies or marketing consent.
- PKCE requires returning in the browser/device where the flow began. Do not send
  a code verifier, access/refresh token or provider secret between portal origins.
- Test Google and Apple with disposable accounts, denial/cancellation, callback
  errors, expired/missing verifiers, disabled providers and access-query failures.
- Test Apple's private relay addresses and profile completion; do not assume every
  provider supplies a stable display name or a public email address.
- Native iOS/Android identity-token flows, deep links, entitlements and device
  testing require separate native implementation/verification; web OAuth buttons
  do not establish those workflows.

## Next Release Gates

The owner approved a reset email, but none has been sent: the hosted platform
`/reset-password` route currently returns 404, and the old admin forgot-password
screen is a placeholder that never submits a request. Both recovery flows are
now implemented locally. A working deployed destination and redirect allowlist
must precede the real email; do not send an unusable or misleading link.

Public-branch/hosted DEV preview approval has been requested separately. That
request does not authorize a production release or relax the security gates.

Review and deploy the code only after security-branch publication approval and
the existing release gates. Configure providers, verify redirects and perform
the disposable end-to-end Auth acceptance pass. Continue the unresolved tar,
session-revocation and retention repairs, then execute the separately approved
hosted penetration-test scope. No GDPR or penetration-test completion is claimed.

## Local Verification

- All three web-app production builds and seven package typechecks pass.
- Security checks include 53 existing Node checks, 10 social-auth checks, 7
  recovery-proof checks and 12 mobile checks.
- The combined Chromium suite checks desktop/mobile layout, disabled providers,
  both provider PKCE initiations, safe callback errors, restored operator sessions,
  access denial/query failure, callback exchanges without role grants, real reset
  request construction and successful password confirmation/sign-out using mocks.
- New social flows default to PKCE. Legacy email callback tokens are accepted only
  through explicit compatibility handling; they do not grant operator roles.
- Recovery proof survives duplicate notifications for the same exchanged token,
  but a different sign-in or sign-out invalidates it. Ordinary cached sessions do
  not establish recovery. Failed or missing proof leaves the form unavailable.
- Provider secrets, actual OAuth consent screens, live email delivery and native
  iOS/Android social authentication are not covered by local web fixtures.

## Primary References

- [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Supabase PKCE and automatic browser exchange](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
