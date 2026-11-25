import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
const require = createRequire(resolve(root, "package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium } = require("@playwright/test");
const secret = "SYNTHETIC_FIXTURE_SECRET_ONLY";
let server, browser, url;

before(async () => {
  const result = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {flushSync} from 'react-dom';
      import {OperatorMfa} from './src/components/operator-mfa';
      const state = window.fixture = {
        user:'viewer-a', level:'aal1', nextLevel:'aal2', calls:[], factors:[],
        fail:null, hold:null, success:0, emitVerification:true, promote:true,
        remountOnVerify:false, token:0, listeners:new Set(), releases:{},
      };
      state.emit = (event, user=state.user) => {
        for(const callback of [...state.listeners]) callback(event, user ? {user:{id:user},access_token:'fixture-token-'+(++state.token)} : null);
      };
      const response = async (method, data, args) => {
        state.calls.push({method,args});
        if (state.hold === method) await new Promise(done => {state.releases[method]=done;});
        if (state.fail === method) return {data:null,error:{message:'PRIVATE SDK TOKEN OR SECRET'}};
        return {data:typeof data === 'function' ? data() : data,error:null};
      };
      const client = {auth:{
        getUser:()=>response('getUser',()=>({user:state.user ? {id:state.user} : null})),
        onAuthStateChange: callback => {state.listeners.add(callback); return {data:{subscription:{unsubscribe:()=>state.listeners.delete(callback)}}};},
        mfa:{
          listFactors:()=>response('listFactors',()=>({all:state.factors,totp:state.factors.filter(f=>f.factor_type==='totp' && f.status==='verified')})),
          getAuthenticatorAssuranceLevel:()=>response('aal',()=>({currentLevel:state.level,nextLevel:state.nextLevel})),
          enroll:async args=>{
            const result=await response('enroll',{id:'new-factor-private',type:'totp',totp:{
              secret:'${secret}',uri:'otpauth://DO_NOT_PERSIST',
              qr_code:'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="white"/><rect x="32" y="32" width="128" height="128" fill="black"/></svg>'
            }},args);
            if(!result.error) state.factors.push({id:'new-factor-private',factor_type:'totp',status:'unverified'});
            return result;
          },
          challengeAndVerify:async args=>{
            const initiatingUser=state.user;
            const result=await response('verify',{},args);
            if(!result.error){
              if(state.promote && state.user===initiatingUser) state.level='aal2';
              if(state.emitVerification) state.emit('MFA_CHALLENGE_VERIFIED',initiatingUser);
              if(state.remountOnVerify) window.remount();
            }
            return result;
          },
          unenroll:()=>{throw new Error('Forbidden fixture deletion');},
        }
      }};
      function App(){
        const [viewer,setViewer]=useState('viewer-a');
        const [shown,setShown]=useState(true);
        const [key,setKey]=useState(0);
        const [currentClient,setClient]=useState(client);
        window.switchViewer=(id)=>{state.user=id;flushSync(()=>setViewer(id));};
        window.replaceClient=()=>flushSync(()=>setClient({auth:{...client.auth}}));
        window.unmount=()=>flushSync(()=>setShown(false));
        window.remount=()=>flushSync(()=>setKey(n=>n+1));
        return shown ? <OperatorMfa key={key} client={currentClient} viewerId={viewer} onVerified={()=>state.success++}/> : null;
      }
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
  });
  const css = execFileSync(process.execPath, [resolve(root, "node_modules/tailwindcss/lib/cli.js"), "--config", resolve(app, "tailwind.config.ts"), "--input", resolve(app, "src/styles/globals.css"), "--content", resolve(app, "src/components/operator-mfa.tsx")], { cwd: app, encoding: "utf8" });
  server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end('<html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><main style="padding:16px"><div id="root"></div></main><script>' + result.outputFiles[0].text + '</script></body></html>');
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(done => server.close(done)); });

