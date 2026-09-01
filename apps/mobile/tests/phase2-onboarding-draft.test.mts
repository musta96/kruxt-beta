import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultOnboardingUiDraft } from "../src/flows/phase2-onboarding-draft.ts";

test("the real phase 2 draft factory defaults every consent decision to false", () => {
  const draft = createDefaultOnboardingUiDraft();

  assert.equal(draft.consents.acceptTerms, false);
  assert.equal(draft.consents.acceptPrivacy, false);
  assert.equal(draft.consents.acceptHealthData, false);
  assert.equal(draft.consents.marketingEmailOptIn, false);
  assert.equal(draft.consents.pushNotificationsOptIn, false);
});
test("the draft factory returns independent consent state", () => {
  const first = createDefaultOnboardingUiDraft();
  const second = createDefaultOnboardingUiDraft();

  first.consents.pushNotificationsOptIn = true;
  assert.equal(second.consents.pushNotificationsOptIn, false);
});
