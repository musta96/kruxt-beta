import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runHealthChecks } from "./check-runtime-health.mjs";

test("default checks are local-only, omit credentials and refuse redirects", async () => {
  const requests = [];
  const result = await runHealthChecks({ fetchImpl: async (url, options) => {
    requests.push(url);
    assert.equal(new URL(url).hostname, "127.0.0.1");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers, undefined);
    return new Response("fixture", { status: 200 });
  } });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 3);
});
test("hosted auth is not marked healthy without a public key or actual GoTrue response", async () => {
  const noKey = await runHealthChecks({ mode: "hosted", fetchImpl: async () => new Response("fixture") });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.checks.at(-1).reason, "public_key_not_configured");
  const wrongBody = await runHealthChecks({ mode: "hosted", publicKey: "sb_publishable_fixture", fetchImpl: async () =>
    Response.json({ name: "not-auth" }) });
  assert.equal(wrongBody.ok, false);
});
test("privileged credentials are rejected before any network request", async () => {
  for (const key of ["sb_secret_fixture", `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.c`]) {
    await assert.rejects(runHealthChecks({ mode: "hosted", publicKey: key,
      fetchImpl: () => assert.fail("No network request allowed") }), /public|anon/);
  }
});
test("hosted checks use fixed targets and send the public key only to DEV Auth", async () => {
  const result = await runHealthChecks({ mode: "hosted", publicKey: "sb_publishable_fixture", fetchImpl: async (url, options) => {
    if (new URL(url).hostname.endsWith("supabase.co")) {
      assert.equal(url, "https://hgomsmhsybrxjdxbgkjy.supabase.co/auth/v1/health");
      assert.equal(options.headers.apikey, "sb_publishable_fixture");
      return Response.json({ name: "GoTrue" });
    }
    assert.equal(options.headers, undefined);
    return new Response("fixture");
  } });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /sb_publishable|apikey/);
});
test("network errors and failure response bodies cannot leak into reports", async () => {
  const result = await runHealthChecks({ fetchImpl: async () => { throw new Error("token=private"); } });
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /token=private/);
});

test("social readiness is opt-in, hosted-only and requires exact boolean enablement", async () => {
  await assert.rejects(runHealthChecks({ requireSocial: true, fetchImpl: () => assert.fail() }), /hosted mode/);
  const result = await runHealthChecks({ mode: "hosted", requireSocial: true, publicKey: "sb_publishable_fixture",
    fetchImpl: async url => url.endsWith("/settings")
      ? Response.json({ external: { google: true, apple: false } })
      : Response.json({ name: "GoTrue" }) });
  assert.equal(result.ok, false);
  assert.deepEqual(result.checks.slice(-2), [
    { service: "auth_google", ok: true, reason: "provider_enabled_not_e2e_verified" },
    { service: "auth_apple", ok: false, reason: "provider_disabled" }
  ]);
});

test("provider response failures and malformed flags fail closed without leaking bodies", async () => {
  for (const value of [{ external: { google: "true", apple: 1 }, secret: "NEVER_REPORT" }, { external: [] }, null]) {
    const result = await runHealthChecks({ mode: "hosted", requireSocial: true, publicKey: "sb_publishable_fixture",
      fetchImpl: async url => url.endsWith("/settings") ? Response.json(value) : Response.json({ name: "GoTrue" }) });
    assert.equal(result.ok, false);
    assert.ok(result.checks.slice(-2).every(check => check.reason === "provider_settings_unverified"));
    assert.doesNotMatch(JSON.stringify(result), /NEVER_REPORT|sb_publishable/);
  }
});

const authOrigin = "https://hgomsmhsybrxjdxbgkjy.supabase.co";
const privateMarker = "NEVER_REPORT_PRIVATE";
function providerLocation(provider) {
  const url = new URL(provider === "google"
    ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://appleid.apple.com/auth/authorize");
  url.search = new URLSearchParams({ client_id: provider === "apple" ? "com.kruxt.web.dev" : "123-fixture.apps.googleusercontent.com",
    redirect_uri: `${authOrigin}/auth/v1/callback`, response_type: "code", state: privateMarker,
    ...(provider === "apple" ? { response_mode: "form_post" } : {}) }).toString();
  return url;
}

async function oauthChecks({ authorize, requireSocial = false } = {}) {
  const requests = [];
  const result = await runHealthChecks({ mode: "hosted", publicKey: "sb_publishable_fixture", requireOAuthStart: true,
    requireSocial, fetchImpl: async (input, options) => {
      const url = new URL(input);
      requests.push({ url, options });
      if (url.pathname === "/auth/v1/authorize") {
        const provider = url.searchParams.get("provider");
        return authorize ? authorize(provider, url, options)
          : new Response(null, { status: 302, headers: { location: providerLocation(provider).href } });
      }
      if (url.pathname === "/auth/v1/settings") return Response.json({ external: { google: true, apple: true } });
      return Response.json({ name: "GoTrue" });
    } });
  const report = JSON.stringify(result);
  assert.doesNotMatch(report, /NEVER_REPORT_PRIVATE|sb_publishable|apikey|client_id|code_challenge|state|location|upstream/i);
  return { result, requests };
}

test("OAuth initiation is independently opt-in, hosted-only and requires a public key", async () => {
  await assert.rejects(runHealthChecks({ requireOAuthStart: true, fetchImpl: () => assert.fail("No network") }), /hosted mode/);
  const noKey = await runHealthChecks({ mode: "hosted", requireOAuthStart: true,
    fetchImpl: async url => {
      assert.ok(!url.includes("/auth/"));
      return new Response(null);
    } });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.checks.at(-1).reason, "public_key_not_configured");
  const defaults = await runHealthChecks({ mode: "hosted", publicKey: "sb_publishable_fixture", fetchImpl: async url => {
    assert.ok(!url.includes("/authorize") && !url.includes("/settings"));
    return Response.json({ name: "GoTrue" });
  } });
  assert.equal(defaults.checks.length, 4);
});

