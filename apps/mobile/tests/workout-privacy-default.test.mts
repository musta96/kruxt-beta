import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDraft, updateMetadata } from "../src/workout-logger/draft-utils.ts";

test("new workout drafts are private until a user explicitly chooses sharing", () => {
  const draft = createEmptyDraft();
  assert.equal(draft.metadata.visibility, "private");
  const shared = updateMetadata(draft, { visibility: "public" });
  assert.equal(shared.metadata.visibility, "public");
  assert.equal(draft.metadata.visibility, "private");
});
