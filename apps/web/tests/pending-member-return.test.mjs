import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { buildSync } = createRequire(require.resolve("vite"))("esbuild");
const source = buildSync({ entryPoints: [fileURLToPath(new URL("../src/lib/auth/pending-member-return.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" }).outputFiles[0].text;
const { savePendingMemberReturn, takePendingMemberReturn } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const key = "kruxt:pending-member-return:v1";
const storage = () => {
  const map = new Map();
  return { map, getItem: name => map.get(name) ?? null, setItem: (name, value) => map.set(name, value), removeItem: name => map.delete(name) };
};

test("only sanitized member references survive once for fifteen minutes", () => {
  const tab = storage();
  savePendingMemberReturn(tab, "/privacy?token=secret&email=private", 1000);
  assert.deepEqual(JSON.parse(tab.getItem(key)), { path: "/privacy", createdAt: 1000 });
  assert.equal(takePendingMemberReturn(tab, 1000 + 900000), "/privacy");
  assert.equal(takePendingMemberReturn(tab, 1000 + 900000), null);
});
test("invalid, stale, future and malformed records are discarded without echoing data", () => {
  for (const raw of ["{", "x".repeat(4097), JSON.stringify({ path: "https://evil.test", createdAt: 0 }),
    JSON.stringify({ path: "/privacy", createdAt: "0" }), JSON.stringify({ path: "/privacy", createdAt: 1001 }),
    JSON.stringify({ path: "/privacy", createdAt: -900001 }), "null", "[]"]) {
    const tab = storage(); tab.setItem(key, raw);
    assert.equal(takePendingMemberReturn(tab, 1000), null);
    assert.equal(tab.getItem(key), null);
  }
  const tab = storage(); savePendingMemberReturn(tab, "/privacy", 1000);
  savePendingMemberReturn(tab, "/admin", 1001);
  assert.equal(tab.getItem(key), null);
});
test("blocked storage never prevents sign-in or grants a destination", () => {
  const blocked = { getItem() { throw Error("private-storage"); }, setItem() { throw Error("private-storage"); }, removeItem() { throw Error("private-storage"); } };
  assert.doesNotThrow(() => savePendingMemberReturn(blocked, "/privacy"));
  assert.equal(takePendingMemberReturn(blocked), null);
  for (const now of [NaN, Infinity]) {
    const tab = storage(); savePendingMemberReturn(tab, "/privacy", now);
    assert.equal(tab.getItem(key), null);
  }
});
