import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium, expect } = require("@playwright/test");
const captcha = "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
const rateLimit = "Too many attempts. Wait a few minutes, then try again.";
const offline = "Cannot reach the sign-in service. Check your connection and try again. If it continues, contact support.";
const generic = "Authentication could not be completed. Try again or contact support.";
let server, browser, origin;

before(async () => {
  const bundle = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {AuthProvider,useAuth} from "./src/contexts/auth-context";
      import Login from "./src/app/(auth)/login/page";
      import ForgotPassword from "./src/app/(auth)/forgot-password/page";
      window.fixture = {error:null,throws:false,calls:[],redirects:[],widgetMounts:0,nextToken:"synthetic-token"};
      function Probe() {
        const {signIn}=useAuth();
        window.contextSignIn=token=>signIn("member@example.test","password123",token);
        return location.pathname==="/forgot-password" ? <ForgotPassword/> : <Login/>;
      }
      createRoot(document.getElementById("root")).render(<AuthProvider><Probe/></AuthProvider>);
    ` },
    bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY": "window.fixtureSiteKey",
      "process.env.NEXT_PUBLIC_KRUXT_VERIFIED_SOCIAL_PROVIDERS": "window.fixtureSocialProviders" },
    plugins: [{ name: "local-auth-fixtures", setup(builder) {
      builder.onResolve({ filter: /^@kruxt\/ui\/auth-captcha$/ }, () => ({ path: resolve(app, "../../packages/ui/src/auth-captcha.tsx") }));
      builder.onResolve({ filter: /^@kruxt\/ui\/social-sign-in$/ }, () => ({ path: resolve(app, "../../packages/ui/src/social-sign-in.ts") }));
      builder.onResolve({ filter: /^@hcaptcha\/react-hcaptcha$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^next\/|^@\/services$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/services\/supabase-client$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^@\// }, args => {
        const extension = args.path.startsWith("@/contexts/") ? ".tsx" : ".ts";
        return { path: resolve(app, "src", args.path.slice(2) + extension) };
      });
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        loader: "tsx", resolveDir: app,
        contents: args.path === "@hcaptcha/react-hcaptcha" ? `
          import {useEffect,useState} from "react";
          export default function SyntheticCaptcha({onLoad,onVerify,size}) {
            const [id]=useState(()=>++window.fixture.widgetMounts);
            useEffect(()=>{onLoad();},[]);
            return <button type="button" data-testid="synthetic-captcha" data-mount={id}
              data-size={size} onClick={()=>onVerify(window.fixture.nextToken)}>Verify synthetic challenge</button>;
          }
        ` : args.path === "next/link" ? `
          export default function Link({children,...props}) { return <a {...props}>{children}</a>; }
        ` : args.path === "next/navigation" ? `
          export const useRouter=()=>({replace:path=>window.fixture.redirects.push(path)});
        ` : args.path.endsWith("supabase-client") ? `
          export const getAdminSupabasePublicConfig=()=>({url:location.origin+"/fixture-auth",anonKey:"synthetic-public-key"});
        ` : `
          async function request(method,args) {
            window.fixture.calls.push({method,args});
            if(window.fixture.throws) throw window.fixture.error;
            return {data:{session:null},error:window.fixture.error};
          }
          const client={auth:{
            getSession:async()=>({data:{session:null},error:null}),
            onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
            signInWithPassword:args=>request("signin",args),
            signUp:args=>request("signup",args),
            resetPasswordForEmail:(email,options)=>request("reset",{email,options}),
            signInWithOAuth:args=>request("oauth",args)
          }};
          export const createAdminSupabaseClient=()=>client;
        `
      }));
    } }]
  });
  server = createServer((req, res) => {
    if (req.url === "/fixture-auth/auth/v1/settings") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ external: { google: true, apple: true } }));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<div id="root"></div><script>' + bundle.outputFiles[0].text + '</script>');
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
});

async function fixture(t, path = "/login", { configured = false, socialProviders = null } = {}) {
  const page = await browser.newPage();
  t.after(() => page.close());
  const errors = [], external = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  t.after(() => {
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], "auth fixtures never call hosted services");
  });
  // UUID-shaped fixture input only, never a hosted challenge/site key.
  await page.addInitScript(({ configured, socialProviders }) => {
    window.fixtureSiteKey = configured ? "00000000-0000-0000-0000-000000000000" : undefined;
    window.fixtureSocialProviders = socialProviders;
  }, { configured, socialProviders });
  await page.goto(origin + path);
  await expect(page.getByRole("button", { name: path === "/login" ? "Sign In" : "Send Reset Link", exact: true })).toBeEnabled();
  return page;
}

for (const flow of ["signin", "signup", "reset"]) {
  test(`configured ${flow} fails closed, forwards fresh tokens exactly once, and resets after errors and retry`, async t => {
    const page = await fixture(t, flow === "reset" ? "/forgot-password" : "/login", { configured: true });
    if (flow === "signup") await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("member@example.test");
    if (flow !== "reset") await page.getByLabel("Password", { exact: true }).fill("password123");
    const submit = page.getByRole("button", { name: flow === "reset" ? "Send Reset Link" : flow === "signup" ? "Create account" : "Sign In", exact: true });
    const widget = page.getByTestId("synthetic-captcha");
    await expect(widget).toHaveAttribute("data-size", "compact");
    await submit.click();
    await expect(page.getByRole("alert")).toHaveText(captcha);
    assert.deepEqual(await page.evaluate(() => window.fixture.calls), []);

    const attempts = [
      { token: `${flow}-rejected-token`, error: { code: "captcha_failed", message: "private-provider-detail" }, throws: false, message: captcha },
      { token: `${flow}-network-token`, error: { message: "Network request failed" }, throws: true, message: offline },
      { token: `${flow}-success-token`, error: null, throws: false },
    ];
    for (const [index, attempt] of attempts.entries()) {
      await page.evaluate(attempt => {
        window.fixture.nextToken = attempt.token;
        window.fixture.error = attempt.error;
        window.fixture.throws = attempt.throws;
      }, attempt);
      const mount = await widget.getAttribute("data-mount");
      await widget.click();
      await expect(page.getByText("Security verification complete.", { exact: true })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await submit.click();
      const calls = await page.evaluate(() => window.fixture.calls);
      assert.equal(calls.length, index + 1);
      assert.deepEqual(calls[index], {
        method: flow,
        args: flow === "reset"
          ? { email: "member@example.test", options: { redirectTo: `${origin}/reset-password`, captchaToken: attempt.token } }
          : { email: "member@example.test", password: "password123", options: { captchaToken: attempt.token } },
      });
      if (attempt.error) {
        await expect(page.getByRole("alert")).toHaveText(attempt.message);
        await expect(submit).toBeEnabled();
        await expect(widget).not.toHaveAttribute("data-mount", mount);
        await expect(page.getByText("Security verification complete.", { exact: true })).toHaveCount(0);
        await submit.click();
        await expect(page.getByRole("alert")).toHaveText(captcha);
        assert.equal(await page.evaluate(() => window.fixture.calls.length), index + 1, "a consumed token cannot be retried");
      } else {
        await expect(page.getByRole("alert")).toHaveCount(0);
        if (flow === "reset") await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
        else {
          await expect(widget).not.toHaveAttribute("data-mount", mount);
          if (flow === "signin") assert.deepEqual(await page.evaluate(() => window.fixture.redirects), ["/"]);
          if (flow === "signup") await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
        }
      }
    }
  });
}

for (const flow of ["signin", "signup", "reset"]) {
  test(`configured ${flow} keeps unrelated authentication errors visible after verification`, async t => {
    const page = await fixture(t, flow === "reset" ? "/forgot-password" : "/login", { configured: true });
    if (flow === "signup") await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("member@example.test");
    if (flow !== "reset") await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.evaluate(() => {
      window.fixture.error = { code: "invalid_credentials", message: "private-provider-detail" };
    });
    const widget = page.getByTestId("synthetic-captcha");
    await widget.click();
    await expect(page.getByText("Security verification complete.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: flow === "reset" ? "Send Reset Link" : flow === "signup" ? "Create account" : "Sign In", exact: true }).click();
    const expected = flow === "reset" ? generic : "Email or password is incorrect.";
    await expect(page.getByRole("alert")).toHaveText(expected);
    await expect(page.getByText("Security verification complete.", { exact: true })).toHaveCount(0);
    await page.evaluate(() => { window.fixture.nextToken = "synthetic-reverified-token"; });
    await widget.click();
    await expect(page.getByText("Security verification complete.", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveText(expected);
    assert.equal(await page.evaluate(() => window.fixture.calls.length), 1, "verification alone does not retry authentication");
    assert.equal(await page.locator("body").textContent().then(text => text.includes("private-provider-detail")), false);
  });
}

test("configured mode switches discard verified tokens in both directions", async t => {
  const page = await fixture(t, "/login", { configured: true });
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  const widget = page.getByTestId("synthetic-captcha");
  for (const [mode, submit] of [["Sign up", "Create account"], ["Sign in", "Sign In"]]) {
    await widget.click();
    await expect(page.getByText("Security verification complete.", { exact: true })).toBeVisible();
    const mount = await widget.getAttribute("data-mount");
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(widget).not.toHaveAttribute("data-mount", mount);
    await page.getByRole("button", { name: submit, exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(captcha);
    assert.deepEqual(await page.evaluate(() => window.fixture.calls), []);
  }
});

test("configured context callers fail closed without a token and preserve exact token options", async t => {
  const page = await fixture(t, "/login", { configured: true });
  assert.deepEqual(await page.evaluate(() => window.contextSignIn()), { error: captcha });
  assert.deepEqual(await page.evaluate(() => window.contextSignIn("   ")), { error: captcha });
  assert.deepEqual(await page.evaluate(() => window.fixture.calls), []);
  assert.deepEqual(await page.evaluate(() => window.contextSignIn("synthetic-direct-token")), {});
  assert.deepEqual(await page.evaluate(() => window.fixture.calls), [{
    method: "signin", args: { email: "member@example.test", password: "password123", options: { captchaToken: "synthetic-direct-token" } },
  }]);
});

test("social buttons stay hidden until a provider is listed as verified", async t => {
  const page = await fixture(t, "/login");
  await expect(page.getByRole("button", { name: /Continue with/ })).toHaveCount(0);
  const appleOnly = await fixture(t, "/login", { socialProviders: "apple" });
  await expect(appleOnly.getByRole("button", { name: "Continue with Apple", exact: true })).toBeVisible();
  await expect(appleOnly.getByRole("button", { name: "Continue with Google", exact: true })).toHaveCount(0);
});

for (const provider of ["google", "apple"]) {
  test(`configured ${provider} OAuth remains usable without CAPTCHA or password fields`, async t => {
    const page = await fixture(t, "/login", { configured: true, socialProviders: "google,apple" });
    await expect(page.getByTestId("synthetic-captcha")).toBeVisible();
    await page.evaluate(() => { window.fixture.error = { code: "synthetic_oauth_failure" }; });
    const button = page.getByRole("button", { name: `Continue with ${provider === "google" ? "Google" : "Apple"}` });
    await button.click();
    await expect(page.getByRole("alert")).toHaveText("Social sign-in could not be completed. Try again or use email and password.");
    await expect(button).toBeEnabled();
    assert.deepEqual(await page.evaluate(() => window.fixture.calls), [{
      method: "oauth", args: { provider, options: { redirectTo: `${origin}/login` } },
    }]);
    await expect(page.getByText("Security verification complete.", { exact: true })).toHaveCount(0);
  });
}

test("context preserves the optional string error contract and normalizes only once", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.fixture.error = { code: "captcha_failed", message: "secret-provider-token" }; });
  assert.deepEqual(await page.evaluate(() => window.contextSignIn()), { error: captcha });
  await page.evaluate(() => { window.fixture.error = null; });
  assert.deepEqual(await page.evaluate(() => window.contextSignIn()), {});
});

for (const flow of ["signin", "signup", "reset"]) {
  test(`${flow} renders safe CAPTCHA/rate-limit errors, preserves recovery privacy, and allows retry`, async t => {
    const page = await fixture(t, flow === "reset" ? "/forgot-password" : "/login");
    if (flow === "signup") await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("member@example.test");
    if (flow !== "reset") await page.getByLabel("Password", { exact: true }).fill("password123");
    const submit = page.getByRole("button", { name: flow === "reset" ? "Send Reset Link" : flow === "signup" ? "Create account" : "Sign In", exact: true });
    const cases = [
      ...["captcha_failed", "captcha_required", "captcha_expired"].map(code => [{ code, message: "Failed to fetch secret-provider-token" }, captcha]),
      ...["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"].map(code => [{ code, message: "secret-provider-token" }, rateLimit]),
      [{ status: 429, message: "secret-provider-token" }, rateLimit],
      [{ code: "invalid_credentials", message: "secret-provider-token" }, flow === "reset" ? generic : "Email or password is incorrect."],
      [{ code: "email_not_confirmed", message: "secret-provider-token" }, flow === "reset" ? generic : "Confirm your email before signing in."],
      [{ code: "user_not_found", message: "secret-provider-token" }, generic],
      [{ message: "Invalid login credentials" }, flow === "reset" ? generic : "Email or password is incorrect."],
      [{ message: "Email not confirmed" }, flow === "reset" ? generic : "Confirm your email before signing in."],
      [{ message: "User not found" }, generic],
      [{ message: "Failed to fetch" }, offline],
      [{ message: "<script>secret-provider-token</script>" }, generic],
      [{ code: "unknown_error", message: "secret-provider-token" }, generic]
    ];
    for (const [error, expected] of cases) {
      await page.evaluate(error => { window.fixture.error = error; }, error);
      await submit.click();
      await expect(page.getByRole("alert")).toHaveText(expected);
      await expect(submit).toBeEnabled();
      assert.equal(await page.locator("body").textContent().then(text => text.includes("secret-provider-token")), false);
    }
    await page.evaluate(() => { window.fixture.error = { message: "Network request failed" }; window.fixture.throws = true; });
    await submit.click();
    await expect(page.getByRole("alert")).toHaveText(offline);
    await expect(submit).toBeEnabled();
    assert.deepEqual(await page.evaluate(() => [...new Set(window.fixture.calls.map(call => call.method))]), [flow]);

    await page.evaluate(() => { window.fixture.error = null; window.fixture.throws = false; });
    await submit.click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    if (flow === "signin") await page.waitForFunction(() => window.fixture.redirects.length === 1);
    if (flow === "signup") await expect(page.getByRole("status")).toHaveText("Check your email for a confirmation link if one is needed, then sign in. If you already have an account, sign in or reset your password.");
    if (flow === "reset") await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
  });
}
