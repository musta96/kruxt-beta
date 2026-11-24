import assert from "node:assert/strict";
import { test } from "node:test";
import { appOrigin, appUrl, safeOrigin } from "./app-urls.ts";

test("configured https origins win and lose any path or trailing slash", () => {
  assert.equal(appOrigin("admin", ["https://gym.example.com/login/"]), "https://gym.example.com");
  assert.equal(appUrl("member", "/plan", ["https://app.example.com/"]), "https://app.example.com/plan");
});

test("first valid candidate is used; unsafe values are skipped", () => {
  assert.equal(appOrigin("admin", [undefined, "", "javascript:alert(1)", "https://a.test"]), "https://a.test");
  assert.equal(appOrigin("admin", ["https://user:pass@evil.test", "https://b.test"]), "https://b.test");
  assert.equal(safeOrigin("http://evil.test"), null);
  assert.equal(safeOrigin("http://localhost:3000/x"), "http://localhost:3000");
});

test("falls back to the hosted apps in production and localhost otherwise", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(appOrigin("admin", []), "https://kruxt-admin.vercel.app");
    assert.equal(appOrigin("platform", []), "https://kruxt-platform.vercel.app");
    assert.equal(appOrigin("member", []), "https://kruxt-beta.vercel.app");
    process.env.NODE_ENV = "development";
    assert.equal(appOrigin("admin", []), "http://localhost:3000");
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("only same-site absolute paths are appended", () => {
  assert.equal(appUrl("admin", "//evil.test", ["https://a.test"]), "https://a.test/");
  assert.equal(appUrl("admin", "https://evil.test", ["https://a.test"]), "https://a.test/");
  assert.equal(appUrl("admin", "/members?x=1", ["https://a.test"]), "https://a.test/members?x=1");
});