test("OAuth starts use fresh S256 challenges, fixed DEV URLs and never follow providers", async () => {
  const challenges = new Set();
  for (let run = 0; run < 2; run++) {
    const { result, requests } = await oauthChecks();
    assert.equal(result.ok, true);
    assert.equal(requests.length, 6);
    assert.ok(!requests.some(({ url }) => url.pathname.endsWith("/settings")));
    const starts = requests.filter(({ url }) => url.pathname === "/auth/v1/authorize");
    assert.deepEqual(starts.map(({ url }) => url.searchParams.get("provider")), ["google", "apple"]);
    for (const { url, options } of starts) {
      assert.equal(url.origin, authOrigin);
      assert.deepEqual([...url.searchParams.keys()].sort(), ["code_challenge", "code_challenge_method", "provider", "redirect_to"]);
      assert.equal(url.searchParams.get("redirect_to"), "https://kruxt-beta.vercel.app/");
      assert.equal(url.searchParams.get("code_challenge_method"), "s256");
      const challenge = url.searchParams.get("code_challenge");
      assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
      assert.ok(!challenges.has(challenge));
      challenges.add(challenge);
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "manual");
      assert.equal(options.credentials, "omit");
      assert.equal(options.cache, "no-store");
      assert.deepEqual(options.headers, { apikey: "sb_publishable_fixture" });
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.signal.aborted, false);
      assert.doesNotMatch(JSON.stringify(result), new RegExp(challenge));
    }
    assert.deepEqual(result.checks.slice(-2), ["google", "apple"].map(provider => ({
      service: `auth_${provider}_oauth_start`, ok: true, reason: "oauth_start_verified_not_e2e"
    })));
  }
});

test("social settings and OAuth-start gates can be explicitly combined", async () => {
  const { result, requests } = await oauthChecks({ requireSocial: true });
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 8);
  assert.equal(requests.filter(({ url }) => url.pathname.endsWith("/settings")).length, 1);
});

test("OAuth-start rejects malicious locations and missing, duplicate or malformed parameters", async t => {
  const mutations = [
    ["http", url => url.href.replace("https:", "http:")],
    ["relative", url => `${url.pathname}${url.search}`],
    ["malformed", () => "https://[invalid"],
    ["suffix host", url => url.href.replace(url.hostname, `${url.hostname}.evil.test`)],
    ["foreign host", url => url.href.replace(url.hostname, "evil.test")],
    ["credentials", url => url.href.replace("https://", "https://user:password@")],
    ["credential host trick", url => url.href.replace("https://", "https://evil.test@")],
    ["port", url => url.href.replace(url.hostname, `${url.hostname}:444`)],
    ["wrong path", url => { url.pathname = "/unexpected"; return url.href; }],
    ["fragment", url => `${url.href}#${privateMarker}`],
    ["empty fragment", url => `${url.href}#`],
    ["backslash", url => url.href.replace("https://", "https://\\")],
    ["leading whitespace", url => ` ${url.href}`],
    ["malformed percent escape", url => `${url.href}&scope=%zz`],
    ...["client_id", "redirect_uri", "response_type", "state"].flatMap(key => [
      [`missing ${key}`, url => { url.searchParams.delete(key); return url.href; }],
      [`empty ${key}`, url => { url.searchParams.set(key, ""); return url.href; }],
      [`duplicate ${key}`, url => { url.searchParams.append(key, url.searchParams.get(key)); return url.href; }],
      [`encoded duplicate ${key}`, url => `${url.href}&%${key.charCodeAt(0).toString(16)}${key.slice(1)}=bad`]
    ]),
    ["duplicate unrelated", url => `${url.href}&scope=a&scope=b`],
    ["foreign callback", url => { url.searchParams.set("redirect_uri", "https://evil.test/auth/v1/callback"); return url.href; }],
    ["http callback", url => { url.searchParams.set("redirect_uri", `${authOrigin.replace("https", "http")}/auth/v1/callback`); return url.href; }],
    ["callback query", url => { url.searchParams.set("redirect_uri", `${authOrigin}/auth/v1/callback?extra=1`); return url.href; }],
    ["callback credentials", url => { url.searchParams.set("redirect_uri", `${authOrigin.replace("https://", "https://user:password@")}/auth/v1/callback`); return url.href; }],
    ["implicit response", url => { url.searchParams.set("response_type", "token"); return url.href; }],
    ["upstream error", url => { url.searchParams.set("error", privateMarker); return url.href; }]
  ];
  for (const [name, mutate] of mutations) await t.test(name, async () => {
    const { result } = await oauthChecks({ authorize: provider => ({
      status: 302, headers: { get: () => mutate(providerLocation(provider)) }
    }) });
    assert.equal(result.ok, false);
    assert.ok(result.checks.slice(-2).every(check => !check.ok && check.reason === "oauth_start_unverified"));
  });
});