async function fixture(t, options = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  // Only a local HTML fixture and data-image QR may load; no Supabase network APIs exist.
  await context.route("**/*", route => route.request().url().startsWith(url) ? route.continue() : route.abort());
  const logs = [];
  page.on("console", message => logs.push(message.text()));
  await page.goto(url);
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).waitFor();
  await page.evaluate(options => { Object.assign(window.fixture, options); window.remount(); }, options);
  await page.waitForFunction(() => document.querySelector('section[aria-busy="false"]'));
  return { page, logs };
}
const factor = (id, status = "verified", type = "totp") => ({ id, status, factor_type: type });
const otp = page => page.getByLabel("Six-digit authenticator code", { exact: true });
const verify = page => page.getByRole("button", { name: "Verify authenticator", exact: true });
const setup = page => page.getByRole("button", { name: "Set up authenticator", exact: true });
async function calls(page, method) { return page.evaluate(method => window.fixture.calls.filter(call => call.method === method), method); }
async function settle(page) { await page.waitForFunction(() => document.querySelector('section[aria-busy="false"]')); }
async function release(page, method) { await page.evaluate(method => { window.fixture.hold = null; window.fixture.releases[method](); }, method); }
async function held(page, method) { await page.waitForFunction(method => !!window.fixture.releases[method], method); }
async function noPrivate(page, logs) {
  assert.equal(await page.getByRole("img").count(), 0);
  assert.equal(await page.getByText(secret, { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, location.href, document.cookie]).includes('SYNTHETIC_FIXTURE_SECRET_ONLY')), false);
  assert.ok(logs.every(log => !log.includes(secret) && !log.includes("PRIVATE SDK")));
}

test("AAL1 never auto-enrolls; AAL2 reports verified without a mutation", async t => {
  const { page } = await fixture(t);
  assert.equal((await calls(page, "enroll")).length, 0);
  assert.equal((await calls(page, "verify")).length, 0);
  await page.evaluate(() => { window.fixture.level = 'aal2'; window.remount(); });
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
  assert.equal(await setup(page).count(), 0);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
});

test("only verified TOTP choices, no displayed IDs, exact six digits, current AAL2 precedes callback", async t => {
  const { page } = await fixture(t, { factors: [factor("private-a"), factor("private-b"), factor("unfinished", "unverified"), factor("phone", "verified", "phone")] });
  const select = page.getByLabel("Authenticator", { exact: true });
  assert.deepEqual(await select.locator("option").allTextContents(), ["Authenticator 1", "Authenticator 2"]);
  assert.doesNotMatch(await page.locator("body").innerText(), /private-a|private-b|unfinished/);
  await select.selectOption("private-b");
  for (const value of ["12345", "abcdef", "12 456"]) { await otp(page).fill(value); assert.equal(await verify(page).isDisabled(), true); }
  assert.equal((await calls(page, "verify")).length, 0);
  await otp(page).fill("012345"); await verify(page).click();
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
  assert.deepEqual((await calls(page, "verify"))[0].args, { factorId: "private-b", code: "012345" });
  assert.equal(await page.evaluate(() => window.fixture.success), 1);
  const methods = await page.evaluate(() => window.fixture.calls.map(call => call.method));
  const index = methods.indexOf("verify");
  assert.equal(methods[index - 1], "getUser");
  assert.deepEqual(methods.slice(index + 1), ["getUser", "aal", "getUser"]);
});

test("explicit setup uses the returned image, disclosure, no persistence; successful verification clears material", async t => {
  const { page, logs } = await fixture(t);
  await setup(page).click();
  await page.getByRole("img", { name: "Authenticator setup QR code" }).waitFor();
  assert.deepEqual((await calls(page, "enroll"))[0].args, { factorType: "totp", friendlyName: "KRUXT operator" });
  assert.equal(await page.getByText(secret, { exact: true }).isVisible(), false);
  await page.getByText("Show manual setup secret", { exact: true }).click();
  assert.equal(await page.getByText(secret, { exact: true }).isVisible(), true);
  assert.equal(await page.getByRole("img").evaluate(img => img.complete && img.naturalWidth === 192), true);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await otp(page).fill("654321"); await verify(page).click();
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
  await noPrivate(page, logs);
  assert.equal(await otp(page).count(), 0);
});

