import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticationErrorMessage } from "../src/lib/auth/auth-error.ts";

const captcha = "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
const rateLimit = "Too many attempts. Wait a few minutes, then try again.";
const offline = "Cannot reach the sign-in service. Check your connection and try again.";
const generic = "Authentication could not be completed. Try again or contact support.";

test("CAPTCHA codes and legacy messages never expose provider details", () => {
  for (const code of ["captcha_required", "captcha_failed", "captcha_expired"]) {
    for (const message of [undefined, "private provider response", "Failed to fetch secret-provider-token"]) {
      assert.equal(authenticationErrorMessage({ code, message }), captcha);
    }
  }
  for (const message of ["CAPTCHA required", "captcha verification process failed: secret-provider-token", "captcha expired", "captcha token has expired"]) {
    assert.equal(authenticationErrorMessage({ message }), captcha);
  }
});

test("request, email, SMS and status-only rate limits provide safe retry guidance", () => {
  for (const code of ["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"]) {
    assert.equal(authenticationErrorMessage({ code, message: "Failed to fetch secret-provider-token" }), rateLimit);
  }
  assert.equal(authenticationErrorMessage({ status: 429, message: "secret-provider-token" }), rateLimit);
  assert.equal(authenticationErrorMessage({ status: 429 }), rateLimit);
  for (const message of ["Email rate limit exceeded", "sms rate limit exceeded", "Request rate limit reached", "Too many requests."]) {
    assert.equal(authenticationErrorMessage({ message }), rateLimit);
  }
});

test("credential, confirmation, strength and offline distinctions are preserved", () => {
  for (const [code, message, expected] of [
    ["invalid_credentials", "invalid login credentials", "Email or password is incorrect."],
    ["email_not_confirmed", "email not confirmed", "Confirm your email before signing in."],
    ["weak_password", null, "Choose a stronger password and try again."]
  ]) {
    assert.equal(authenticationErrorMessage({ code, message: "Failed to fetch secret-provider-token" }), expected);
    if (message) assert.equal(authenticationErrorMessage({ message }), expected);
  }
  for (const message of ["Failed to fetch", "fetch failed", "Network request failed", "NetworkError", "Load failed"]) {
    assert.equal(authenticationErrorMessage(new Error(message)), offline);
  }
});

test("untrusted messages and malformed values fail closed", () => {
  for (const error of [
    null, undefined, "secret-provider-token", 429, {}, { code: {}, message: 42 },
    { message: "<script>secret-provider-token</script>" },
    { message: "upstream says captcha failed: secret-provider-token" },
    { message: "private account email rate limit exceeded secret-provider-token" },
    { code: "unknown_error", message: "captcha required: secret-provider-token" },
    { code: "unknown_error", message: "Failed to fetch secret-provider-token" },
    { status: 500, message: "private provider body" }, { status: "429", message: "private provider body" }
  ]) assert.equal(authenticationErrorMessage(error), generic);
});
