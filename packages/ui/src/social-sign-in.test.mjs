import assert from "node:assert/strict";
import { test } from "node:test";
import { verifiedSocialProviders } from "./social-sign-in.ts";

test("no setting means no social buttons", () => {
  assert.deepEqual(verifiedSocialProviders(undefined), []);
  assert.deepEqual(verifiedSocialProviders(null), []);
  assert.deepEqual(verifiedSocialProviders(""), []);
  assert.deepEqual(verifiedSocialProviders(" , "), []);
});

test("only known providers are returned, in a fixed order, without duplicates", () => {
  assert.deepEqual(verifiedSocialProviders("google"), ["google"]);
  assert.deepEqual(verifiedSocialProviders("apple, GOOGLE ,google"), ["google", "apple"]);
  assert.deepEqual(verifiedSocialProviders("facebook,github,true,1"), []);
  assert.deepEqual(verifiedSocialProviders("apple"), ["apple"]);
});