test("cancel clears material without deleting; unfinished setup has a bounded resume path", async t => {
  const { page, logs } = await fixture(t);
  await setup(page).click(); await otp(page).fill("654321");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await noPrivate(page, logs);
  assert.match(await page.locator("body").innerText(), /No factor was deleted/);
  await page.getByRole("button", { name: "Retry account check", exact: true }).click();
  await page.getByRole("button", { name: "Resume unfinished setup" }).click();
  assert.match(await page.locator("body").innerText(), /original QR and secret cannot be retrieved/);
  assert.equal(await otp(page).inputValue(), "");
  assert.equal((await calls(page, "enroll")).length, 1);
  await otp(page).fill("123456"); await verify(page).click();
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
});

test("sanitized SDK errors and stale AAL1 never report success; retry uses a fresh code", async t => {
  const { page, logs } = await fixture(t, { factors: [factor("a")], fail: "verify" });
  await otp(page).fill("123456"); await verify(page).click();
  await page.getByRole("alert").waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), /PRIVATE SDK/);
  assert.equal(await otp(page).inputValue(), "");
  await page.evaluate(() => { window.fixture.fail = null; window.fixture.promote = false; });
  await otp(page).fill("234567"); await verify(page).click(); await settle(page);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
  assert.equal(await otp(page).inputValue(), "");
  await page.evaluate(() => { window.fixture.promote = true; });
  await otp(page).fill("345678"); await verify(page).click();
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.success), 1);
  assert.ok(logs.every(log => !log.includes("PRIVATE SDK")));
});

test("read and enroll failures are generic, retryable, and never auto-repeat enrollment", async t => {
  const { page } = await fixture(t, { fail: "listFactors" });
  await page.getByRole("alert").waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), /PRIVATE SDK/);
  await page.evaluate(() => { window.fixture.fail = null; });
  await page.getByRole("button", { name: "Retry account check" }).click();
  await setup(page).waitFor();
  await page.evaluate(() => { window.fixture.fail = 'enroll'; });
  await setup(page).click(); await page.getByRole("alert").waitFor();
  assert.match(await page.locator("body").innerText(), /unfinished factor may remain/);
  await page.evaluate(() => { window.fixture.fail = null; });
  await page.getByRole("button", { name: "Retry account check" }).click(); await setup(page).waitFor();
  assert.equal((await calls(page, "enroll")).length, 1);
});

test("synchronous busy guard blocks duplicate setup and verify clicks", async t => {
  const { page } = await fixture(t, { hold: "enroll" });
  await setup(page).evaluate(button => { button.click(); button.click(); });
  await held(page, "enroll"); assert.equal((await calls(page, "enroll")).length, 1);
  await release(page, "enroll"); await otp(page).waitFor();
  await page.evaluate(() => { window.fixture.hold = 'verify'; });
  await otp(page).fill("123456");
  await verify(page).evaluate(button => { button.click(); button.click(); });
  await held(page, "verify"); assert.equal((await calls(page, "verify")).length, 1);
  await release(page, "verify");
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
});

for (const method of ["enroll", "verify"]) test(`pending ${method} cannot restore old account material or callback`, async t => {
  const { page, logs } = await fixture(t, { hold: method });
  await setup(page).click();
  if (method === "verify") { await otp(page).fill("123456"); await verify(page).click(); }
  await held(page, method);
  await page.evaluate(() => window.switchViewer('viewer-b'));
  await settle(page); await release(page, method); await settle(page);
  await noPrivate(page, logs);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
  assert.equal(await page.getByText("Authenticator verified for this session (AAL2).", { exact: true }).count(), 0);
});

test("getUser is checked immediately before mutation; mismatched account never enrolls or verifies", async t => {
  const { page } = await fixture(t);
  await page.evaluate(() => { window.fixture.hold = 'getUser'; });
  await setup(page).click(); await held(page, "getUser");
  await page.evaluate(() => { window.fixture.user = 'viewer-b'; });
  await release(page, "getUser"); await page.getByRole("alert").waitFor();
  assert.equal((await calls(page, "enroll")).length, 0);
});

