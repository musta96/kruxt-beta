import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

for (const consumer of ["apps/mobile", "packages/ui"]) {
  const consumerRequire = createRequire(new URL(`../${consumer}/package.json`, import.meta.url));
  const nativeRequire = createRequire(consumerRequire.resolve("react-native/package.json"));
  const devtoolsRequire = createRequire(nativeRequire.resolve("react-devtools-core/package.json"));
  const shellQuote = devtoolsRequire("shell-quote");

  test(`${consumer} resolves the patched shell quoting dependency`, () => {
    assert.equal(devtoolsRequire("shell-quote/package.json").version, "1.11.0");
  });

  test(`${consumer} rejects invalid operator tokens without invoking a shell`, () => {
    for (const newline of ["\n", "\r", "\u2028", "\u2029"]) {
      assert.throws(() => shellQuote.quote([{ op: `;${newline}fixture` }]), TypeError);
    }
    assert.throws(() => shellQuote.quote([{ op: "unrecognized" }]), TypeError);
  });

  test(`${consumer} preserves ordinary argument quoting`, () => {
    const args = ["expo", "path with spaces", "apostrophe's", "$literal", "line\nbreak"];
    assert.deepEqual(shellQuote.parse(shellQuote.quote(args)), args);
  });

  test(`${consumer} rejects line terminators after comment tokens`, () => {
    for (const newline of ["\n", "\r", "\u2028", "\u2029"]) {
      assert.throws(() => shellQuote.quote(["fixture", { comment: "note" }, `text${newline}fixture`]), TypeError);
    }
  });
}
