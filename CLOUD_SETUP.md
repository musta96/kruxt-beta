# KRUXT — Cloud Dev Setup

Goal: move builds/caches off your Mac. All code is already on GitHub; your
laptop is only a build/run environment.

Do these in order. **Vercel first** — it removes the need to run the web apps
locally and gives the fastest disk relief.

---

## 1. Vercel — host web / admin / platform

Each Next.js app becomes its own Vercel project. Configs are committed
(`apps/<app>/vercel.json`): they install the whole pnpm workspace from the repo
root and build only that app via `turbo --filter`.

For **each** of the three apps, in the Vercel dashboard → **Add New → Project**:

| App | Project name | Root Directory | Local dev port |
|-----|--------------|----------------|----------------|
| Consumer web | `kruxt-web` | `apps/web` | 3200 |
| Gym admin | `kruxt-admin` | `apps/admin` | 3000 |
| Platform | `kruxt-platform` | `apps/platform` | 3100 |

Steps per project:
1. Import the `musta96/kruxt-beta` repo.
2. **Set Root Directory** to the path above (e.g. `apps/admin`). Leave
   "Include source files outside of the Root Directory" **enabled** (default) —
   the build needs the workspace root for pnpm + shared packages.
3. Framework Preset auto-detects **Next.js**. Don't override Build/Install —
   the committed `vercel.json` already sets them.
4. **Environment Variables** (Production + Preview) — copy from each app's
   `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - any `NEXT_PUBLIC_KRUXT_*_URL` the app uses (set these to the **Vercel URLs**
     of the sibling apps once you know them, so cross-links work).
5. Deploy.

**Spend protection (do this):** Settings → Billing → set a **Spend Limit**.
Hobby tier is free for testing but enable usage caps. See https://vercel.com/pricing.

> Pushes to the branch auto-deploy. PRs get preview URLs automatically.

---

## 2. GitHub Codespaces — code without local node_modules

`.devcontainer/devcontainer.json` is committed: Node 20, pnpm 10.6.5 via
corepack, `pnpm install` on create, and ports 3000/3100/3200 (+ Metro/Expo)
forwarded.

1. GitHub repo → **Code ▸ Codespaces ▸ Create codespace on `<branch>`**.
2. Wait for `pnpm install` (postCreate) to finish.
3. Run an app, e.g. `pnpm --filter @kruxt/admin dev` → click the forwarded
   port toast to open it.
4. Add the same Supabase env vars as **Codespaces secrets**
   (Settings → Codespaces → Secrets) so they're injected automatically.

Free quota on personal accounts is generous (commonly 120 core-hours /
15 GB-month). See https://github.com/features/codespaces.
Stop the codespace when idle to conserve hours.

---

## 3. Expo EAS — cloud mobile builds (no local Xcode)

`apps/mobile/eas.json` now has `development` (simulator dev client),
`preview` (internal distribution), and `production` profiles + channels.

```bash
cd apps/mobile
npm i -g eas-cli          # one-time, global (tiny)
eas login
eas build:configure       # links the project (creates projectId) — commit the change
eas build --profile preview --platform ios     # cloud build, installable
```

For day-to-day JS testing you don't even need a build: `pnpm --filter
@kruxt/mobile dev` + the **Expo Go** app on your phone (expo-video is bundled in
Expo Go SDK 52). Use `--tunnel` if your phone isn't on the same network.

Free plan includes monthly build credit. See https://expo.dev/pricing.

---

## Fast local disk relief (run anytime)

```bash
pnpm store prune
rm -rf ~/.turbo
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

Nothing precious is deleted — these are all regenerable caches.

---

## Ownership

Cloud/dev-infra config (this file, `vercel.json`, `.devcontainer/`, `eas.json`)
is owned by one agent (Claude) to avoid root-level conflicts. Backend work
(Supabase, `gym-service`, migrations, RLS, UAT) runs in parallel on its own
branch.
