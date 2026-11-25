import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "../..");
const root = resolve(app, "../..");
const require = createRequire(resolve(root, "package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium } = require("@playwright/test");
const isAdmin = app.endsWith("/admin");

// Mount the real shell/provider with only network and framework routing replaced.
async function fixture() {
  const result = await build({
    stdin: {
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import Layout from "./src/app/(dashboard)/layout";
        ${isAdmin ? 'import { GymProvider, useGym } from "./src/contexts/gym-context";' : ''}
        window.scenario = "staff";
        window.membershipCalls = 0;
        window.user = { id: "user-1", email: "operator.with.long.email@example.test" };
        window.navigate = (path) => { window.path = path; window.dispatchEvent(new Event("route")); };
        ${isAdmin ? 'function Probe() { const gym = useGym(); window.gym = gym; return null; }' : ''}
        function App() {
          return ${isAdmin ? '<GymProvider><Probe />' : '<>'}
            <Layout><h1>Workspace</h1><button>Content action</button></Layout>
          ${isAdmin ? '</GymProvider>' : '</>'};
        }
        createRoot(document.getElementById("root")).render(<App />);
      `,
      resolveDir: app, loader: "tsx",
    },
    bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_KRUXT_UAT_GYM_ID": "undefined", "process.env.NEXT_PUBLIC_KRUXT_PLATFORM_URL": "undefined", "process.env.NEXT_PUBLIC_PLATFORM_APP_URL": "undefined" },
    plugins: [{
      name: "local-fixtures",
      setup(builder) {
        builder.onResolve({ filter: /auth-context$/ }, args => ({ path: args.path, namespace: "mock" }));
        builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "mock" }));
        builder.onResolve({ filter: /^@\// }, args => {
          if (["auth-context", "platform-auth-context"].some(name => args.path.endsWith(name)) ||
            args.path === "@/hooks/use-services" || args.path === "@/services" ||
            args.path === "@/components/gym-onboarding-form") return { path: args.path, namespace: "mock" };
          return { path: resolve(app, "src", args.path.slice(2) + (args.path.endsWith("/utils") ? ".ts" : ".tsx")) };
        });
        builder.onLoad({ filter: /.*/, namespace: "mock" }, args => {
          let contents;
          if (args.path === "next/link") contents = 'import React from "react"; export default function Link({href, children, ...props}) { return <a href={href} {...props} onClick={e => { props.onClick?.(e); e.preventDefault(); window.navigate(href); }}>{children}</a>; }';
          else if (args.path === "next/navigation") contents = 'import {useState,useEffect} from "react"; export function usePathname(){ const [path,setPath]=useState(window.path || "/"); useEffect(()=>{ const update=()=>setPath(window.path); window.addEventListener("route",update); return ()=>window.removeEventListener("route",update); },[]); return path; } export const useRouter=()=>({replace:()=>{}});';
          else if (args.path.endsWith("auth-context")) contents = 'export const useAuth=()=>({user:window.user,platformRole:null,loading:false,signOut:async()=>{window.signedOut=true;}}); export const usePlatformAuth=()=>({...useAuth(),platformRole:"founder"});';
          else if (args.path.endsWith("use-services")) contents = 'const services={gym:{listGymJoinRequests:async()=>[]}}; export const useServices=()=>services;';
          else if (args.path.endsWith("gym-onboarding-form")) contents = 'export const GymOnboardingForm=()=> <h1>Create your gym</h1>;';
          else contents = `
            export {StaffAccessService} from "${resolve(app, "src/services/staff-access-service.ts")}";
            export function createAdminSupabaseClient() {
              return { from(table) {
                const filters = {};
                const query = {
                  select(){return query;}, eq(key,value){filters[key]=value;return query;},
                  in(key,value){filters[key]=value;return query;}, order(){return query;},
                  limit(){return query;}, maybeSingle(){return query;},
                  then(done, fail) {
                    if(table === "gym_memberships") window.membershipCalls++;
                    if(window.scenario === "delayed") return new Promise(resolve => {
                      window.releaseLookup = () => resolve({data:null,error:{message:"stale lookup"}});
                    }).then(done,fail);
                    if(window.scenario === "offline") return Promise.resolve({data:null,error:{message:"offline"}}).then(done,fail);
                    let data = null;
                    if(table === "gym_memberships") {
                      const rows = window.scenario === "empty" ? [] : [{id:"membership",gym_id:"gym-1",user_id:"user-1",role:window.scenario === "member" ? "member" : "coach",membership_status:"active"}];
                      data = filters.role ? (window.scenario === "denied" ? null : rows.find(row => filters.role.includes(row.role)) ?? null) : rows;
                    }
                    if(table === "gyms") data = window.scenario === "missing" ? null : {id:"gym-1",name:"A very long gym name for a narrow workspace"};
                    if(table === "platform_operator_accounts") data = null;
                    return Promise.resolve({data,error:null}).then(done,fail);
                  }
                }; return query;
              }};
            }`;
          return { contents, loader: "tsx", resolveDir: app };
        });
      },
    }],
  });
  const css = execFileSync(process.execPath, [resolve(root, "node_modules/tailwindcss/lib/cli.js"), "--config", resolve(app, "tailwind.config.ts"), "--input", resolve(app, "src/styles/globals.css"), "--content", resolve(app, "src/**/*.{ts,tsx}")], { cwd: app, encoding: "utf8" });
  const server = createServer((req,res) => {
    res.setHeader("Content-Type", "text/html");
    res.end('<html class="dark"><head><style>' + css + '</style></head><body><div id="root"></div><script>' + result.outputFiles[0].text + '</script></body></html>');
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

test("responsive shell: independent collapse, focus, Escape, overlay, navigation and resize", async () => {
  const {server,url} = await fixture();
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  page.setDefaultTimeout(8000);
  page.on("pageerror", error => console.error(error.message));
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  try {
    await page.goto(url);
    await page.getByRole("heading", {name:"Workspace",exact:true}).waitFor();
    await page.getByRole("button",{name:"Collapse sidebar",exact:true}).click();
    await page.setViewportSize({width:320,height:720});
    const trigger = page.getByRole("button",{name:"Open navigation",exact:true});
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    for(let index=0;index<20;index++) await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"hidden"});
    assert.equal(await trigger.evaluate(el => el === document.activeElement),true);
    await trigger.click();
    await page.mouse.click(315,350);
    await dialog.waitFor({state:"hidden"});
    await trigger.click();
    await dialog.getByRole("link",{name:isAdmin ? "Members" : "Gym Tenants",exact:true}).click();
    await dialog.waitFor({state:"hidden"});
    await trigger.click();
    assert.equal(await dialog.locator('[aria-current="page"]').count(),1);
    await page.screenshot({path:resolve("/tmp",isAdmin ? "kruxt-admin-mobile.png" : "kruxt-platform-mobile.png")});
    await page.setViewportSize({width:1280,height:800});
    await dialog.waitFor({state:"hidden"});
    await page.getByRole("button",{name:"Expand sidebar",exact:true}).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({path:resolve("/tmp",isAdmin ? "kruxt-admin-desktop.png" : "kruxt-platform-desktop.png")});
    for (const width of [320,375,768,1024,1440]) {
      await page.setViewportSize({width,height:800});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,"overflow at "+width);
    }
    await page.setViewportSize({width:320,height:720});
    await page.keyboard.press("Control+Home");
    await page.locator('a[href="#main-content"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#main-content").evaluate(el=>el===document.activeElement),true);
    if (isAdmin) {
      for (const [scenario, heading] of [["offline","Gym access unavailable"],["member","Staff access required"],["denied","Staff access required"],["empty","Create your gym"],["missing","Gym access unavailable"],["staff","Workspace"]]) {
        await page.evaluate(async scenario => {window.scenario=scenario; await window.gym.refresh();}, scenario);
        await page.getByRole("heading",{name:heading,exact:true}).waitFor();
        if (scenario !== "staff") assert.equal(await page.getByRole("heading",{name:"Workspace",exact:true}).count(),0);
        if (scenario === "offline") {
          assert.equal(await page.evaluate(()=>window.gym.noGymFound),false);
          await page.evaluate(()=>{window.scenario="staff";});
          await page.getByRole("button",{name:"Retry access check"}).click();
          await page.getByRole("heading",{name:"Workspace",exact:true}).waitFor();
        }
      }
      await page.evaluate(() => { window.scenario="delayed"; window.oldRequest=window.gym.refresh(); });
      await page.waitForFunction(() => !!window.releaseLookup);
      await page.evaluate(async () => { window.scenario="staff"; await window.gym.refresh(); window.releaseLookup(); await window.oldRequest; });
      await page.getByRole("heading",{name:"Workspace",exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.gym.error),null);
      assert.equal(await page.evaluate(()=>window.gym.gymId),"gym-1");
    }
  } finally { await browser.close(); await new Promise(done=>server.close(done)); }
});

