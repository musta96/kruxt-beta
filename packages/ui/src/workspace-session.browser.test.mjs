import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = createRequire(new URL("../../../package.json", import.meta.url))("@playwright/test");
const { build } = createRequire(require.resolve("../../../node_modules/vite/package.json"))("esbuild");
let browser;
const servers = [];
before(async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("./workspace-session.ts", import.meta.url))], bundle: true, write: false, format: "esm" });
  const code = bundle.outputFiles[0].text;
  const html = `<!doctype html><html><body><button id="open">Open gym</button><p role="status" id="status">Ready</p><script type="module">
  ${code}
  const user='fixture-user'; const source=location.port==='3100';
  let current=source ? {user:{id:user},access_token:'SYNTHETIC_ACCESS',refresh_token:'SYNTHETIC_REFRESH'} : null;
  let installed=0; const listeners=new Set();
  const client={auth:{
    getUser:async()=>({data:{user:current?.user??null},error:null}),
    getSession:async()=>({data:{session:current},error:null}),
    setSession:async(tokens)=>{installed++;current={...tokens,user:{id:user}};return {data:{session:current},error:null};},
    signOut:async()=>{current=null;},
    onAuthStateChange:fn=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};}
  }};
  const status=document.querySelector('#status');
  if(source) document.querySelector('#open').onclick=()=>openWorkspace({win:window,client,workspace:'admin',projectUrl:'https://fixture.supabase.co',origin:'http://127.0.0.1:3000',expectedUser:user,prepare:async()=>'/members?gymId=fixture&source=platform'}).then(()=>status.textContent='Source confirmed').catch(()=>status.textContent='Source failed');
  else if(location.pathname==='/workspace-entry') receiveWorkspace({win:window,client,workspace:'admin',projectUrl:'https://fixture.supabase.co',onComplete:path=>{status.textContent='Destination confirmed '+path+' installed='+installed;},onError:message=>{status.textContent=message;}});
  </script></body></html>`;
  for (const port of [3000, 3100]) {
    const server = createServer((_request, response) => { response.setHeader("Content-Type", "text/html"); response.end(html); });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
    servers.push(server);
  }
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  for (const server of servers) await new Promise(resolve => server.close(resolve));
});

test("two real browser origins complete a clicked handoff without URL credentials or a second password", async () => {
  const context = await browser.newContext();
  try {
    await context.route("**/*", route => ["http://127.0.0.1:3000", "http://127.0.0.1:3100"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3100");
    const popup = context.waitForEvent("page");
    await page.getByRole("button", { name: "Open gym" }).click();
    const gym = await popup;
    await gym.getByRole("status").filter({ hasText: "Destination confirmed" }).waitFor();
    assert.match(await gym.getByRole("status").innerText(), /installed=1/);
    await page.getByRole("status").filter({ hasText: "Source confirmed" }).waitFor();
    assert.equal(gym.url(), "http://127.0.0.1:3000/workspace-entry");
    assert.equal(await gym.evaluate(() => sessionStorage.getItem("kruxt-workspace-return-origin")), "http://127.0.0.1:3100");
    assert.doesNotMatch(JSON.stringify(await context.storageState()), /SYNTHETIC_ACCESS|SYNTHETIC_REFRESH/);
  } finally { await context.close(); }
});