test("OAuth requests enforce the ten-second abort signal and continue after timeout", async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, "timeout", milliseconds => {
    assert.equal(milliseconds, 10000);
    return timeout(1);
  });
  // Keep the event loop alive because native AbortSignal timeout timers are unref'd.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const { result, requests } = await oauthChecks({ authorize: (provider, url, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      }) });
    assert.equal(requests.length, 6);
    assert.ok(result.checks.slice(-2).every(check => !check.ok && check.reason === "oauth_start_unverified"));
  } finally { clearTimeout(keepAlive); }
});

test("Apple requires the exact DEV Services ID and form_post", async () => {
  for (const [key, value] of [["client_id", "com.kruxt.web"], ["response_mode", "query"],
    ["response_mode", null], ["response_mode", "duplicate"]]) {
    const { result } = await oauthChecks({ authorize: provider => {
      const url = providerLocation(provider);
      if (provider === "apple") {
        if (value === null) url.searchParams.delete(key);
        else if (value === "duplicate") url.searchParams.append(key, "form_post");
        else url.searchParams.set(key, value);
      }
      return new Response(null, { status: 302, headers: { location: url.href } });
    } });
    assert.equal(result.checks.at(-2).ok, true);
    assert.equal(result.checks.at(-1).ok, false);
  }
});

test("statuses, absent locations, response failures and timeouts fail closed without body reads", async () => {
  for (const status of [200, 301, 303, 307, 308, 400, 401, 500]) {
    const { result } = await oauthChecks({ authorize: provider => ({ status,
      headers: new Headers({ location: providerLocation(provider).href }),
      json: () => assert.fail("Must not read body"), text: () => assert.fail("Must not read body") }) });
    assert.ok(result.checks.slice(-2).every(check => !check.ok));
  }
  for (const authorize of [
    () => new Response(privateMarker, { status: 302 }),
    () => { throw new Error(privateMarker); },
    () => { throw new DOMException(privateMarker, "TimeoutError"); },
    () => ({ status: 302, headers: { get: () => { throw new Error(privateMarker); } } }),
    () => ({ status: 302, headers: { get: () => "\nhttps://accounts.google.com/" } })
  ]) {
    const { result } = await oauthChecks({ authorize });
    assert.ok(result.checks.slice(-2).every(check => !check.ok));
  }
});

test("CLI flags reject duplicates, unknown flags and local OAuth-start; combined hosted flags work offline", () => {
  const script = fileURLToPath(new URL("./check-runtime-health.mjs", import.meta.url));
  // Preload a fetch stub so even valid hosted CLI invocations cannot use the network.
  const preload = `data:text/javascript,${encodeURIComponent(`globalThis.fetch = async () => Response.json({name: "GoTrue"});`)}`;
  const invoke = args => spawnSync(process.execPath, ["--import", preload, script, ...args], {
    encoding: "utf8", env: { ...process.env, KRUXT_HEALTH_PUBLIC_KEY: "sb_publishable_fixture" }
  });
  for (const flags of [["--require-oauth-start", "--require-oauth-start"], ["--unknown"],
    ["--hosted", "--hosted"], ["--require-social", "--require-social"]]) {
    const output = invoke(flags);
    assert.equal(output.status, 1);
    assert.match(output.stderr, /Usage:/);
    assert.equal(output.stdout, "");
  }
  const local = invoke(["--require-oauth-start"]);
  assert.equal(local.status, 1);
  assert.match(local.stderr, /requires hosted mode/);
  assert.equal(local.stdout, "");
  for (const flags of [["--hosted", "--require-oauth-start"], ["--hosted", "--require-social", "--require-oauth-start"]]) {
    const output = invoke(flags);
    assert.equal(output.status, 1);
    assert.equal(output.stderr, "");
    const report = JSON.parse(output.stdout);
    assert.equal(report.checks.length, flags.length === 3 ? 8 : 6);
    assert.ok(report.checks.slice(-2).every(check => !check.ok));
    assert.doesNotMatch(output.stdout, /sb_publishable|apikey|client_id|code_challenge|state|location/i);
  }
});
