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
let server, browser, origin;

before(async () => {
  const bundle = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {usePublicSession} from './src/components/public/usePublicSession';
      const user=id=>({id,email:id+'@example.test',user_metadata:{}});
      const f=window.fixture={user:user('one'),hold:false,authError:null,throwAuth:false,profileError:false,unsubscribed:0};
      f.access=async()=>({status:'ready',user:f.user,isAuthenticated:!!f.user,activationStatus:'active',error:null,platformRole:null,staffGymIds:[],hasRequiredConsents:true});
      f.client={auth:{getUser:async()=>{
        if(f.throwAuth)throw Error('private-provider-detail');
        return {data:{user:f.user},error:f.authError};
      },onAuthStateChange:fn=>{f.emit=fn;return {data:{subscription:{unsubscribe(){f.unsubscribed++;}}}};},
      signOut:async()=>{f.user=null;f.emit('SIGNED_OUT',null);return {error:null};}},
      from:()=>{let id;const q={select:()=>q,eq:(column,value)=>{id=value;return q;},maybeSingle:async()=>{
        const captured=user(id);
        if(f.hold)await new Promise(done=>{f.release=done;});
        return {data:{id:captured.id,display_name:captured.id,username:captured.id},error:f.profileError?{message:'private-profile-detail'}:null};
      }};return q;}};
      function App(){const session=usePublicSession();f.session=session;return <><output aria-label='Session state'>{JSON.stringify(session.state)}</output><button onClick={()=>session.refresh()}>Retry</button></>;}
      const root=createRoot(document.getElementById('root'));f.unmount=()=>root.unmount();root.render(<App/>);
    ` }, bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "session-fixtures", setup(builder) {
      builder.onResolve({ filter: /^@\// }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
        const modules = {
          "@/lib/supabase/client": "export const createSupabaseBrowserClient=()=>window.fixture.client;",
          "@/lib/auth/access": "export const ensureProfileExistsForUser=async()=>{};export const resolveAdminAccess=(...args)=>window.fixture.access(...args);"
        };
        assert.ok(Object.hasOwn(modules, args.path));
        return { contents: modules[args.path], loader: "js" };
      });
    } }]
  });
  server = createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/fixture.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/fixture.js" ? bundle.outputFiles[0].text : '<!doctype html><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
});
after(async () => { try { await browser?.close(); } finally { if (server?.listening) await new Promise(done => server.close(done)); } });

async function fixture(t) {
  const context = await browser.newContext();
  const errors = [];
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await expect.poll(() => state(page).then(value => value.status)).toBe("ready");
  return page;
}
const state = page => page.getByLabel("Session state").textContent().then(JSON.parse);

test("late profile response cannot resurrect a signed-out member", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { const f=window.fixture;f.hold=true;f.session.refresh(); });
  await page.waitForFunction(() => !!window.fixture.release);
  await page.evaluate(() => { const f=window.fixture;f.user=null;f.emit('SIGNED_OUT',null); });
  await expect.poll(() => state(page).then(value => value.user)).toBeNull();
  await page.evaluate(() => window.fixture.release());
  await page.waitForTimeout(50);
  assert.equal((await state(page)).user, null);
  assert.equal((await state(page)).profile, null);
});

test("new account wins when an older profile read finishes last", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { const f=window.fixture;f.hold=true;f.session.refresh(); });
  await page.waitForFunction(() => !!window.fixture.release);
  await page.evaluate(() => {
    const f=window.fixture;f.hold=false;f.oldRelease=f.release;
    f.user={id:'two',email:'two@example.test',user_metadata:{}};f.emit('SIGNED_IN',{user:f.user});
  });
  await expect.poll(() => state(page).then(value => value.profile?.id)).toBe("two");
  await page.evaluate(() => window.fixture.oldRelease());
  await page.waitForTimeout(50);
  assert.equal((await state(page)).user.id, "two");
  assert.equal((await state(page)).profile.id, "two");
});

test("thrown account checks leave loading safely and can be retried", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.fixture.throwAuth=true; });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => state(page).then(value => value.status)).toBe("error");
  assert.ok(!(await state(page)).error.includes("private-provider-detail"));
  await page.evaluate(() => { window.fixture.throwAuth=false; });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => state(page).then(value => value.status)).toBe("ready");
});

test("missing session is signed out; profile failures are safe errors", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { const f=window.fixture;f.user=null;f.authError={name:'AuthSessionMissingError',message:'private-session-details'}; });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => state(page).then(value => value.status)).toBe("ready");
  assert.equal((await state(page)).user, null);
  await page.evaluate(() => { const f=window.fixture;f.authError=null;f.user={id:'one',email:'one@example.test',user_metadata:{}};f.profileError=true; });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => state(page).then(value => value.status)).toBe("error");
  assert.ok(!(await state(page)).error.includes("private-profile-detail"));
});
