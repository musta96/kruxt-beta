import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium, expect } = require("@playwright/test");
const screenshots = resolve(app, "../../output/playwright/signup-session");
let browser, server, origin;

before(async () => {
  const bundle = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {JoinGymClient} from "./src/components/join/JoinGymClient";
      import {AcceptInviteClient} from "./src/components/invite/AcceptInviteClient";
      const user={id:"11111111-1111-4111-8111-111111111111",email:"member@example.test",user_metadata:{}};
      const session={user};
      const state=window.fixture={calls:[],hasSession:false,pause:false,error:false,activation:"active",missingUser:false,
        siteKey:new URL(location.href).searchParams.has('captcha')?'10000000-ffff-ffff-ffff-000000000001':undefined};
      const landingCase=new URL(location.href).searchParams.get('membership');
      const mid="55555555-5555-4555-8555-555555555555", gid="33333333-3333-4333-8333-333333333333";
      state.membershipId=landingCase?mid:"membership-id";
      state.membership=landingCase==="bookable"?{id:mid,gym_id:gid,user_id:user.id,membership_status:"active"}
        :landingCase==="pending"?{id:mid,gym_id:gid,user_id:user.id,membership_status:"pending"}
        :landingCase==="other-user"?{id:mid,gym_id:gid,user_id:"22222222-2222-4222-8222-222222222222",membership_status:"active"}
        :{membership_status:"active"};
      state.emit=(value)=>state.listener("SIGNED_IN",value);
      state.client={
        auth:{
          getSession:async()=>({data:{session:null}}),
          onAuthStateChange:callback=>{state.listener=callback;return {data:{subscription:{unsubscribe(){}}}};},
          getUser:async()=>{state.calls.push(["getUser"]);return {data:{user:state.missingUser?null:user},error:state.missingUser?{name:"AuthSessionMissingError",message:"private missing-session details"}:null};},
          signUp:async(args)=>{
            state.calls.push(["signUp",args]);
            state.emit(session);
            if(state.pause)await new Promise(done=>{state.release=done;});
            if(state.error)return {data:{session:null},error:{message:"private upstream account details"}};
            return {data:{user,session:state.hasSession?session:null},error:null};
          },
          signInWithPassword:async(args)=>{
            state.calls.push(["signIn",args]);state.emit(session);
            return {data:{session},error:null};
          },
          signOut:async()=>state.listener("SIGNED_OUT",null)
        },
        from:table=>{
          state.calls.push(["from",table]);
          const query={select:()=>query,eq:()=>query,
            single:async()=>({data:{activation_status:state.activation},error:null}),
            maybeSingle:async()=>table==="profiles"?({data:{activation_status:state.activation},error:null})
              :landingCase==="lookup-error"?({data:null,error:{message:"synthetic membership lookup failure"}})
              :({data:state.membership,error:null})};
          return query;
        },
        rpc:async(name,args)=>{state.calls.push(["rpc",name,args]);return {data:state.membershipId,error:null};}
      };
      createRoot(document.getElementById("root")).render(location.pathname==="/join"?<JoinGymClient/>:<AcceptInviteClient/>);
    ` },
    bundle: true, write: false, jsx: "automatic", format: "iife",
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY": "window.fixture.siteKey" },
    plugins: [{ name: "isolated-auth", setup(builder) {
      builder.onResolve({ filter: /^@hcaptcha\/react-hcaptcha$/ }, () => ({ path: "hcaptcha", namespace: "challenge" }));
      builder.onLoad({ filter: /.*/, namespace: "challenge" }, () => ({ loader: "tsx", resolveDir: app, contents: `
        import React,{useEffect} from 'react';
        export default function Provider(props){useEffect(()=>{window.fixture.challenge=props;props.onLoad?.();},[]);
          return <div style={{width:156,height:140,border:'1px solid currentColor'}} aria-label='Synthetic challenge'>Synthetic challenge</div>;}
      ` }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\// }, args => {
        if (args.path === "@/lib/auth/auth-error") return { path: resolve(app, "src/lib/auth/auth-error.ts") };
        if (args.path === "@/lib/invite/member-landing") return { path: resolve(app, "src/lib/invite/member-landing.ts") };
        return { path: args.path, namespace: "fixture" };
      });
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
        const modules = {
          navigation: 'export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>window.fixture.calls.push(["push",path])});',
          "@/lib/supabase/client": "export const createSupabaseBrowserClient=()=>window.fixture.client;",
          "@/lib/auth/access": 'export const ensureProfileForUser=async(client,args)=>{window.fixture.calls.push(["profile",args]);};',
          "@/lib/auth/required-consents": 'export const hasRequiredConsents=async()=>{window.fixture.calls.push(["consents"]);return true;};',
          "@/components/consent/RequiredConsentReview": "export const RequiredConsentReview=()=>null;",
          "@/lib/marketing-url": 'export const getGymAdminLoginUrl=()=>"https://gym-admin.example.test/login";',
          "@/lib/supabase/functions": 'export const invokeSupabaseFunction=async(client,name,args)=>{window.fixture.calls.push(["function",name,args]);return {ok:true,gymId:"gym-id"};};'
        };
        assert.ok(Object.hasOwn(modules, args.path), "Unexpected fixture import: " + args.path);
        return { contents: modules[args.path], loader: "js" };
      });
    } }],
  });
  const css = ["globals.css", "marketing.css"].map(file => readFileSync(resolve(app, "app", file), "utf8")).join("\n");
  server = createServer((req, res) => {
    if (new URL(req.url, "http://localhost").pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(bundle.outputFiles[0].text);
    } else if (new URL(req.url, "http://localhost").pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    }
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

const paths = { join: "/join?code=KRUXT-CONTEXT-123", invite: "/invite/accept?token=synthetic-invite-context" };

async function fixture(t, flow, width = 1280, captcha = false, extra = "") {
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
  await page.goto(origin + paths[flow] + (captcha ? "&captcha=1" : "") + extra);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  if (flow === "join") {
    await page.getByLabel("Display name", { exact: true }).fill("Test Member");
    await page.getByLabel("Username", { exact: true }).fill("test_member");
  }
  await page.getByLabel("Email", { exact: true }).fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  return page;
}

const submit = (page, flow) => page.getByRole("button", { name: flow === "join" ? "Create profile" : "Create account", exact: true });
const calls = page => page.evaluate(() => window.fixture.calls);

for (const flow of ["join", "invite"]) for (const width of [1280, 390]) test(`${flow}: configured challenge gates signup and retry at ${width}px`, async t => {
  const page = await fixture(t, flow, width, true);
  await submit(page, flow).click();
  await expect(page.getByRole("alert")).toContainText("Security verification");
  assert.deepEqual(await calls(page), []);
  await page.evaluate(() => window.fixture.challenge.onVerify('synthetic-signup-token'));
  await expect(page.getByRole("status")).toHaveText("Security verification complete.");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: resolve(screenshots, `${flow}-captcha-${width}.png`), fullPage: true });
  await submit(page, flow).click();
  await expect(page.getByRole("status").filter({hasText:'Check your email'})).toBeVisible();
  const signup = (await calls(page)).find(call => call[0] === 'signUp');
  assert.equal(signup[1].options.captchaToken, 'synthetic-signup-token');
  assert.equal((await calls(page)).filter(call=>call[0]==='signIn').length, 0);
  await page.getByLabel("Password", {exact:true}).fill('confirmed-password');
  const signIn = page.locator('button[type="submit"]');
  await signIn.click();
  await expect(page.getByRole("alert")).toContainText("Security verification");
  assert.equal((await calls(page)).filter(call=>call[0]==='signIn').length, 0);
  await page.evaluate(() => window.fixture.challenge.onVerify('synthetic-signin-token'));
  await signIn.click();
  await expect(page.getByText('Signed in as', {exact:false})).toBeVisible();
  const login = (await calls(page)).find(call => call[0] === 'signIn');
  assert.equal(login[1].options.captchaToken, 'synthetic-signin-token');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
});

for (const flow of ["join", "invite"]) {
  for (const width of [1280, 390]) test(`${flow}: confirmation status at ${width}px`, async t => {
    const page = await fixture(t, flow, width);
    await submit(page, flow).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.screenshot({ path: resolve(screenshots, `${flow}-confirmation-${width}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  });

  test(`${flow}: no-session signup stops safely and subsequent sign-in retains exact context`, async t => {
    const page = await fixture(t, flow);
    if (flow === "join") await page.getByLabel("Invite code", { exact: true }).fill("KRUXT-EDITED-456");
    await submit(page, flow).click();
    await expect(page.getByRole("status")).toContainText("Check your email for a confirmation link if one is needed");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Signed in as", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open KRUXT|See your gym's classes/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open gym workspace" })).toHaveCount(0);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    assert.deepEqual((await calls(page)).map(call => call[0]), ["signUp"]);
    assert.equal(page.url(), origin + paths[flow]);

    await page.getByLabel("Password", { exact: true }).fill("confirmed-password");
    await page.getByRole("button", { name: flow === "join" ? "Sign in" : "Sign in to continue", exact: true }).last().click();
    await expect(page.getByText("Signed in as", { exact: false })).toBeVisible();
    if (flow === "invite") await page.getByRole("button", { name: "Accept invite", exact: true }).click();
    await expect(flow === "join" ? page.getByRole("button", { name: "Open KRUXT", exact: true }) : page.getByRole("link", { name: "Open gym workspace", exact: true })).toBeVisible();
    const recorded = await calls(page);
    assert.deepEqual(recorded.filter(call => call[0] === "signIn"), [["signIn", { email: "member@example.test", password: "confirmed-password" }]]);
    if (flow === "join") {
      assert.deepEqual(recorded.filter(call => call[0] === "rpc"), [["rpc", "redeem_gym_invite_code", { p_code: "KRUXT-EDITED-456", p_note: null }]]);
    } else {
      assert.deepEqual(recorded.filter(call => call[0] === "function"), [["function", "accept-invite", { token: "synthetic-invite-context" }]]);
    }
    assert.equal(page.url(), origin + paths[flow]);
  });

  test(`${flow}: immediate session is used directly and listener cannot expose controls mid-submit`, async t => {
    const page = await fixture(t, flow);
    await page.evaluate(() => { window.fixture.hasSession = true; window.fixture.pause = true; });
    await submit(page, flow).click();
    await page.waitForFunction(() => !!window.fixture.release);
    await expect(page.getByText("Signed in as", { exact: false })).toHaveCount(0);
    for (const field of ["Email", "Password", ...(flow === "join" ? ["Invite code", "Display name", "Username"] : [])]) {
      await expect(page.getByLabel(field, { exact: true })).toBeDisabled();
    }
    await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
    await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    assert.deepEqual((await calls(page)).map(call => call[0]), ["signUp"]);
    await page.evaluate(() => window.fixture.release());
    await expect(page.getByText("Signed in as", { exact: false })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    if (flow === "join") {
      await expect(page.getByRole("button", { name: "Open KRUXT", exact: true })).toBeVisible();
      assert.equal((await calls(page)).filter(call => call[0] === "rpc").length, 1);
    } else {
      assert.deepEqual((await calls(page)).map(call => call[0]), ["signUp"]);
      await page.getByRole("button", { name: "Accept invite", exact: true }).click();
      await expect(page.getByRole("link", { name: "Open gym workspace", exact: true })).toHaveAttribute("href", "https://gym-admin.example.test/login");
    }
    assert.equal((await calls(page)).filter(call => call[0] === "signIn").length, 0);
  });

  test(`${flow}: mode changes clear confirmation and errors without leaking upstream details`, async t => {
    const page = await fixture(t, flow);
    await submit(page, flow).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.evaluate(() => { window.fixture.error = true; });
    await submit(page, flow).click();
    await expect(page.getByRole("alert")).toHaveText("Authentication could not be completed. Try again or contact support.");
    await expect(page.getByText("private upstream account details", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

for (const missingUser of [false, true]) test(`join: bounded ${missingUser ? "missing account" : "activation"} guidance is preserved`, async t => {
  const page = await fixture(t, "join");
  await page.evaluate(missing => {
    window.fixture.hasSession = true;
    window.fixture.activation = "pending";
    window.fixture.missingUser = missing;
  }, missingUser);
  await submit(page, "join").click();
  await expect(page.getByRole("alert")).toHaveText(missingUser
    ? "Sign in before redeeming a gym code."
    : "Your account must be active before joining a gym. Complete your activation or contact gym staff.");
  assert.equal((await calls(page)).filter(call => call[0] === "rpc").length, 0);
});

for (const [landingCase, label, destination] of [
  ["bookable", "See your gym's classes", "/gyms/33333333-3333-4333-8333-333333333333/classes"],
  ["pending", "Open KRUXT", "/feed"],
  ["other-user", "Open KRUXT", "/feed"],
  ["lookup-error", "Open KRUXT", "/feed"]
]) test(`join: ${landingCase} membership lands on ${destination} after acceptance and checks`, async t => {
  const page = await fixture(t, "join", 390, false, "&membership=" + landingCase);
  await page.evaluate(() => { window.fixture.hasSession = true; });
  await submit(page, "join").click();
  const action = page.getByRole("button", { name: label, exact: true });
  await expect(action).toBeVisible();
  const recorded = await calls(page);
  const redeemAt = recorded.findIndex(call => call[0] === "rpc" && call[1] === "redeem_gym_invite_code");
  assert.ok(redeemAt >= 0, "invite was redeemed");
  assert.ok(recorded.slice(redeemAt).some(call => call[0] === "consents"), "policies re-checked after acceptance");
  assert.equal(recorded.slice(redeemAt).filter(call => call[0] === "from" && call[1] === "gym_memberships").length, 1, "one fresh membership read after acceptance");
  await expect(page.getByText(/^Invite accepted\./)).toBeVisible();
  await action.click();
  assert.deepEqual((await calls(page)).filter(call => call[0] === "push").at(-1), ["push", destination]);
});
