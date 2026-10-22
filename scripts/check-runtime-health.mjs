import { pathToFileURL } from "node:url";

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

export async function runHealthChecks({ mode = "local", publicKey, fetchImpl = fetch } = {}) {
  if (!["local", "hosted"].includes(mode)) throw new Error("Choose local or hosted mode.");
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
    }
  }
  return { mode, ok: checks.every(check => check.ok), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--hosted") || args.length > 1) {
    console.error("Usage: pnpm health:check [--hosted]");
    process.exitCode = 1;
  } else {
    try {
      const result = await runHealthChecks({ mode: args.includes("--hosted") ? "hosted" : "local",
        publicKey: process.env.KRUXT_HEALTH_PUBLIC_KEY });
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
