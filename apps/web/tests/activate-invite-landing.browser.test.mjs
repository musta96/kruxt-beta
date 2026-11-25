import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Staff-created member invites (/activate-invite): the navigation action appears
// only after the landing check settles. Synthetic users and an in-page Supabase
// stub only; every request outside the local fixture server is aborted.
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium, expect } = require("@playwright/test");
let browser, server, origin;

const USER = "11111111-1111-4111-8111-111111111111";
const GYM = "33333333-3333-4333-8333-333333333333";
const CLASSES = `/gyms/${GYM}/classes`;

before(async () => {
  const bundle = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {ActivateProfileInviteClient} from "./src/components/invite/ActivateProfileInviteClient";
      const params=new URLSearchParams(location.search);
      const user={id:"${USER}",email:"member@example.test",user_metadata:{}};
      const f=window.fixture={calls:[],releaseMembership:null};
      const gate=params.has("delay")?new Promise(done=>{f.releaseMembership=done;}):Promise.resolve();
      const invite={id:"99999999-9999-4999-8999-999999999999",gym_id:"${GYM}",invited_user_id:user.id,email:user.email,
        display_name:"Test Member",requested_role:params.get("role")==="coach"?"pt":"member",gym_role:params.get("role")||"member",
        status:params.get("invite")||"active",invite_attempt:1,expires_at:"2030-01-01T00:00:00.000Z"};
      const memberships={
        bookable:{data:{id:"55555555-5555-4555-8555-555555555555",gym_id:"${GYM}",user_id:user.id,membership_status:"active"},error:null},
        pending:{data:{id:"55555555-5555-4555-8555-555555555555",gym_id:"${GYM}",user_id:user.id,membership_status:"pending"},error:null},
        error:{data:null,error:{message:"synthetic lookup failure"}}
      };
      f.client={
        auth:{getUser:async()=>({data:{user},error:null}),updateUser:async()=>({error:null})},
        functions:{invoke:async(name,args)=>{f.calls.push(["function",name]);invite.status="active";return {data:{ok:true},error:null};}},
        from:table=>{
          f.calls.push(["from",table]);
          const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,in:()=>q,
            then:(done,fail)=>Promise.resolve({data:[invite],error:null}).then(done,fail),
            maybeSingle:async()=>{
              if(table==="profiles")return {data:{activation_status:"active"},error:null};
              await gate;f.calls.push(["membership-read"]);
              return memberships[params.get("membership")||"bookable"];
            }};
          return q;
        }
      };
      createRoot(document.getElementById("root")).render(<ActivateProfileInviteClient/>);
    ` },
    bundle: true, write: false, jsx: "automatic", format: "iife",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "activation-fixtures", setup(builder) {
      builder.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^@\// }, args => {
        if (args.path === "@/lib/invite/member-landing") return { path: resolve(app, "src/lib/invite/member-landing.ts") };
        return { path: args.path, namespace: "fixture" };
      });
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
        const modules = {
          "next/link": "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>;}",
          "next/navigation": "const params=new URLSearchParams(location.search);export const useSearchParams=()=>params;",
          "@/components/public/usePublicSession": "export const broadcastPublicSessionRefresh=()=>{window.fixture.calls.push(['refresh']);};",
          "@/lib/supabase/client": "export const createSupabaseBrowserClient=()=>window.fixture.client;",
          "@/lib/marketing-url": "export const getGymAdminLoginUrl=()=>'https://gym-admin.example.test/login';",
          "@/lib/auth/required-consents": "export const hasRequiredConsents=async()=>{window.fixture.calls.push(['consents']);return true;};"
        };
        assert.ok(Object.hasOwn(modules, args.path), "Unexpected fixture import: " + args.path);
        return { loader: "tsx", contents: modules[args.path], resolveDir: app };
      });
    } }]
  });
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    res.setHeader("Content-Type", path === "/fixture.js" ? "text/javascript" : "text/html");
    res.end(path === "/fixture.js" ? bundle.outputFiles[0].text : '<!doctype html><html lang="en"><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  try { await browser?.close(); }
  finally { if (server?.listening) await new Promise(done => server.close(done)); }
});

async function open(t, query) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/activate-invite?" + query);
  return page;
}

const memberApp = page => page.getByRole("link", { name: "Open member app", exact: true });
const gymClasses = page => page.getByRole("link", { name: "See your gym's classes", exact: true });
const checking = page => page.getByRole("button", { name: "Checking your gym…", exact: true });
const calls = page => page.evaluate(() => window.fixture.calls);

test("delayed lookup: no navigation is offered until the membership check settles", async t => {
  const page = await open(t, "delay=1&membership=bookable");
  await expect(page.getByRole("heading", { name: "Profile active." })).toBeVisible();
  await expect(checking(page)).toBeDisabled();
  await expect(memberApp(page)).toHaveCount(0);
  await expect(gymClasses(page)).toHaveCount(0);
  assert.equal((await calls(page)).filter(call => call[0] === "membership-read").length, 0);
  await page.evaluate(() => window.fixture.releaseMembership());
  await expect(gymClasses(page)).toHaveAttribute("href", CLASSES);
  await expect(checking(page)).toHaveCount(0);
  await expect(memberApp(page)).toHaveCount(0);
});

test("delayed lookup after completing activation follows the same rule", async t => {
  const page = await open(t, "delay=1&membership=bookable&invite=pending_activation");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Set Password & Activate", exact: true }).click();
  await expect(checking(page)).toBeDisabled();
  await expect(memberApp(page)).toHaveCount(0);
  await page.evaluate(() => window.fixture.releaseMembership());
  await expect(gymClasses(page)).toHaveAttribute("href", CLASSES);
  assert.ok((await calls(page)).some(call => call[0] === "function" && call[1] === "complete-profile-activation"));
});

for (const membership of ["pending", "error"]) test(`delayed ${membership} lookup settles to the member app home`, async t => {
  const page = await open(t, `delay=1&membership=${membership}`);
  await expect(checking(page)).toBeDisabled();
  await expect(memberApp(page)).toHaveCount(0);
  await page.evaluate(() => window.fixture.releaseMembership());
  await expect(memberApp(page)).toHaveAttribute("href", "/feed");
  await expect(gymClasses(page)).toHaveCount(0);
});

test("staff invites skip the membership check and offer the member app immediately", async t => {
  const page = await open(t, "delay=1&role=coach");
  await expect(memberApp(page)).toHaveAttribute("href", "/feed");
  await expect(checking(page)).toHaveCount(0);
  assert.equal((await calls(page)).filter(call => call[0] === "from" && call[1] === "gym_memberships").length, 0);
});
