import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const rootRequire = createRequire(new URL("../package.json", import.meta.url));
const consumerRequire = (app) => createRequire(new URL(`../apps/${app}/package.json`, import.meta.url));

test("PostCSS consumer pins, ordinary CSS, and bounded previous-map reads", async (t) => {
  const fixture = fs.mkdtempSync(join(tmpdir(), "kruxt-postcss-contract-"));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const cssDir = join(fixture, "css");
  fs.mkdirSync(cssDir);
  const from = join(cssDir, "input.css");
  const marker = "HARMLESS_POSTCSS_CONTRACT_MARKER";
  const map = JSON.stringify({
    version: 3, file: "input.css", sources: ["fixture.css"],
    sourcesContent: [marker], names: [], mappings: "AAAA",
  });
  const outside = join(fixture, "outside.map");
  const text = join(fixture, "marker.txt");
  const allowed = join(cssDir, "allowed.map");
  const linked = join(cssDir, "linked.map");
  fs.writeFileSync(outside, map);
  fs.writeFileSync(text, marker);
  fs.writeFileSync(allowed, map);
  fs.symlinkSync(outside, linked);

  // Install before loading PostCSS, which captures readFileSync at require time.
  const readFileSync = fs.readFileSync;
  const reads = [];
  t.mock.method(fs, "readFileSync", function (path, ...args) {
    if ([outside, text, allowed, linked].includes(String(path))) reads.push(String(path));
    return readFileSync.call(this, path, ...args);
  });

  const consumers = [["root", rootRequire]];
  for (const app of ["web", "admin", "platform"]) {
    const appRequire = consumerRequire(app);
    if (app !== "web") consumers.push([`${app} direct`, appRequire]);
    consumers.push([`${app} Next`, createRequire(appRequire.resolve("next/package.json"))]);
  }
  for (const [name, require] of consumers) {
    await t.test(`${name} resolves PostCSS 8.5.31`, () => {
      assert.equal(require("postcss/package.json").version, "8.5.31");
    });
    await t.test(`${name} parses CSS and only loads an allowed previous map`, async () => {
      const postcss = require("postcss");
      const css = ".fixture { color: red; margin: 0; }";
      const normal = await postcss([]).process(css, { from, map: false });
      assert.equal(normal.css, css);
      assert.equal(normal.root.first.selector, ".fixture");
      assert.equal(normal.root.first.nodes[0].value, "red");

      const withMap = (target) => `${css}\n/*# sourceMappingURL=${target} */`;
      reads.length = 0;
      const permitted = await postcss([]).process(withMap("allowed.map"), {
        from, map: { inline: false },
      });
      assert.deepEqual(reads, [allowed], "positive control must observe a real map read");
      assert.ok(JSON.stringify(permitted.map.toJSON()).includes(marker));

      // GHSA-fxqj-rqcc-2cmp: no-from absolute maps; traversal/symlinks use
      // the patched real-path boundary. All targets are tiny owned fixtures.
      // https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp
      for (const [target, options] of [
        [outside, { from: undefined }], [text, { from: undefined }], ["../outside.map", { from }],
        ["../marker.txt", { from }], ["linked.map", { from }],
      ]) {
        reads.length = 0;
        const result = await postcss([]).process(withMap(target), {
          ...options, map: { inline: false },
        });
        assert.deepEqual(reads, [], `must not read ${target}`);
        assert.equal(result.root.first.source.input.map, undefined);
        assert.ok(!JSON.stringify(result.map?.toJSON() ?? null).includes(marker));
      }
    });
  }
});

test("root resolves the pinned Zod, React Router DOM, and Vite", () => {
  for (const [name, version] of [
    ["zod", "4.6.7"], ["react-router-dom", "6.30.6"], ["vite", "6.4.5"],
  ]) assert.equal(rootRequire(`${name}/package.json`).version, version, name);
});

test("CSS consumers resolve patched Nano ID and retain bounded identifier generation", () => {
  for (const require of [rootRequire, ...["web", "admin", "platform"].map(app =>
    createRequire(createRequire(consumerRequire(app).resolve("next/package.json")).resolve("postcss/package.json")))]) {
    const postcssRequire = createRequire(require.resolve("postcss/package.json"));
    const [major, minor, patch] = postcssRequire("nanoid/package.json").version.split(".").map(Number);
    assert.ok(major === 3 && minor === 3 && patch >= 18, "Nano ID 3.3 must meet the audited security floor");
    const { nanoid, customAlphabet } = postcssRequire("nanoid");
    const ids = Array.from({ length: 20 }, () => nanoid());
    assert.equal(new Set(ids).size, 20);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{21}$/);
    assert.match(customAlphabet("abc", 6)(), /^[abc]{6}$/);
    assert.match(postcssRequire("nanoid/non-secure").nanoid(), /^[A-Za-z0-9_-]{21}$/);
  }
});

