import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [packageJsonText, indexSource, appSource, nativeAppSource] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../index.js", import.meta.url), "utf8"),
  readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/native/NativeApp.tsx", import.meta.url), "utf8")
]);

test("the shipped entrypoint reaches the gated NativeApp runtime", () => {
  assert.equal(JSON.parse(packageJsonText).main, "index.js");
  assert.match(indexSource, /import App from "\.\/App"/);
  assert.match(indexSource, /registerRootComponent\(App\)/);
  assert.match(appSource, /import \{ NativeApp \} from "\.\/src\/native\/NativeApp"/);
  assert.match(appSource, /<NativeApp \/>/);
  assert.match(nativeAppSource, /resolveNativeRootSurface/);
  assert.match(nativeAppSource, /surface === "onboarding"/);
  assert.match(nativeAppSource, /<OnboardingScreen \/>/);
  assert.match(nativeAppSource, /await signOut\(\)/);
});
test("the gated NativeApp preserves invite handling and all established tabs", () => {
  assert.match(nativeAppSource, /surface === "invite"/);
  assert.match(nativeAppSource, /<AcceptInviteScreen/);
  for (const tab of ["Feed", "Gyms", "Log", "Work", "Profile"]) {
    assert.match(nativeAppSource, new RegExp(`Tabs\\.Screen name="${tab}"`));
  }
});
