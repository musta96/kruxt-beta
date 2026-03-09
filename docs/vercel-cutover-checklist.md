# KRUXT Lovable -> Vercel Cutover Checklist

## Goal
Retire the Lovable-hosted frontend and make the Next.js app in `apps/web` the only production web surface.

## Canonical Production Surface
- App: `apps/web`
- Host: Vercel
- Current production URL target: `https://kruxt-foundation-kit.vercel.app`
- Current Lovable URL to retire: `https://kruxt-beta-bliss.lovable.app`

## Pre-cutover checks
- [ ] Vercel deploy is on the latest `main`
- [ ] Founder account can sign in and reach `/admin`
- [ ] Gym staff account can sign in and reach `/org`
- [ ] Member account can sign in and reach `/feed`
- [ ] Invite links open `/accept-invite` on the Vercel domain

## Supabase Auth configuration
In Supabase Dashboard -> Authentication -> URL Configuration:

1. Set `Site URL` to the Vercel production URL or final custom domain.
2. Keep only redirect URLs that are still valid for the Next app.
3. Remove Lovable redirect URLs after Vercel auth flow is confirmed.

### Required redirect URLs
- `https://kruxt-foundation-kit.vercel.app`
- `https://kruxt-foundation-kit.vercel.app/accept-invite`
- Your Vercel preview domains if you want preview auth testing
- Your custom production domain once attached

### URLs to remove after cutover
- Any `*.lovable.app/**`
- Any `lovable.dev/projects/...`
- Any deprecated preview URLs from the old app

## Edge function configuration
Set the public app URL used by invite/email flows:

- Secret name: `APP_PUBLIC_URL`
- Value: your Vercel production URL or final custom domain

This ensures invite links point to the active app instead of Lovable.

## Domain cutover
1. Attach your real domain to the Vercel project.
2. Make the domain target the Vercel deployment, not Lovable.
3. Re-run founder login, staff login, member login, and invite acceptance on the custom domain.

## Final smoke test
- [ ] `/`
- [ ] `/feed`
- [ ] `/log`
- [ ] `/profile`
- [ ] `/admin`
- [ ] `/org`
- [ ] `/accept-invite?token=...`

## Decommission Lovable
- Stop using the Lovable URL for testing
- Remove Lovable auth redirects
- Treat the old Lovable deployment as deprecated
- If needed, archive the Lovable project after domain and auth cutover are complete
