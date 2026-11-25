import { pathToFileURL } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const ref = "hgomsmhsybrxjdxbgkjy";
const hostedTargets = [
  ["web", "https://kruxt-beta.vercel.app/"],
  ["admin", "https://kruxt-admin.vercel.app/login"],
  ["platform", "https://kruxt-platform.vercel.app/login"]
];
const localTargets = [
  ["web", "http://127.0.0.1:3290/"],
  ["admin", "http://127.0.0.1:3291/login"],
  ["platform", "http://127.0.0.1:3292/login"]
];

function validatePublicKey(key) {
  if (typeof key !== "string" || key.length > 8192) throw new Error("A public API key is required.");
  if (key.startsWith("sb_publishable_")) return;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
    if (payload.role === "anon" && payload.ref === ref) return;
  } catch { /* Reject malformed or privileged credentials without echoing them. */ }
  throw new Error("Use only the DEV anon/publishable key, never a service or secret key.");
}

function validOAuthLocation(location, provider) {
  const host = provider === "google" ? "accounts.google.com" : "appleid.apple.com";
  const path = provider === "google" ? "/o/oauth2/v2/auth" : "/auth/authorize";
  if (typeof location !== "string" || !location.startsWith(`https://${host}/`)
    || /[\s\\\x00-\x1f\x7f]/.test(location) || /%(?![a-f\d]{2})/i.test(location)) return false;
  try {
    const url = new URL(location);
    const params = url.searchParams;
    if (url.origin !== `https://${host}` || url.pathname !== path || url.hash || location.includes("#")
      || url.username || url.password || [...params.keys()].some(key => params.getAll(key).length !== 1)) return false;
    const clientId = params.get("client_id");
    return params.get("redirect_uri") === `https://${ref}.supabase.co/auth/v1/callback`
      && params.get("response_type") === "code"
      && Boolean(params.get("state")?.trim())
      && !params.has("error") && !params.has("error_description")
      && (provider === "apple"
        ? clientId === "com.kruxt.web.dev" && params.get("response_mode") === "form_post"
        : Boolean(clientId?.trim()) && !/[\s\x00-\x1f\x7f]/.test(clientId));
  } catch { return false; }
}

async function checkOAuthStart(provider, publicKey, fetchImpl) {
  try {
    // Only the challenge leaves this process; no verifier or session is retained.
    const challenge = createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url");
    const url = new URL(`https://${ref}.supabase.co/auth/v1/authorize`);
    url.search = new URLSearchParams({ provider, redirect_to: hostedTargets[0][1],
      code_challenge: challenge, code_challenge_method: "s256" }).toString();
    const response = await fetchImpl(url.href, {
      method: "GET", headers: { apikey: publicKey }, redirect: "manual", credentials: "omit",
      cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    const ok = response.status === 302 && validOAuthLocation(response.headers.get("location"), provider);
    return { service: `auth_${provider}_oauth_start`, ok,
      reason: ok ? "oauth_start_verified_not_e2e" : "oauth_start_unverified" };
  } catch {
    return { service: `auth_${provider}_oauth_start`, ok: false, reason: "oauth_start_unverified" };
  }
}

export async function runHealthChecks({ mode = "local", publicKey, requireSocial = false,
  requireOAuthStart = false, fetchImpl = fetch } = {}) {
  if (!["local", "hosted"].includes(mode)) throw new Error("Choose local or hosted mode.");
  if (requireSocial && mode !== "hosted") throw new Error("Social-provider readiness requires hosted mode.");
  if (requireOAuthStart && mode !== "hosted") throw new Error("OAuth-start readiness requires hosted mode.");
  if (mode === "hosted" && publicKey) validatePublicKey(publicKey);
  const targets = mode === "hosted" ? hostedTargets : localTargets;
  const checks = [];
  for (const [service, url] of targets) {
    const start = performance.now();
    try {
      const response = await fetchImpl(url, {
        method: "GET", redirect: "error", credentials: "omit", signal: AbortSignal.timeout(10000)
      });
      checks.push({ service, ok: response.status === 200, status: response.status,
        reason: response.status === 200 ? "reachable" : "http_error",
        durationMs: Math.round(performance.now() - start) });
    } catch {
      checks.push({ service, ok: false, reason: "network_or_redirect_error",
        durationMs: Math.round(performance.now() - start) });
    }
  }
  if (mode === "hosted") {
    if (!publicKey) checks.push({ service: "auth", ok: false, reason: "public_key_not_configured" });
    else {
      try {
        const response = await fetchImpl(`https://${ref}.supabase.co/auth/v1/health`, {
          method: "GET", headers: { apikey: publicKey }, redirect: "error", credentials: "omit",
          signal: AbortSignal.timeout(10000)
        });
        const body = response.status === 200 ? await response.json() : null;
        checks.push({ service: "auth", ok: response.status === 200 && body?.name === "GoTrue",
          status: response.status,
          reason: response.status === 200 && body?.name === "GoTrue" ? "auth_healthy" : "auth_unavailable" });
      } catch { checks.push({ service: "auth", ok: false, reason: "auth_network_or_response_error" }); }
      if (requireSocial) {
        let external;
        try {
          const response = await fetchImpl(`https://${ref}.supabase.co/auth/v1/settings`, {
            method: "GET", headers: { apikey: publicKey }, redirect: "error", credentials: "omit",
            cache: "no-store", signal: AbortSignal.timeout(10000)
          });
          if (response.ok) {
            const body = await response.json();
            if (body && typeof body.external === "object" && body.external !== null && !Array.isArray(body.external)) external = body.external;
          }
        } catch { /* Provider settings cannot establish readiness on failure. */ }
        for (const provider of ["google", "apple"]) {
          checks.push({ service: `auth_${provider}`, ok: external?.[provider] === true,
            reason: external?.[provider] === true ? "provider_enabled_not_e2e_verified"
              : external?.[provider] === false ? "provider_disabled" : "provider_settings_unverified" });
        }
      }
      if (requireOAuthStart) {
        for (const provider of ["google", "apple"]) checks.push(await checkOAuthStart(provider, publicKey, fetchImpl));
      }
    }
  }
  return { mode, ok: checks.every(check => check.ok), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--hosted", "--require-social", "--require-oauth-start"].includes(arg)) || new Set(args).size !== args.length) {
    console.error("Usage: pnpm health:check [--hosted [--require-social] [--require-oauth-start]]");
    process.exitCode = 1;
  } else {
    try {
      const result = await runHealthChecks({ mode: args.includes("--hosted") ? "hosted" : "local",
        publicKey: process.env.KRUXT_HEALTH_PUBLIC_KEY, requireSocial: args.includes("--require-social"),
        requireOAuthStart: args.includes("--require-oauth-start") });
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
