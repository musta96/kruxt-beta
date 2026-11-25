import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium, expect } = require("@playwright/test");
const screenshots = resolve(app, "../../output/playwright/privacy-center");
let browser, server, origin;

before(async () => {
  const bundle = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {PrivacyScreen} from './src/components/public/PrivacyScreen';
      import {MemberShell} from './src/components/public/MemberShell';
      const user={id:'8d260000-0000-4000-8000-000000000001'};
      const listeners=new Set();
      const f=window.fixture={calls:[],requests:[],consentFailure:false,readFailure:false,failAfterSubmit:false,
        writeFailure:false,holdWrite:false,state:{status:'consent_required',user,error:null,
        access:{status:'consent_required',user,isAuthenticated:true,activationStatus:'active',error:null,staffGymIds:[],platformRole:null}}};
      f.subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
      f.get=()=>f.state;
      f.set=patch=>{f.state={...f.state,...patch};listeners.forEach(fn=>fn());};
      f.refresh=async()=>{};
      f.signOut=async()=>{f.set({status:'ready',user:null,access:null});};
      f.client={
        auth:{getUser:async()=>({data:{user:f.state.user},error:null})},
        rpc:async(name,args)=>{
          f.calls.push([name,args]);
          if(name==='submit_privacy_request'){
            if(f.holdWrite)await new Promise(done=>{f.releaseWrite=done;});
            if(f.writeFailure)return {error:{message:'private-provider-details'}};
            const id='8d260000-0000-4000-8000-'+String(f.requests.length+10).padStart(12,'0');
            f.requests.push({id,user_id:f.state.user.id,request_type:args.p_request_type,reason:args.p_reason,
              status:'submitted',submitted_at:new Date().toISOString(),due_at:'2026-11-25T00:00:00Z'});
            if(f.failAfterSubmit)f.readFailure=true;
            return {data:id,error:null};
          }
          if(f.consentFailure)return {data:null,error:{message:'private-policy-details'}};
          return {data:name==='list_missing_required_consents'?[{consent_type:'terms',required_policy_version_id:null,reason:'missing'}]:false,error:null};
        },
        from:table=>{
          f.calls.push(['from',table]);
          const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,in:()=>q,not:()=>q,
            then:(done,reject)=>Promise.resolve(f.readFailure?{error:{message:'private-read-details'}}:{data:f.requests,error:null}).then(done,reject)};
          return q;
        }
      };
      createRoot(document.getElementById('root')).render(location.pathname==='/privacy'
        ? <PrivacyScreen/> : <MemberShell title='Training' subtitle='Training'><p>Protected training marker</p></MemberShell>);
    ` },
    bundle: true, write: false, jsx: "automatic", format: "iife", outfile: "/fixture.js",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "privacy-fixtures", setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\// }, args => {
        if (["@/components/public/usePublicSession", "@/lib/marketing-url"].includes(args.path)) return { path: args.path, namespace: "fixture" };
        const base = resolve(app, "src", args.path.slice(2));
        const path = [base + ".ts", base + ".tsx"].find(candidate => existsSync(candidate));
        assert.ok(path, "Unexpected unresolved source import");
        return { path };
      });
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
        const modules = {
          link: `import React from 'react';export default function Link(props){return <a {...props}/>;}`,
          navigation: "export const usePathname=()=>location.pathname;export const useRouter=()=>({push:path=>{location.href=path;}});",
          "@/lib/marketing-url": "export const getGymAdminLoginUrl=()=>'/gym-workspace';",
          "@/components/public/usePublicSession": `import {useSyncExternalStore} from 'react';
            export const resolvePostAuthPath=()=>'/feed';
            export function usePublicSession(){const f=window.fixture;const state=useSyncExternalStore(f.subscribe,f.get);return {state,supabase:f.client,signOut:f.signOut,refresh:f.refresh,displayLabel:'Fixture member'};}`
        };
        assert.ok(Object.hasOwn(modules, args.path));
        return { loader: "tsx", resolveDir: app, contents: modules[args.path] };
      });
    } }],
  });
  const javascript = bundle.outputFiles.find(file => file.path.endsWith(".js")).text;
  const css = ["globals.css", "marketing.css"].map(file => readFileSync(resolve(app, "app", file), "utf8")).join("\n") + "\n" + (bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "");
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    res.setHeader("Content-Type", path === "/fixture.js" ? "text/javascript" : path === "/fixture.css" ? "text/css" : "text/html");
    res.end(path === "/fixture.js" ? javascript : path === "/fixture.css" ? css : '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
  mkdirSync(screenshots, { recursive: true });
});

after(async () => {
  try { await browser?.close(); }
  finally { if (server?.listening) await new Promise(done => server.close(done)); }
});

async function fixture(t, width = 1280, path = "/privacy") {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const errors = [];
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    errors.push("Unexpected hosted request");
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + path);
  return page;
}

for (const width of [1280, 390, 320]) test(`unconsented member can reach requests but not training at ${width}px`, async t => {
  const page = await fixture(t, width, "/plan");
  await expect(page.getByRole("heading", { name: "Review the current policies" })).toBeVisible();
  await expect(page.getByText("Protected training marker")).toHaveCount(0);
  await page.getByRole("link", { name: "Privacy requests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Submit a data request" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh requests" })).toBeEnabled();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return to policy review" })).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(screenshots, `privacy-${width}.png`), fullPage: true });
  await page.getByRole("link", { name: "Return to policy review" }).click();
  await expect(page.getByRole("heading", { name: "Review the current policies" })).toBeVisible();
  await expect(page.getByText("Protected training marker")).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.fixture.calls.some(call => call[0] === "accept_required_consents")), false);
});

test("consent-service and history failures do not hide the request form", async t => {
  const page = await fixture(t);
  await expect(page.getByRole("button", { name: "Refresh requests" })).toBeEnabled();
  await page.evaluate(() => { window.fixture.consentFailure = true; });
  await page.getByRole("button", { name: "Refresh requests" }).click();
  await expect(page.getByText("Policy status is temporarily unavailable. You can still submit a data request.")).toBeVisible();
  await page.evaluate(() => { window.fixture.readFailure = true; });
  await page.getByRole("button", { name: "Refresh requests" }).click();
  await expect(page.getByRole("alert")).toHaveText("Unable to load privacy requests.");
  await expect(page.getByRole("button", { name: "Submit request", exact: true })).toBeEnabled();
  await expect(page.locator("body")).not.toContainText("private-read-details");
});

test("single submission survives readback failure and blocks repeat writes", async t => {
  const page = await fixture(t);
  await expect(page.getByRole("button", { name: "Refresh requests" })).toBeEnabled();
  await page.evaluate(() => { window.fixture.holdWrite = true; window.fixture.failAfterSubmit = true; });
  await page.getByLabel("Reason or details").fill("Isolated request context");
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await page.waitForFunction(() => !!window.fixture.releaseWrite);
  await expect(page.getByLabel("Request type", { exact: true })).toBeDisabled();
  await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await page.evaluate(() => window.fixture.releaseWrite());
  await expect(page.getByRole("status")).toContainText("request was received");
  await expect(page.getByRole("alert")).toContainText("do not submit it again");
  await expect(page.getByRole("button", { name: "Request received", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Reason or details")).toHaveValue("");
  assert.equal(await page.evaluate(() => window.fixture.calls.filter(call => call[0] === "submit_privacy_request").length), 1);
  await page.evaluate(() => { window.fixture.holdWrite = false; window.fixture.writeFailure = true; });
  await page.getByLabel("Request type", { exact: true }).selectOption("export");
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Unable to submit privacy request.");
  await page.getByLabel("Request type", { exact: true }).selectOption("access");
  await expect(page.getByRole("button", { name: "Request received", exact: true })).toBeDisabled();
});

test("failed submission preserves input, redacts provider error and permits retry", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.fixture.writeFailure = true; });
  await page.getByLabel("Reason or details").fill("Keep this request context");
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Unable to submit privacy request.");
  await expect(page.getByLabel("Reason or details")).toHaveValue("Keep this request context");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("private-provider-details");
  await page.evaluate(() => { window.fixture.writeFailure = false; });
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("request was received");
});

test("fully reviewed members retain normal navigation and account changes clear entered details", async t => {
  const page = await fixture(t);
  await page.getByLabel("Reason or details").fill("Prior account private details");
  await page.evaluate(() => {
    const f = window.fixture;
    const user = { id: "8d260000-0000-4000-8000-000000000002" };
    f.set({ status: "ready", user, access: { ...f.state.access, status: "ready", user } });
  });
  await expect(page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link")).toHaveCount(5);
  await expect(page.getByLabel("Reason or details")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("Prior account private details");
  await expect(page.getByRole("heading", { name: "Submit a data request" })).toBeVisible();
});

for (const status of ["loading", "disabled", "pending_activation", "error", "signed_out"]) test(`${status} session never exposes privacy controls`, async t => {
  const page = await fixture(t);
  await page.evaluate(status => {
    const f = window.fixture;
    f.set(status === "loading" ? { status: "loading" } : status === "signed_out" ? { user: null, access: null } : status === "error"
      ? { status: "error", error: "Account unavailable" }
      : { status: "access_blocked", access: { ...f.state.access, activationStatus: status } });
  }, status);
  await expect(page.getByRole("heading", { name: "Submit a data request" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit request", exact: true })).toHaveCount(0);
});

for (const width of [1280, 390, 320]) test(`member access states share the workspace design at ${width}px`, async t => {
  const page = await fixture(t, width, "/plan");
  await expect(page.getByRole("heading", { name: "Review the current policies" })).toBeVisible();
  for (const mode of ["consent", "loading", "error", "disabled", "pending_activation", "signed_out"]) {
    await page.evaluate(mode => {
      const f = window.fixture;
      if (mode === "consent") return;
      f.set(mode === "loading" ? { status: "loading" } : mode === "signed_out" ? { status: "ready", user: null, access: null, error: null } : mode === "error"
        ? { status: "error", error: "private-provider-error" }
        : { status: "access_blocked", error: null, access: { ...f.state.access, activationStatus: mode } });
    }, mode);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText({ consent: "Review the current policies", loading: "Loading your space", error: "Account setup unavailable", disabled: "Profile disabled", pending_activation: "Activation required", signed_out: "Sign in required" }[mode]);
    const visual = await page.locator("main").evaluate(main => ({
      background: getComputedStyle(main).backgroundColor,
      fontSize: parseFloat(getComputedStyle(main.querySelector('h1')).fontSize),
      contentWidth: main.querySelector('section').getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > innerWidth
    }));
    assert.equal(visual.background, "rgb(16, 17, 20)");
    assert.ok(visual.fontSize <= 28);
    assert.ok(visual.contentWidth <= 560);
    assert.equal(visual.overflow, false);
    await expect(page.getByText("Protected training marker")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("private-provider-error");
    if (mode === "loading") await expect(page.getByRole("heading", { name: "Sign in required" })).toHaveCount(0);
    if (["consent", "loading", "signed_out"].includes(mode)) await page.screenshot({ path: resolve(screenshots, `member-${mode}-${width}.png`), fullPage: true });
  }
  const button = page.getByRole("button", { name: "Go to sign in", exact: true });
  assert.equal(await button.evaluate(el => getComputedStyle(el).borderRadius), "6px");
  await button.click();
  await page.waitForURL(origin + "/?returnTo=%2Fplan#member-login");
});

test("an unresolved account error is not misrepresented as signed out", async t => {
  const page = await fixture(t);
  await page.evaluate(() => window.fixture.set({ status: "error", user: null, access: null, error: "private-provider-error" }));
  await expect(page.getByRole("heading", { name: "Account setup unavailable" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in required" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("private-provider-error");
});

test("identity change cannot reveal a prior pending submission receipt", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.fixture.holdWrite = true; });
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await page.waitForFunction(() => !!window.fixture.releaseWrite);
  await page.evaluate(() => {
    const f = window.fixture;
    const user = { id: "8d260000-0000-4000-8000-000000000002" };
    f.set({ user, access: { ...f.state.access, user } });
    f.releaseWrite();
  });
  await expect(page.getByRole("button", { name: "Refresh requests" })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByLabel("Reason or details")).toHaveValue("");
});
