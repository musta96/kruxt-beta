import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../../../apps/admin/src/services/auth-error.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exports = {};
new Function("exports", outputText)(exports);
const message = exports.authenticationErrorMessage;

test("network failures produce an actionable connection message, not a password diagnosis", () => {
  for (const text of ["Failed to fetch", "Network request failed", "Load failed", "fetch failed"]) {
    assert.match(message(new TypeError(text)), /Cannot reach the sign-in service/);
    assert.doesNotMatch(message(new TypeError(text)), /incorrect/);
  }
});
test("expected auth errors have stable safe messages", () => {
  assert.equal(message({ code: "invalid_credentials" }), "Email or password is incorrect.");
  assert.equal(message({ code: "email_not_confirmed" }), "Confirm your email before signing in.");
  assert.match(message({ code: "over_request_rate_limit" }), /Too many attempts/);
});
test("unexpected error messages, tokens and implementation details are never displayed", () => {
  for (const error of [null, "raw-secret", new Error("https://example.test?token=private"), { message: 12 }]) {
    assert.equal(message(error), "Authentication could not be completed. Try again or contact support.");
  }
});
