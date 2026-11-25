import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Source contract: every sign-in surface renders social buttons only from the
// verified-provider list, so an unset NEXT_PUBLIC_KRUXT_VERIFIED_SOCIAL_PROVIDERS
// shows none. (Rendered checks live in the Playwright suites.)
const surfaces = {
  member: "../../../apps/web/src/components/auth/AuthGateway.tsx",
  "gym admin": "../../../apps/admin/src/app/(auth)/login/page.tsx",
  platform: "../../../apps/platform/src/app/(auth)/login/page.tsx",
};

for (const [name, relative] of Object.entries(surfaces)) {
  test(`${name} sign-in shows social buttons only for verified providers`, () => {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /verifiedSocialProviders\(process\.env\.NEXT_PUBLIC_KRUXT_VERIFIED_SOCIAL_PROVIDERS\)/);
    assert.match(source, /SOCIAL_PROVIDERS\.length > 0 &&/);
    assert.match(source, /SOCIAL_PROVIDERS\.map\(\(provider\)/);
    assert.doesNotMatch(source, /Continue with (Google|Apple)/);
    assert.doesNotMatch(source, /\(\s*"(google|apple)"\s*\)/, "no hard-coded provider click handlers");
  });
}
