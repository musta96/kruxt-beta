import assert from "node:assert/strict";
import test from "node:test";

import { resolveNativeRootSurface } from "../src/native/runtime-gating.ts";

const ready = {
  sessionStatus: "ready" as const,
  hasAuthenticatedUser: true,
  hasInviteToken: false
};

test("the shipped native runtime gates authenticated incomplete users", () => {
  assert.equal(resolveNativeRootSurface({ ...ready, onboardingStatus: "incomplete" }), "onboarding");
  assert.equal(resolveNativeRootSurface({ ...ready, onboardingStatus: "complete" }), "tabs");
});
test("onboarding status failures fail closed with a retry surface", () => {
  assert.equal(resolveNativeRootSurface({ ...ready, onboardingStatus: "error" }), "onboarding-error");
  assert.equal(
    resolveNativeRootSurface({ ...ready, sessionStatus: "error", onboardingStatus: "complete" }),
    "session-error"
  );
});

test("invite acceptance intentionally runs before onboarding while auth and loading remain authoritative", () => {
  assert.equal(
    resolveNativeRootSurface({ ...ready, hasInviteToken: true, onboardingStatus: "incomplete" }),
    "invite"
  );
  assert.equal(
    resolveNativeRootSurface({
      ...ready,
      hasAuthenticatedUser: false,
      hasInviteToken: true,
      onboardingStatus: "incomplete"
    }),
    "auth"
  );
  assert.equal(
    resolveNativeRootSurface({ ...ready, sessionStatus: "loading", onboardingStatus: "complete" }),
    "loading"
  );
});
