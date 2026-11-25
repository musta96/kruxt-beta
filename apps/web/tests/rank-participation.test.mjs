import assert from "node:assert/strict";
import { test } from "node:test";
import { joinChallenge, leaveChallenge } from "../src/lib/public/rank.ts";

test("leave only succeeds for the server's explicit removal acknowledgment", async () => {
  for (const data of [false, null, undefined, "true", 1, {}, []]) {
    const client = { rpc: async () => ({ data, error: null }) };
    await assert.rejects(leaveChallenge(client, "challenge-1"), /entry was not removed/);
  }
  const calls = [];
  const client = { rpc: async (...args) => { calls.push(args); return { data: true, error: null }; } };
  await leaveChallenge(client, "challenge-1");
  assert.deepEqual(calls, [["leave_challenge", { p_challenge_id: "challenge-1" }]]);
});

test("participation preserves RPC authorization/errors and never directly writes scores", async () => {
  for (const action of [joinChallenge, leaveChallenge]) {
    await assert.rejects(action({ rpc: async () => ({ data: null, error: { message: "Not authorized" } }) }, "private"), /Not authorized/);
    await assert.rejects(action({ rpc: async () => { throw new Error("Offline"); } }, "private"), /Offline/);
  }
  const calls = [];
  await joinChallenge({ rpc: async (...args) => { calls.push(args); return { data: "participant-id", error: null }; } }, "challenge-1");
  assert.deepEqual(calls, [["join_challenge", { p_challenge_id: "challenge-1" }]]);
});
