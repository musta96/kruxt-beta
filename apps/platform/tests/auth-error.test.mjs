import assert from "node:assert/strict";
import { test } from "node:test";
import { platformAuthErrorMessage } from "../src/services/auth-error.ts";

test("CAPTCHA codes never become invalid-credential errors or reveal details", () => {
  for (const code of ["captcha_failed", "captcha_required", "captcha_expired"]) {
    for (const intent of ["signin", "recovery"]) {
      assert.match(platformAuthErrorMessage({ code, message: "invalid login credentials SECRET" }, intent), /^Security verification/);
    }
  }
});
test("rate-limit codes and HTTP status give retry guidance", () => {
  for (const error of [{ code: "over_request_rate_limit" }, { code: "over_email_send_rate_limit" }, { code: "over_sms_send_rate_limit" }, { status: 429 }]) {
    assert.match(platformAuthErrorMessage({ ...error, message: "SECRET" }), /^Too many attempts/);
  }
});
test("sign-in keeps credential, confirmation and network distinctions", () => {
  assert.match(platformAuthErrorMessage({ code: "invalid_credentials", message: "failed to fetch SECRET" }), /^Email or password/);
  assert.match(platformAuthErrorMessage({ code: "email_not_confirmed" }), /^Confirm your email/);
  assert.match(platformAuthErrorMessage(new TypeError("Failed to fetch")), /^Cannot reach/);
});
test("recovery does not reveal credential/account-confirmation distinctions", () => {
  for (const code of ["invalid_credentials", "email_not_confirmed", "user_not_found"]) {
    assert.equal(platformAuthErrorMessage({ code, message: "SECRET" }, "recovery"), "We couldn't request a reset link. Check your connection and try again in a few minutes.");
  }
});
test("legacy message-only errors are recognized narrowly and sanitized", () => {
  assert.match(platformAuthErrorMessage({ message: "captcha verification process failed: SECRET" }), /^Security verification/);
  assert.match(platformAuthErrorMessage({ message: "email rate limit exceeded" }), /^Too many attempts/);
  for (const error of [null, "SECRET", { code: "unexpected", message: "SECRET" }, { message: "Please disable captcha SECRET" }]) {
    assert.doesNotMatch(platformAuthErrorMessage(error), /SECRET|disable captcha/);
  }
});