test("verification revalidates the account even when the client identity did not change", async t => {
  const { page, logs } = await fixture(t);
  await setup(page).click(); await otp(page).fill("123456");
  await page.evaluate(() => { window.fixture.user = 'viewer-b'; });
  await verify(page).click(); await page.getByRole("alert").waitFor();
  assert.equal((await calls(page, "verify")).length, 0);
  await noPrivate(page, logs);
});

for (const fail of ["getUser", "aal"]) test(`${fail} read failure stays unavailable and can be retried`, async t => {
  const { page } = await fixture(t, { fail });
  await page.getByRole("alert").waitFor();
  assert.equal(await setup(page).count(), 0);
  assert.doesNotMatch(await page.locator("body").innerText(), /PRIVATE SDK/);
  await page.evaluate(() => { window.fixture.fail = null; });
  await page.getByRole("button", { name: "Retry account check" }).click(); await setup(page).waitFor();
  assert.equal((await calls(page, "enroll")).length, 0);
});

for (const method of ["enroll", "verify"]) test(`cancel pending ${method} discards late material and success`, async t => {
  const { page, logs } = await fixture(t, { hold: method });
  await setup(page).click();
  if (method === "verify") { await otp(page).fill("123456"); await verify(page).click(); }
  await held(page, method);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await noPrivate(page, logs);
  await release(page, method); await settle(page);
  await noPrivate(page, logs);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
});

test("token change while getUser is pending prevents enrollment rather than merely hiding its result", async t => {
  const { page } = await fixture(t);
  await page.evaluate(() => { window.fixture.hold = 'getUser'; });
  await setup(page).click(); await held(page, "getUser");
  await page.evaluate(() => { window.fixture.hold = null; window.fixture.emit('TOKEN_REFRESHED'); });
  await settle(page);
  await release(page, "getUser"); await settle(page);
  assert.equal((await calls(page, "enroll")).length, 0);
});

test("unmount during enrollment removes subscription and discards the delayed QR", async t => {
  const { page, logs } = await fixture(t, { hold: "enroll" });
  await setup(page).click(); await held(page, "enroll");
  await page.evaluate(() => window.unmount());
  await page.locator("section").waitFor({ state: "detached" });
  await release(page, "enroll"); await noPrivate(page, logs);
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), 0);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
});

test("token changes on the same client invalidate pending work and clear setup", async t => {
  const { page, logs } = await fixture(t);
  await setup(page).click(); await otp(page).fill("123456");
  await page.evaluate(() => { window.fixture.hold = 'verify'; });
  await verify(page).click(); await held(page, "verify");
  await page.evaluate(() => window.fixture.emit('TOKEN_REFRESHED'));
  await settle(page); await release(page, "verify"); await settle(page);
  await noPrivate(page, logs);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
});

test("unmount, client replacement and token-refresh parent remount clear secrets without late callbacks", async t => {
  const { page, logs } = await fixture(t);
  await setup(page).click(); await otp(page).waitFor();
  await page.evaluate(() => window.replaceClient()); await settle(page); await noPrivate(page, logs);
  await page.getByRole("button", { name: "Resume unfinished setup" }).click();
  await page.evaluate(() => { window.fixture.remountOnVerify = true; });
  await otp(page).fill("123456"); await verify(page).click();
  await page.getByRole("status").filter({ hasText: "verified for this session" }).waitFor();
  await noPrivate(page, logs);
  assert.equal(await page.evaluate(() => window.fixture.success), 0);
  await page.evaluate(() => window.unmount());
  await page.locator("section").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => window.fixture.listeners.size), 0);
});

test("synthetic setup fits mobile and desktop; controls are labeled and keyboard reachable", async t => {
  const { page } = await fixture(t);
  await setup(page).click(); await otp(page).waitFor();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByText("Show manual setup secret", { exact: true }).evaluate(el => el.parentElement.open = true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.getByRole("img").evaluate(img => img.complete && img.naturalWidth > 0), true);
    // Screenshots stay in memory and contain only the explicitly synthetic QR fixture.
    assert.ok((await page.screenshot()).byteLength > 1000);
    await otp(page).focus();
    assert.equal(await otp(page).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).evaluate(el => el === document.activeElement), true);
  }
});