test("Zod rejects oversized containers before child or container refinements", async (t) => {
  const { z } = rootRequire("zod");
  // https://github.com/colinhacks/zod/pull/6652: leading size bounds abort
  // before walking children. Three elements suffice to verify the contract.
  for (const kind of ["array", "set", "map"]) {
    for (const bound of ["max", kind === "array" ? "length" : "size"]) {
      await t.test(`${kind}.${bound}`, () => {
        let children = 0;
        let containers = 0;
        const child = z.string().refine((value) => { children++; return value !== "bad"; });
        const container = kind === "map" ? z.map(child, child) : z[kind](child);
        const schema = container[bound](2).refine(() => { containers++; return true; });
        const input = (values) => kind === "array" ? values : kind === "set"
          ? new Set(values) : new Map(values.map((value) => [value, value]));
        const oversized = schema.safeParse(input(["one", "two", "three"]));
        assert.equal(oversized.success, false);
        assert.deepEqual(oversized.error.issues.map(({ code }) => code), ["too_big"]);
        assert.equal(children, 0);
        assert.equal(containers, 0);
        assert.equal(schema.safeParse(input(["one", "two"])).success, true);
        assert.equal(children, kind === "map" ? 4 : 2);
        assert.equal(containers, 1);
        assert.equal(schema.safeParse(input(["one", "bad"])).success, false);
      });
    }
  }
});

test("Zod ordinary records retain acceptance, rejection, and issue paths", () => {
  const { z } = rootRequire("zod");
  const schema = z.record(z.string(), z.object({ count: z.number().int().nonnegative() }));
  const valid = { workouts: { count: 2 }, classes: { count: 0 } };
  assert.deepEqual(schema.parse(valid), valid);
  const invalid = schema.safeParse({ workouts: { count: -1 } });
  assert.equal(invalid.success, false);
  assert.deepEqual(invalid.error.issues[0].path, ["workouts", "count"]);
  assert.equal(schema.safeParse({ workouts: { count: "2" } }).success, false);
});

test("React Router memory navigation preserves app paths and normalizes URL-like paths", async (t) => {
  const { createMemoryRouter, resolvePath } = rootRequire("react-router-dom");
  const router = createMemoryRouter([{ path: "*", element: null }], { initialEntries: ["/"] });
  t.after(() => router.dispose());
  await router.navigate("/workouts?view=recent#today", { state: { source: "fixture" } });
  assert.equal(router.state.location.pathname, "/workouts");
  assert.equal(router.state.location.search, "?view=recent");
  assert.equal(router.state.location.hash, "#today");
  assert.deepEqual(router.state.location.state, { source: "fixture" });
  await router.navigate("/classes", { replace: true });
  assert.equal(router.state.historyAction, "REPLACE");
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, "/");

  // Upstream removes double slashes and resolves colon paths as app paths,
  // not external navigation. Memory routing never launches a browser/request.
  // https://github.com/remix-run/react-router/commit/ccb31278bccbe45f60d9dfe3e42f083d217fa022
  for (const [input, expected] of [
    ["foo:bar", "/foo:bar"],
    ["//fixture.invalid/workouts", "/fixture.invalid/workouts"],
    ["https://fixture.invalid/workouts", "/https:/fixture.invalid/workouts"],
  ]) {
    await router.navigate("/");
    assert.equal(resolvePath(input, "/").pathname, expected);
    await router.navigate(input);
    assert.equal(router.state.location.pathname, expected);
    assert.equal(new URL(router.state.location.pathname, "http://app.invalid").origin, "http://app.invalid");
    assert.equal(router.state.errors, null);
  }
});

test("Expo CLI resolves Undici 6.29.1 and preserves safe loopback fetch/header/cookie behavior", { timeout: 10_000 }, async (t) => {
  const expoRequire = createRequire(consumerRequire("mobile").resolve("expo/package.json"));
  const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
  assert.equal(cliRequire("undici/package.json").version, "6.29.1");
  const { Agent, Headers, Request, fetch, getCookies, getSetCookies, setCookie } = cliRequire("undici");
  const cookies = new Headers();
  setCookie(cookies, { name: "fixture", value: "ok", path: "/", httpOnly: true, sameSite: "Lax" });
  assert.deepEqual(getSetCookies(cookies), [{
    name: "fixture", value: "ok", path: "/", httpOnly: true, sameSite: "Lax",
  }]);
  assert.deepEqual(getCookies(new Headers({ cookie: "fixture=ok; theme=light" })), {
    fixture: "ok", theme: "light",
  });
  for (const [name, value] of [["bad\r\nname", "ok"], ["x-fixture", "ok\r\ninjected: yes"]]) {
    assert.throws(() => new Headers({ [name]: value }), TypeError);
    assert.throws(() => new Request("http://127.0.0.1/", { headers: { [name]: value } }), TypeError);
  }

  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    res.writeHead(200, { "content-type": "application/json", "set-cookie": "reply=ok; Path=/; HttpOnly" });
    res.end(JSON.stringify({ url: req.url, header: req.headers["x-fixture"], cookie: req.headers.cookie }));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const dispatcher = new Agent({ connect: { timeout: 2000 } });
  t.after(() => dispatcher.destroy());
  const url = `http://127.0.0.1:${server.address().port}/fixture?mode=ok`;
  const response = await fetch(url, {
    dispatcher, signal: AbortSignal.timeout(3000), redirect: "error",
    headers: { "x-fixture": "ordinary", cookie: "fixture=ok" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), {
    url: "/fixture?mode=ok", header: "ordinary", cookie: "fixture=ok",
  });
  assert.equal(getSetCookies(response.headers)[0].name, "reply");
  await assert.rejects(fetch(url, {
    dispatcher, signal: AbortSignal.timeout(3000), headers: { "x-fixture": "bad\r\ninjected: yes" },
  }), TypeError);
  assert.equal(requests, 1, "invalid headers must fail before another request reaches the server");
});
