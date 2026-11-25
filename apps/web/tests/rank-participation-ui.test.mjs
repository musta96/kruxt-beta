import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium } = require("@playwright/test");

test("challenge controls reflect persisted completion and RPC outcomes without false leave success", async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import React from "react";
        import {createRoot} from "react-dom/client";
        import {RankScreen} from "./src/components/public/RankScreen";
        window.challenge = {id:"trial", title:"A persisted challenge", description:null,
          challengeType:"consistency", gymId:null, startsAt:"2026-01-01", endsAt:"2027-01-01",
          pointsPerUnit:1, joined:true, viewerScore:3, completed:true, leaderboard:[]};
        window.rpcCalls=[];
        window.outcome=true;
        window.client={rpc:async(name,args)=>{
          window.rpcCalls.push([name,args]);
          if(window.defer) await new Promise(resolve=>window.resolveMutation=resolve);
          if(window.outcome === "error") return {data:null,error:{message:"Server denied participation"}};
          if(window.outcome === false) {
            window.challenge.completed=true;
            return {data:false,error:null};
          }
          window.challenge.joined=name==="join_challenge";
          window.challenge.viewerScore=window.challenge.joined ? 0 : null;
          return {data:name==="leave_challenge" ? true : "participant",error:null};
        }};
        createRoot(document.getElementById("root")).render(<RankScreen />);
      `, resolveDir: app, loader: "tsx",
    },
    bundle: true, write: false, jsx: "automatic", format: "iife",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{
      name: "rank-fixture",
      setup(builder) {
        builder.onResolve({filter:/^(@\/|next\/link$)/}, args=>({path:args.path,namespace:"fixture"}));
        builder.onLoad({filter:/.*/,namespace:"fixture"}, args=>{
          let contents;
          if(args.path==="next/link") contents='export default function Link({children,...props}){return <a {...props}>{children}</a>;}';
          else if(args.path.endsWith("MemberShell")) contents='export function MemberShell({title,subtitle,children}){return <main style={{padding:"1rem",maxWidth:1100,margin:"auto"}}><h1>{title}</h1><p>{subtitle}</p>{children}</main>;}';
          else if(args.path.endsWith("usePublicSession")) contents='const state={status:"ready",user:{id:"viewer"}}; export const usePublicSession=()=>({state,supabase:window.client});';
          else if(args.path.endsWith("achievements")) contents='export const loadAchievementSnapshot=async()=>null;';
          else if(args.path.endsWith("/rank")) contents=`
            export {joinChallenge,leaveChallenge} from "${resolve(app,"src/lib/public/rank.ts")}";
            export async function loadRankOverview(){return {viewerUserId:"viewer",homeGymId:null,
              weeklyBoards:[],activeChallenges:[structuredClone(window.challenge)]};}
          `;
          else throw new Error("Unexpected fixture import: "+args.path);
          return {contents,loader:"tsx",resolveDir:app};
        });
      },
    }],
  });
  const css=readFileSync(resolve(app,"app/globals.css"),"utf8");
  const server=createServer((req,res)=>{
    res.setHeader("Content-Type","text/html");
    res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script>'+bundle.outputFiles[0].text+'</script></body></html>');
  });
  await new Promise(done=>server.listen(0,"127.0.0.1",done));
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    page.setDefaultTimeout(8000);
    await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1" ? route.continue() : route.abort());
    await page.goto("http://127.0.0.1:"+server.address().port);
    const card=page.locator("article").filter({has:page.getByRole("heading",{name:"A persisted challenge",exact:true})});
    await card.getByText("Completed",{exact:true}).waitFor();
    assert.equal(await card.getByRole("button").count(),0);
    assert.equal(await page.evaluate(()=>window.rpcCalls.length),0);
    await card.getByText("Completed entries cannot be left.",{exact:true}).waitFor();
    await card.screenshot({path:resolve("/tmp","kruxt-rank-completed.png")});

    await page.evaluate(()=>{window.challenge.completed=false;});
    await page.getByRole("button",{name:"Refresh",exact:true}).click();
    const leave=page.getByRole("button",{name:"Leave challenge: A persisted challenge",exact:true});
    await leave.waitFor();
    await card.getByText("Leaving removes your entry and score.",{exact:true}).waitFor();
    await page.evaluate(()=>{window.outcome=false;});
    await leave.click();
    await page.getByRole("alert").filter({hasText:"entry was not removed"}).waitFor();
    assert.equal(await page.getByText("Challenge left.",{exact:true}).count(),0);
    await card.getByText("Completed",{exact:true}).waitFor();

    await page.evaluate(()=>{window.challenge.completed=false;window.challenge.joined=false;window.outcome="error";});
    await page.getByRole("button",{name:"Refresh",exact:true}).click();
    const join=page.getByRole("button",{name:"Join challenge: A persisted challenge",exact:true});
    await join.click();
    await page.getByRole("alert").filter({hasText:"Server denied participation"}).waitFor();
    assert.equal(await page.getByText("Challenge joined.",{exact:true}).count(),0);

    await page.evaluate(()=>{window.outcome=true;window.defer=true;window.rpcCalls=[];});
    await join.evaluate(button=>{
      button.dispatchEvent(new MouseEvent("click",{bubbles:true}));
      button.dispatchEvent(new MouseEvent("click",{bubbles:true}));
    });
    await page.waitForFunction(()=>!!window.resolveMutation);
    assert.equal(await page.evaluate(()=>window.rpcCalls.length),1);
    assert.equal(await page.getByRole("button",{name:"Refresh",exact:true}).isDisabled(),true);
    await page.evaluate(()=>{window.defer=false;window.resolveMutation();});
    await page.getByRole("status").filter({hasText:"Challenge joined."}).waitFor();
    await leave.click();
    await page.getByRole("status").filter({hasText:"Challenge left."}).waitFor();
    await join.waitFor();
    assert.equal(await page.evaluate(()=>window.challenge.viewerScore),null,"removed entries have no score");
    assert.equal(await page.evaluate(()=>window.rpcCalls.every(([name])=>["join_challenge","leave_challenge"].includes(name))),true,"participation must not submit scores");

    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      assert.equal(await card.evaluate(el=>el.scrollWidth<=el.clientWidth),true,"challenge card overflow at "+width);
      if(width!==320) await card.screenshot({path:resolve("/tmp","kruxt-rank-participation-"+width+".png")});
    }
  } finally {
    await browser?.close();
    await new Promise(done=>server.close(done));
  }
});
