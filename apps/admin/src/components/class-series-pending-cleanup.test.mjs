import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createServer } from "node:http";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(app, "../../package.json"));
const { build } = createRequire(require.resolve("vite"))("esbuild");
const { chromium } = require("@playwright/test");
const ttl = 86400000;
const start = 1800000000000;
const viewerId = "78000000-0000-4000-8000-000000000001";
const gymId = "78000000-0000-4000-8000-000000000010";
const requestId = "78000000-0000-4000-8000-000000000020";
const other = "78000000-0000-4000-8000-000000000099";
const name = `kruxt:class-series-pending:v1:${viewerId}:${gymId}:announcement`;
const entry = { version: 1, kind: "announcement", viewerId, gymId, requestId, createdAt: start, payload: {
  seriesId: gymId, requestId, audience: "series_subscribers", body: "PRIVATE_SENTINEL", classId: null, cancelOccurrence: false
} };

test("root provider redacts across routes/logout, periodic and resume events without exposing or dispatching payloads", async () => {
  const result = await build({
    stdin: { resolveDir: app, loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {Providers} from "./src/app/providers";
      window.path = "/classes/series";
      window.viewer = ${JSON.stringify(viewerId)};
      const root = createRoot(document.getElementById("root"));
      window.unmount = () => root.unmount();
      root.render(<React.StrictMode><Providers><p>Admin workspace</p></Providers></React.StrictMode>);
    ` },
    bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "local-provider-contexts", setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$|^@\/contexts\// }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^@\// }, args => ({ path: resolve(app, "src", args.path.slice(2) + (args.path.startsWith("@/services/") ? ".ts" : ".tsx")) }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        loader: "tsx", resolveDir: app,
        contents: args.path === "next/navigation" ? `
          import {useEffect,useState} from "react";
          export function usePathname() {
            const [path,setPath] = useState(window.path);
            useEffect(() => { const update = () => setPath(window.path); window.addEventListener("route",update); return () => window.removeEventListener("route",update); }, []);
            return path;
          }
        ` : args.path.endsWith("auth-context") ? `
          import {createContext,useContext,useEffect,useState} from "react";
          const Auth = createContext(null);
          export function AuthProvider({children}) {
            const [id,setId] = useState(window.viewer);
            useEffect(() => { const update = () => setId(window.viewer); window.addEventListener("account",update); return () => window.removeEventListener("account",update); }, []);
            return <Auth.Provider value={{user:id ? {id} : null}}>{children}</Auth.Provider>;
          }
          export const useAuth = () => useContext(Auth);
        ` : "export const GymProvider = ({children}) => children;"
      }));
    } }]
  });
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end('<div id="root"></div><script>' + result.outputFiles[0].text + '</script>');
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const requests = [], errors = [];
    await page.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { requests.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: start });
    await page.addInitScript(({name,entry}) => sessionStorage.setItem(name, JSON.stringify(entry)), { name, entry: { ...entry, createdAt: start - ttl } });
    await page.goto(origin);
    await page.waitForFunction(name => JSON.parse(sessionStorage.getItem(name)).payload === null, name);
    const seed = () => page.evaluate(({name,entry}) => sessionStorage.setItem(name, JSON.stringify(entry)), { name, entry });
    const expectRedacted = async () => {
      await page.waitForFunction(name => JSON.parse(sessionStorage.getItem(name)).payload === null, name);
      assert.deepEqual(await page.evaluate(name => JSON.parse(sessionStorage.getItem(name)), name), { ...entry, payload: null });
      assert.equal(await page.locator("body").textContent().then(text => text.includes("PRIVATE_SENTINEL")), false);
    };
    await seed();
    await page.clock.setSystemTime(start + ttl - 60000);
    await page.evaluate(() => { window.path = "/members"; window.dispatchEvent(new Event("route")); });
    await page.waitForTimeout(20);
    assert.notEqual(await page.evaluate(name => JSON.parse(sessionStorage.getItem(name)).payload, name), null);
    await page.clock.setSystemTime(start + ttl);
    await page.evaluate(() => { window.path = "/settings"; window.dispatchEvent(new Event("route")); });
    await expectRedacted();
    for (const viewer of [null, other]) {
      await seed();
      await page.evaluate(viewer => { window.viewer = viewer; window.dispatchEvent(new Event("account")); }, viewer);
      await expectRedacted();
    }
    await seed();
    await page.clock.fastForward(60000);
    await expectRedacted();
    for (const event of ["visibilitychange", "pageshow"]) {
      await seed();
      await page.clock.setSystemTime(start + ttl * 30);
      await page.evaluate(event => (event === "pageshow" ? window : document).dispatchEvent(new Event(event)), event);
      await expectRedacted();
    }
    await page.evaluate(() => window.unmount());
    await seed();
    await page.clock.fastForward(60000);
    await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pageshow")); });
    assert.notEqual(await page.evaluate(name => JSON.parse(sessionStorage.getItem(name)).payload, name), null);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(done => server.close(done));
  }
});
