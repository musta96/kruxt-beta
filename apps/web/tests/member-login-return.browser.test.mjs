import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium, expect } = require("@playwright/test");
let browser, server, origin;

before(async () => {
  const bundle = await build({ stdin: { resolveDir: app, loader: "tsx", contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';import {AuthGateway} from './src/components/auth/AuthGateway';
    const user={id:'member-one',email:'member@example.test',user_metadata:{}};
    const params=new URLSearchParams(location.search);
    const f=window.fixture={user:params.has('existing')?user:null,accessStatus:params.get('status')||'ready',calls:[],role:null,mismatch:false};
    f.router={replace:path=>{f.calls.push(['replace',path]);}};
    f.client={auth:{getUser:async()=>({data:{user:f.user},error:null}),onAuthStateChange:fn=>({data:{subscription:{unsubscribe(){}}}}),
      signInWithPassword:async()=>{f.user=user;return {error:null};},signOut:async()=>{f.user=null;return {error:null};}}};
    f.access=async()=>({status:f.accessStatus,isAuthenticated:!!f.user,user:f.mismatch?{id:'other'}:f.user,
      activationStatus:f.accessStatus==='disabled'?'disabled':f.accessStatus==='activation_required'?'pending_activation':'active',platformRole:f.role,staffGymIds:[],error:null});
    f.oauth=async(...args)=>{f.calls.push(['oauth',args[2],args[3]]);};
    createRoot(document.getElementById('root')).render(params.has('strict')?<React.StrictMode><AuthGateway/></React.StrictMode>:<AuthGateway/>);
  ` }, bundle: true, write: false, jsx: "automatic", format: "iife", define: { "process.env": "{}", "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY": "undefined",
      // Each test chooses its verified providers; nothing set means no social buttons.
      "process.env.NEXT_PUBLIC_KRUXT_VERIFIED_SOCIAL_PROVIDERS": "window.fixtureSocialProviders" },
    plugins: [{ name: "login-fixtures", setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      builder.onResolve({ filter: /^@kruxt\/ui\/auth-captcha$/ }, () => ({ path: "captcha", namespace: "fixture" }));
      builder.onResolve({ filter: /^@kruxt\/ui\/social-sign-in$/ }, () => ({ path: resolve(app, "../../packages/ui/src/social-sign-in.ts") }));
      builder.onResolve({ filter: /^@\// }, args => {
        const real = ["@/lib/auth/member-return", "@/lib/auth/pending-member-return", "@/lib/auth/auth-error"];
        if (real.includes(args.path)) {
          const base = resolve(app, "src", args.path.slice(2));
          assert.ok(existsSync(base + ".ts")); return { path: base + ".ts" };
        }
        return { path: args.path, namespace: "fixture" };
      });
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
        const modules = {
          navigation: "export const useRouter=()=>window.fixture.router;",
          captcha: "export const useAuthCaptcha=()=>({takeToken:()=>null,reset(){},widget:null});",
          "@/lib/supabase/client": "export const createSupabaseBrowserClient=()=>window.fixture.client;export const getSupabaseConfig=()=>({});",
          "@/lib/auth/access": "export const ensureProfileExistsForUser=async()=>{};export const resolveAdminAccess=()=>window.fixture.access();",
          "@/components/public/usePublicSession": "export const resolvePostAuthPath=access=>access.activationStatus==='disabled'||access.activationStatus==='pending_activation'?'/activate-invite':access.platformRole?'/admin':'/feed';",
          "@/lib/marketing-url": "export const getGymAdminLoginUrl=()=>'https://gym-admin.example.test/login';",
          "@/components/marketing/MarketingHome": "import React from 'react';export const MarketingHome=({authPanel})=><main id='member-login'>{authPanel}</main>;",
          "@/components/consent/RequiredConsentReview": "import React from 'react';export const RequiredConsentReview=({onComplete})=><section><h2>Policy review required</h2><button onClick={onComplete}>Finish fixture review</button></section>;",
          "@/lib/auth/social-auth": "export const PROVIDER_RETURN_ERROR='Social sign-in unavailable';export const hasProviderReturnError=()=>false;export const sanitizedAuthReturnUrl=url=>{const clean=new URL(url);clean.searchParams.delete('code');return clean.pathname+clean.search+clean.hash;};export const startSocialSignIn=(...args)=>window.fixture.oauth(...args);"
        };
        assert.ok(Object.hasOwn(modules, args.path), args.path);
        return { loader: "tsx", contents: modules[args.path], resolveDir: app };
      });
    } }]
  });
  server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    res.setHeader("Content-Type", path === "/fixture.js" ? "text/javascript" : "text/html");
    res.end(path === "/fixture.js" ? bundle.outputFiles[0].text : '<!doctype html><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
});
after(async () => { try { await browser?.close(); } finally { if (server?.listening) await new Promise(done => server.close(done)); } });
async function fixture(t, query, { socialProviders = null } = {}) {
  const context = await browser.newContext();const errors=[];
  await context.addInitScript(value=>{window.fixtureSocialProviders=value;},socialProviders);
  t.after(async () => { await context.close();assert.deepEqual(errors,[]); });
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?'+query+'#member-login');return page;
}
async function signIn(page) {
  await expect(page.locator('form')).toBeVisible();
  await page.getByLabel('Email',{exact:true}).fill('member@example.test');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in to KRUXT',exact:true}).click();
}
const destination = page => page.evaluate(() => window.fixture.calls.find(call=>call[0]==='replace')?.[1]);

test('password login preserves only valid workout identifiers',async t=>{
  const id='11111111-2222-4333-8444-555555555555';
  const target='/log?planId='+id+'&dayId=0_lower';
  const page=await fixture(t,'returnTo='+encodeURIComponent(target+'&token=private'));
  await signIn(page);await expect.poll(()=>destination(page)).toBe(target);
  assert.ok(!page.url().includes('private'));
});
test('unsafe or duplicate destinations use the normal role-based route',async t=>{
  for(const query of ['returnTo=https%3A%2F%2Fevil.test','returnTo=%2Fadmin','returnTo=%2Fprivacy&returnTo=%2Flog']){
    const page=await fixture(t,query);await signIn(page);await expect.poll(()=>destination(page)).toBe('/feed');
  }
});
test('pending policies retain the review gate except for the restricted privacy route',async t=>{
  const page=await fixture(t,'status=consent_required&returnTo=%2Flog');await signIn(page);
  await expect(page.getByRole('heading',{name:'Policy review required'})).toBeVisible();assert.equal(await destination(page),undefined);
  await page.evaluate(()=>{window.fixture.accessStatus='ready';});
  await page.getByRole('button',{name:'Finish fixture review'}).click();await expect.poll(()=>destination(page)).toBe('/log');
  const privacy=await fixture(t,'status=consent_required&returnTo=%2Fprivacy');await signIn(privacy);
  await expect.poll(()=>destination(privacy)).toBe('/privacy');
});
test('activation gates and identity checks cannot be bypassed by return URLs',async t=>{
  for(const status of ['disabled','activation_required']){
    const page=await fixture(t,'status='+status+'&returnTo=%2Fprivacy');await signIn(page);
    await expect.poll(()=>destination(page)).toBe('/activate-invite');
  }
  const page=await fixture(t,'returnTo=%2Fprivacy');await page.waitForFunction(()=>!!window.fixture);
  await page.evaluate(()=>{window.fixture.mismatch=true;});await signIn(page);
  await expect(page.getByRole('alert')).toHaveText('Your session has expired. Sign in again.');assert.equal(await destination(page),undefined);
});
test('social buttons stay hidden until a provider is listed as verified',async t=>{
  const page=await fixture(t,'returnTo=%2Fprivacy');
  await expect(page.locator('form')).toBeVisible();
  await expect(page.getByRole('button',{name:/Continue with/})).toHaveCount(0);
  const googleOnly=await fixture(t,'returnTo=%2Fprivacy',{socialProviders:'google'});
  await expect(googleOnly.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();
  await expect(googleOnly.getByRole('button',{name:'Continue with Apple',exact:true})).toHaveCount(0);
});
test('social callback keeps its approved URL and restores a single tab-scoped destination',async t=>{
  const page=await fixture(t,'returnTo=%2Fprivacy',{socialProviders:'google'});
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
  const oauth=await page.evaluate(()=>window.fixture.calls.find(call=>call[0]==='oauth'));
  assert.equal(oauth[2],origin+'/#member-login');
  const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kruxt:pending-member-return:v1')));
  assert.equal(stored.path,'/privacy');
  await page.goto(origin+'/?existing=1&strict=1&code=fixture#member-login');
  await expect.poll(()=>destination(page)).toBe('/privacy');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('kruxt:pending-member-return:v1')),null);
});
