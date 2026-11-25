import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticationErrorMessage } from "../src/services/auth-error.ts";

const captcha = "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
const rateLimit = "Too many attempts. Wait a few minutes, then try again.";
const offline = "Cannot reach the sign-in service. Check your connection and try again. If it continues, contact support.";
const generic = "Authentication could not be completed. Try again or contact support.";

test("recovery never discloses account or credential state", () => {
  for (const code of ["invalid_credentials", "email_not_confirmed", "user_not_found", "weak_password", "user_banned", "unknown_error"]) {
    assert.equal(authenticationErrorMessage({ code, message: "private account details" }, "recovery"), generic);
  }
  for (const message of ["Invalid login credentials", "Email not confirmed", "User not found", "private account details"]) {
    assert.equal(authenticationErrorMessage({ message }, "recovery"), generic);
  }
  for (const code of ["captcha_failed", "captcha_required", "captcha_expired"]) {
    assert.equal(authenticationErrorMessage({ code, message: "private provider details" }, "recovery"), captcha);
  }
  for (const code of ["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"]) {
    assert.equal(authenticationErrorMessage({ code }, "recovery"), rateLimit);
  }
  assert.equal(authenticationErrorMessage({ status: 429 }, "recovery"), rateLimit);
  assert.equal(authenticationErrorMessage(new Error("Failed to fetch"), "recovery"), offline);
});

test("CAPTCHA errors use safe copy regardless of provider details", () => {
  for (const code of ["captcha_failed", "captcha_required", "captcha_expired"]) {
    for (const message of [undefined, "private provider body: secret-token", "Failed to fetch upstream CAPTCHA provider"]) {
      assert.equal(authenticationErrorMessage({ code, message }), captcha);
    }
  }
});

test("request, email, SMS and HTTP rate limits use safe retry guidance", () => {
  for (const code of ["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"]) {
    assert.equal(authenticationErrorMessage({ code, message: "Failed to fetch: private quota details" }), rateLimit);
  }
  assert.equal(authenticationErrorMessage({ status: 429, message: "private gateway body" }), rateLimit);
  assert.equal(authenticationErrorMessage({ status: 429 }), rateLimit);
});

test("message-only callers recognize bounded CAPTCHA and rate-limit responses", () => {
  for (const message of ["captcha verification process failed: secret-provider-detail", "CAPTCHA required", "captcha verification failed", "captcha expired", "captcha token has expired"]) {
    assert.equal(authenticationErrorMessage({ message }), captcha);
  }
  for (const message of ["Email rate limit exceeded", "sms rate limit exceeded", "request rate limit reached", "Too many requests."]) {
    assert.equal(authenticationErrorMessage({ message }), rateLimit);
  }
});

test("credentials, confirmation, password strength and offline errors stay distinct", () => {
  for (const [code, message, expected] of [
    ["invalid_credentials", "invalid login credentials", "Email or password is incorrect."],
    ["email_not_confirmed", "email not confirmed", "Confirm your email before signing in."],
    ["weak_password", null, "Choose a stronger password and try again."]
  ]) {
    assert.equal(authenticationErrorMessage({ code, message: "Failed to fetch secret provider body" }), expected);
    if (message) assert.equal(authenticationErrorMessage({ message }), expected);
  }
  for (const message of ["Failed to fetch", "fetch failed", "Network request failed", "NetworkError", "Load failed"]) {
    assert.equal(authenticationErrorMessage(new Error(message)), offline);
  }
});

test("untrusted messages, malformed values and unknown codes never leak details", () => {
  for (const error of [
    null, undefined, "secret raw response", 429, {}, { message: 42, code: {} },
    { message: "<script>secret-token</script>" },
    { message: "upstream body says captcha failed: secret-token" },
    { message: "private account email rate limit exceeded secret-token" },
    { code: "unknown_provider_error", message: "captcha required: secret-token" },
    { code: "unknown_provider_error", message: "Failed to fetch secret-token" },
    { status: 500, message: "private provider body" },
    { status: "429", message: "private provider body" }
  ]) {
    assert.equal(authenticationErrorMessage(error), generic);
  }
});
