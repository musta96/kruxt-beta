import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../../../supabase/functions/complete-profile-activation/index.ts", import.meta.url), "utf8");
const parsed = ts.createSourceFile("activation.ts", source, ts.ScriptTarget.ES2022, true);
const withoutImports = ts.factory.updateSourceFile(parsed,
  parsed.statements.filter((statement) => !ts.isImportDeclaration(statement)));
const { outputText } = ts.transpileModule(ts.createPrinter().printFile(withoutImports), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
function activationHandler({ rpc, auth = { userId: "authenticated-user" } }) {
  let handler;
  // Run the real handler with transport/auth dependencies supplied by the test.
  new Function("Deno", "z", "parseJsonOr", "requireAuth", "isAuthResult", "serviceClient", "safeErrorResponse", "exports", outputText)(
    { serve: (next) => { handler = next; } }, z,
    async (request) => request.json(), async () => auth,
    (value) => !(value instanceof Response), () => ({ rpc }),
    () => new Response(JSON.stringify({ error: "Activation failed" }), { status: 500 }), {}
  );
  return handler;
}
const payload = {
  inviteId: "7b000000-0000-4000-8000-000000000020", attempt: 1, acceptedOwnerTerms: true,
  userId: "forged-user"
};
const request = (body = payload) => new Request("https://example.test/activate", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" }
});
test("activation handler uses one atomic RPC and binds it to the authenticated user", async () => {
  let calls = 0;
  const handler = activationHandler({ rpc: async (name, args) => {
    calls++;
    assert.equal(name, "complete_profile_activation_atomic");
    assert.equal(args.p_user_id, "authenticated-user");
    assert.equal(args.p_invite_id, payload.inviteId);
    assert.equal(args.p_attempt, 1);
    return { data: { ok: true, status: "active", gymId: "gym-1" }, error: null };
  } });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).gymId, "gym-1");
  assert.equal(calls, 1);
});
test("activation handler maps rejected transaction results and database failures", async () => {
  for (const [status, expected] of [["disabled",409], ["expired",410], ["forbidden",403], ["stale_attempt",409]]) {
    const handler = activationHandler({ rpc: async () => ({ data: { ok: false, status, error: status }, error: null }) });
    assert.equal((await handler(request())).status, expected);
  }
  const handler = activationHandler({ rpc: async () => ({ data: null, error: new Error("database failure") }) });
  assert.equal((await handler(request())).status, 500);
});
test("unauthenticated and invalid activation requests cannot reach the service RPC", async () => {
  let calls = 0;
  const rpc = async () => { calls++; throw new Error("Unexpected RPC"); };
  const invalid = activationHandler({ rpc });
  assert.equal((await invalid(request({ ...payload, attempt: 0 }))).status, 400);
  const anonymous = activationHandler({ rpc, auth: new Response("Unauthorized", { status: 401 }) });
  assert.equal((await anonymous(request())).status, 401);
  assert.equal(calls, 0);
});
