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
const screenshots = resolve("/tmp", `kruxt-class-series-updates-ui-${process.pid}`);
const firstViewer = "11111111-1111-4111-8111-111111111111";
const secondViewer = "22222222-2222-4222-8222-222222222222";
const seriesId = "33333333-3333-4333-8333-333333333333";
let server, browser, origin;

before(async () => {
  // Bundle only the real component and service, never Next or a hosted SDK.
  const bundle = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {ClassSeriesUpdates} from "./src/components/gyms/ClassSeriesUpdates";
      const first=${JSON.stringify(firstViewer)}, second=${JSON.stringify(secondViewer)};
      const seriesId=${JSON.stringify(seriesId)};
      const gymId="44444444-4444-4444-8444-444444444444";
      const state=window.fixture={calls:[],authOverrides:{},loadMode:"ok",rpcMode:"ok",readMode:"ok",
        pause:{},waiting:{},released:[],viewer:first};
      const rows=(title,body)=>({
        series:[{id:seriesId,title,time_zone:"Europe/Rome"}],subscribed:false,
        announcements:[{id:"55555555-5555-4555-8555-555555555555",series_id:seriesId,
          class_id:null,audience:"occurrence_attendees",occurrence_starts_at:"2099-01-05T18:00:00Z",
          time_zone:"Europe/Rome",body,created_at:"2099-01-04T12:00:00Z"}]
      });
      state.accounts={[first]:rows("Strength","First viewer private announcement"),
        [second]:rows("Mobility","Second viewer private announcement")};
      async function gate(kind,owner){
        const key=kind+":"+owner;
        if(!state.pause[key])return;
        await new Promise(resolve=>{(state.waiting[key]??=[]).push(resolve);});
      }
      state.release=(kind,owner=first)=>{
        const key=kind+":"+owner;
        state.pause[key]=false;
        for(const done of state.waiting[key]??[])done();
        delete state.waiting[key];state.released.push(key);
      };
      const clients={};
      function clientFor(owner){return clients[owner]??=( {
        auth:{getUser:async()=>{
          state.calls.push({kind:"auth",owner});
          const id=Object.hasOwn(state.authOverrides,owner)?state.authOverrides[owner]:owner;
          return {data:{user:id?{id}:null},error:null};
        }},
        rpc:async(name,args)=>{
          state.calls.push({kind:"rpc",owner,name,args:structuredClone(args)});
          await gate("rpc",owner);
          if(state.rpcMode==="offline")throw Error("Synthetic private transport error");
          if(state.rpcMode==="wrong")return {data:{seriesId:"66666666-6666-4666-8666-666666666666",subscribed:args.p_subscribed},error:null};
          state.accounts[owner].subscribed=args.p_subscribed;
          return {data:{seriesId,subscribed:args.p_subscribed},error:null};
        },
        from(table){
          const call={kind:"query",owner,table,steps:[]};state.calls.push(call);
          let single=false;const query={};
          for(const method of ["select","eq","order","limit"])query[method]=(...args)=>{call.steps.push([method,...args]);return query;};
          query.maybeSingle=()=>{single=true;return query;};
          query.then=(resolve,reject)=>Promise.resolve().then(async()=>{
            call.single=single;
            const account=state.accounts[owner];
            let data=table==="gym_class_series"?account.series:
              table==="gym_class_announcements"?account.announcements:
              table==="gym_class_series_subscriptions"?(account.subscribed?[{series_id:seriesId}]:[]):null;
            if(data===null)throw Error("Unexpected synthetic table: "+table);
            data=structuredClone(single?(data[0]??null):data);
            const mode=state.loadMode;
            await gate(single?"readback":"load",owner);
            if(single){
              if(state.readMode==="offline")throw Error("Synthetic readback offline");
              if(state.readMode==="wrong")data=account.subscribed?null:{series_id:seriesId};
            }else{
              if(mode==="offline")throw Error("Synthetic private inbox offline");
              if(mode==="malformed"&&table==="gym_class_announcements")data=[{...account.announcements[0],time_zone:"Mars/Base"}];
            }
            state.calls.push({kind:"response",owner,table,single});
            return {data,error:null};
          }).then(resolve,reject);
          return query;
        }
      });}
      const root=createRoot(document.getElementById("root"));
      state.render=(viewer=state.viewer)=>{
        state.viewer=viewer;
        root.render(<main className="app-shell member-workspace"><div className="mobile-frame">
          <ClassSeriesUpdates key={viewer+":"+gymId} client={clientFor(viewer)} viewerId={viewer} gymId={gymId}/>
        </div></main>);
      };
      state.render();
    ` },
    bundle: true, write: false, jsx: "automatic", format: "iife",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "real-member-service", setup(builder) {
      builder.onResolve({ filter: /^@\// }, args => {
        if (args.path !== "@/lib/public/class-series-updates") throw new Error("Unexpected aliased import: " + args.path);
        return { path: resolve(app, "src/lib/public/class-series-updates.ts") };
      });
    } }],
  });
  const css = ["globals.css", "marketing.css"].map(file => readFileSync(resolve(app, "app", file), "utf8")).join("\n");
  server = createServer((req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); }
    else if (pathname === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
    else if (pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    } else { res.statusCode = 404; res.end(); }
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

async function fixture(t, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-GB", timezoneId: "America/Los_Angeles" });
  const blocked = [], errors = [];
  t.after(async () => {
    await context.close();
    assert.deepEqual(blocked, [], "fixture must not attempt hosted requests");
    assert.deepEqual(errors, [], "no unhandled browser errors");
  });
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    blocked.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await expect(page.getByText("First viewer private announcement", { exact: true })).toBeVisible();
  return page;
}
const checkbox = page => page.getByRole("checkbox", { name: "Updates for Strength", exact: true });
const reload = page => page.getByRole("button", { name: "Reload updates", exact: true });
const subscribedNotice = page => page.getByRole("status").filter({ hasText: "Subscribed to series updates." });

for (const width of [1280, 390]) test(`subscription waits for acknowledgement, readback and identity confirmation at ${width}px`, async t => {
  const page = await fixture(t, width);
  for (const subscribed of [true, false]) {
    await page.evaluate(owner => {
      window.fixture.pause["rpc:" + owner] = true;
      window.fixture.pause["readback:" + owner] = true;
      window.fixture.calls = [];
    }, firstViewer);
    await checkbox(page).click();
    await page.waitForFunction(owner => window.fixture.waiting["rpc:" + owner]?.length, firstViewer);
    await expect(checkbox(page)).toBeDisabled();
    await expect(reload(page)).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Updating subscription..." })).toBeVisible();
    await expect(subscribedNotice(page)).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.fixture.calls.filter(call => call.kind === "rpc").length), 1);
    await page.evaluate(owner => window.fixture.release("rpc", owner), firstViewer);
    await page.waitForFunction(owner => window.fixture.waiting["readback:" + owner]?.length, firstViewer);
    await expect(checkbox(page)).toBeDisabled();
    await expect(subscribedNotice(page)).toHaveCount(0);
    await page.evaluate(owner => window.fixture.release("readback", owner), firstViewer);
    await expect(page.getByRole("status").filter({ hasText: subscribed ? "Subscribed to series updates." : "Unsubscribed from future series updates." })).toBeVisible();
    await expect(checkbox(page)).toBeEnabled();
    await expect(checkbox(page)).toBeChecked({ checked: subscribed });
    const calls = await page.evaluate(() => window.fixture.calls);
    assert.deepEqual(calls.filter(call => call.kind === "rpc").map(call => [call.name, call.args]), [["subscribe_gym_class_series", { p_series_id: seriesId, p_subscribed: subscribed }]]);
    const readbackIndex = calls.findIndex(call => call.kind === "response" && call.single);
    assert.ok(readbackIndex > 0);
    assert.equal(calls[readbackIndex + 1].kind, "auth", "success must follow readback with verified getUser");
    assert.ok(calls.every(call => !call.table || ["gym_class_series", "gym_class_series_subscriptions", "gym_class_announcements"].includes(call.table)), "updates do not query or mutate class bookings");
  }
});

for (const failure of ["wrong acknowledgement", "wrong readback", "wrong account", "offline mutation"]) test(`${failure} hides the inbox and never claims subscription success`, async t => {
  const page = await fixture(t);
  await page.evaluate(({ failure, owner, other }) => {
    if (failure === "wrong acknowledgement") window.fixture.rpcMode = "wrong";
    if (failure === "wrong readback") window.fixture.readMode = "wrong";
    if (failure === "wrong account") window.fixture.authOverrides[owner] = other;
    if (failure === "offline mutation") window.fixture.rpcMode = "offline";
  }, { failure, owner: firstViewer, other: secondViewer });
  await checkbox(page).click();
  await expect(page.getByRole("alert")).toContainText("Subscription could not be confirmed");
  await expect(page.getByText("First viewer private announcement", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(subscribedNotice(page)).toHaveCount(0);
  if (failure === "wrong account") assert.equal(await page.evaluate(() => window.fixture.calls.filter(call => call.kind === "rpc").length), 0);
});

for (const loadMode of ["malformed", "offline"]) test(`${loadMode} reload hides an already loaded inbox and supports recovery`, async t => {
  const page = await fixture(t, 390);
  await page.evaluate(mode => { window.fixture.loadMode = mode; }, loadMode);
  await reload(page).click();
  await expect(page.getByRole("alert")).toContainText("Class updates unavailable");
  await expect(page.getByText("First viewer private announcement", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.evaluate(() => { window.fixture.loadMode = "ok"; });
  await reload(page).click();
  await expect(page.getByText("First viewer private announcement", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("an old valid load cannot resurrect the previous viewer's inbox after a keyed account switch", async t => {
  const page = await fixture(t);
  await page.evaluate(owner => { window.fixture.pause["load:" + owner] = true; }, firstViewer);
  await reload(page).click();
  await page.waitForFunction(owner => window.fixture.waiting["load:" + owner]?.length === 3, firstViewer);
  await page.evaluate(other => window.fixture.render(other), secondViewer);
  await expect(page.getByText("Second viewer private announcement", { exact: true })).toBeVisible();
  await page.evaluate(owner => window.fixture.release("load", owner), firstViewer);
  await page.waitForFunction(owner => window.fixture.calls.filter(call => call.kind === "response" && call.owner === owner).length === 6, firstViewer);
  await expect(page.getByText("First viewer private announcement", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Updates for Mobility", exact: true })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const oldOutcome of ["ok", "wrong"]) test(`old ${oldOutcome} mutation response cannot change the new keyed viewer's inbox`, async t => {
  const page = await fixture(t);
  await page.evaluate(({ owner, oldOutcome }) => { window.fixture.pause["rpc:" + owner] = true; window.fixture.rpcMode = oldOutcome; }, { owner: firstViewer, oldOutcome });
  await checkbox(page).click();
  await page.waitForFunction(owner => window.fixture.waiting["rpc:" + owner]?.length, firstViewer);
  await page.evaluate(other => window.fixture.render(other), secondViewer);
  await expect(page.getByText("Second viewer private announcement", { exact: true })).toBeVisible();
  await page.evaluate(owner => window.fixture.release("rpc", owner), firstViewer);
  // Drain promise continuations and React work without a fixed-duration sleep.
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(page.getByText("Second viewer private announcement", { exact: true })).toBeVisible();
  await expect(page.getByText("First viewer private announcement", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Updates for Mobility", exact: true })).not.toBeChecked();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(subscribedNotice(page)).toHaveCount(0);
});

test("deleted-class announcements retain occurrence date and timezone instead of using browser timezone", async t => {
  const page = await fixture(t, 390);
  const expectedDate = await page.evaluate(() => new Date("2099-01-05T18:00:00Z").toLocaleString(undefined, { timeZone: "Europe/Rome" }) + " (Europe/Rome)");
  await expect(page.getByText(expectedDate, { exact: true })).toBeVisible();
  await expect(page.getByText("Strength / One occurrence", { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(owner => window.fixture.accounts[owner].announcements[0].class_id, firstViewer), null);
  assert.equal(await page.locator("time").getAttribute("datetime"), "2099-01-04T12:00:00Z");
  await page.screenshot({ path: resolve(screenshots, "deleted-class-390.png"), fullPage: true });
});

for (const width of [1280, 390, 320]) test(`long series title and announcement fit ${width}px without clipping or overflow`, async t => {
  const page = await fixture(t, width);
  await page.evaluate(owner => {
    const account = window.fixture.accounts[owner];
    account.series[0].title = "Strength".repeat(15);
    account.announcements[0].body = "Schedule update\n" + "UnbrokenAnnouncement".repeat(90);
  }, firstViewer);
  await reload(page).click();
  await expect(page.getByRole("checkbox", { name: "Updates for " + "Strength".repeat(15), exact: true })).toBeVisible();
  await expect(page.getByText("Schedule update", { exact: false })).toBeVisible();
  await page.screenshot({ path: resolve(screenshots, `long-content-${width}.png`), fullPage: true });
  const overflow = await page.locator("section").evaluate(section => {
    const viewport = document.documentElement.clientWidth;
    return [section, ...section.querySelectorAll("li, label, span, p, h2, h3, button, input")].flatMap(element => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) return [];
      const hasOverflow = element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1;
      const outside = rect.left < -1 || rect.right > viewport + 1;
      return hasOverflow || outside ? [{ tag: element.tagName, text: element.textContent.slice(0, 60), width: rect.width, scrollWidth: element.scrollWidth, left: rect.left, right: rect.right }] : [];
    });
  });
  assert.deepEqual(overflow, [], `content overflows at ${width}px; screenshot: ${resolve(screenshots, `long-content-${width}.png`)}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
});
