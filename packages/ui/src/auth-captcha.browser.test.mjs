import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(resolve(root, "package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium, expect } = require("@playwright/test");
let server, browser, origin;
before(async () => {
  const bundle = await build({
    stdin: { loader: "tsx", resolveDir: root, contents: `
      import React,{StrictMode,useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {useAuthCaptcha} from './packages/ui/src/auth-captcha';
      window.fixture={callbacks:[],results:[],load:true};
      function Probe(){
        const [key,setKey]=useState(new URL(location.href).searchParams.get('key')??undefined);
        const [visible,setVisible]=useState(true);
        window.fixture.setKey=setKey;window.fixture.hide=()=>setVisible(false);
        return visible?<Challenge siteKey={key}/>:null;
      }
      function Challenge({siteKey}){
        const captcha=useAuthCaptcha(siteKey);
        window.fixture.take=()=>{try{const value=captcha.takeToken();window.fixture.results.push(value??'disabled');}catch(error){window.fixture.results.push(error.code);}};
        window.fixture.reset=captcha.reset;
        return <main>{captcha.widget}</main>;
      }
      createRoot(document.getElementById('root')).render(<StrictMode><Probe/></StrictMode>);
    ` },
    bundle: true, write: false, jsx: "automatic", format: "iife",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "synthetic-challenge", setup(builder) {
      builder.onResolve({ filter: /^@hcaptcha\/react-hcaptcha$/ }, () => ({ path: "provider", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "tsx", resolveDir: root, contents: `
        import React,{useEffect} from 'react';
        export default function Provider(props){useEffect(()=>{window.fixture.callbacks.push(props);if(window.fixture.load)props.onLoad?.();},[]);
          return <div style={{width:156,height:140,border:'1px solid #888'}} aria-label='Synthetic challenge'>Synthetic challenge</div>;}
      ` }));
    } }]
  });
  server = createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/fixture.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/fixture.js" ? bundle.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  try { await browser?.close(); } finally { if (server?.listening) await new Promise(done => server.close(done)); }
});
const key = "10000000-ffff-ffff-ffff-000000000001";
async function fixture(t, siteKey = key) {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const errors = [];
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : (errors.push("Unexpected provider request"), route.abort()));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/?key=${encodeURIComponent(siteKey)}`);
  await page.waitForFunction(() => !!window.fixture?.take);
  if (siteKey === key) await page.waitForFunction(() => window.fixture.callbacks.length > 0);
  return page;
}
const results = page => page.evaluate(() => window.fixture.results);

test("unconfigured renders nothing, loads no provider and permits tokenless auth", async t => {
  const page = await fixture(t, "");
  await page.evaluate(() => window.fixture.take());
  assert.deepEqual(await results(page), ["disabled"]);
  assert.equal(await page.evaluate(() => window.fixture.callbacks.length), 0);
  await expect(page.locator("main")).toBeEmpty();
});

test("malformed configured key blocks locally without loading provider or exposing configuration", async t => {
  const page = await fixture(t, "PRIVATE_MALFORMED_CONFIG");
  await page.evaluate(() => window.fixture.take());
  assert.deepEqual(await results(page), ["captcha_required"]);
  await expect(page.getByRole("status")).toContainText("unavailable");
  await expect(page.locator("body")).not.toContainText("PRIVATE_MALFORMED_CONFIG");
  assert.equal(await page.evaluate(() => window.fixture.callbacks.length), 0);
});

test("token is consumed synchronously once; reset rejects stale callbacks and keeps tokens out of storage", async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    window.fixture.take();
    const provider = window.fixture.callbacks.at(-1);
    window.fixture.old = provider;
    provider.onVerify('synthetic-once');
    window.fixture.take();window.fixture.take();
    provider.onVerify('synthetic-once');window.fixture.take();
    window.fixture.reset();
    provider.onVerify('stale-after-reset');window.fixture.take();
  });
  assert.deepEqual(await results(page), ["captcha_required", "synthetic-once", "captcha_required", "captcha_required", "captcha_required"]);
  await page.evaluate(() => {window.fixture.callbacks.at(-1).onVerify('fresh-token');window.fixture.take();});
  assert.equal((await results(page)).at(-1), "fresh-token");
  assert.deepEqual(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)]), [[], []]);
  await expect(page.locator("body")).not.toContainText("synthetic-once");
  assert.equal(await page.evaluate(() => window.fixture.callbacks.at(-1).sentry), false);
  assert.equal(await page.evaluate(() => window.fixture.callbacks.at(-1).userJourneys), false);
});

for (const event of ["onExpire", "onChalExpired", "onError"]) test(`${event} clears completed token, supports refresh and hides provider detail`, async t => {
  const page = await fixture(t);
  await page.evaluate(event => {const provider=window.fixture.callbacks.at(-1);provider.onVerify('expired-token');provider[event]('PRIVATE_PROVIDER_DETAILS');window.fixture.take();}, event);
  assert.deepEqual(await results(page), ["captcha_required"]);
  await expect(page.getByRole("status")).toContainText(event === "onError" ? "unavailable" : "expired");
  await expect(page.locator("body")).not.toContainText("PRIVATE_PROVIDER_DETAILS");
  await page.getByRole("button", {name:"Refresh verification"}).click();
  await page.evaluate(() => {window.fixture.callbacks.at(-1).onVerify('new-token');window.fixture.take();});
  assert.equal((await results(page)).at(-1), "new-token");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("wall-clock age rejects a token even if the provider expiry event never arrives", async t => {
  const page = await fixture(t);
  await page.clock.install();
  await page.evaluate(() => window.fixture.callbacks.at(-1).onVerify('old-token'));
  await page.clock.fastForward(110_001);
  await page.evaluate(() => window.fixture.take());
  assert.deepEqual(await results(page), ["captcha_required"]);
  await expect(page.getByRole("status")).toContainText("expired");
});

test("changed configuration and unmount invalidate old callback credentials", async t => {
  const page = await fixture(t);
  await page.evaluate(() => {window.fixture.old=window.fixture.callbacks.at(-1);window.fixture.old.onVerify('old');window.fixture.setKey('invalid');});
  await expect(page.getByRole("status")).toContainText("unavailable");
  await page.evaluate(() => {window.fixture.old.onVerify('late');window.fixture.take();window.fixture.hide();});
  assert.deepEqual(await results(page), ["captcha_required"]);
  await expect(page.locator("main")).toHaveCount(0);
  await page.evaluate(() => window.fixture.old.onVerify('after-unmount'));
});

test("a blocked provider script times out safely and can be refreshed", async t => {
  const page = await fixture(t);
  await page.clock.install();
  await page.evaluate(() => {window.fixture.load=false;window.fixture.reset();});
  await expect(page.getByRole("status")).toContainText("Loading");
  await page.clock.fastForward(20_001);
  await expect(page.getByRole("status")).toContainText("unavailable");
  await page.evaluate(() => window.fixture.take());
  assert.deepEqual(await results(page), ["captcha_required"]);
  await page.evaluate(() => window.fixture.load=true);
  await page.getByRole("button", {name:"Refresh verification"}).click();
  await page.evaluate(() => {window.fixture.callbacks.at(-1).onVerify('retry-token');window.fixture.take();});
  assert.equal((await results(page)).at(-1), "retry-token");
});
