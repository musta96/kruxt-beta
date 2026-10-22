import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";

const root = new URL("../../../supabase/functions/", import.meta.url);
const secret = "local-test-only-machine-credential-not-a-real-key";
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });

function compiled(relativePath) {
  const source = readFileSync(new URL(relativePath, root), "utf8");
  const parsed = ts.createSourceFile(relativePath, source, ts.ScriptTarget.ES2022, true);
  const noImports = ts.factory.updateSourceFile(parsed,
    parsed.statements.filter(statement => !ts.isImportDeclaration(statement)));
  return ts.transpileModule(ts.createPrinter().printFile(noImports), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}

function authGuard(key = secret) {
  const exports = {};
  new Function("Deno", "jsonResponse", "exports", compiled("_shared/worker-auth.ts"))(
    { env: { get: name => name === "SUPABASE_SERVICE_ROLE_KEY" ? key : undefined } }, jsonResponse, exports);
  return exports.requireWorkerAuth;
}

function handler(name, { key = secret, client } = {}) {
  let callback;
  let clientsCreated = 0;
  const scope = {
    Deno: { serve: next => { callback = next; }, env: { get: () => undefined } },
    z, jsonResponse, requireWorkerAuth: authGuard(key),
    requireAuth: async () => ({ userId: "local-member", claims: { role: "authenticated" } }),
    isAuthResult: value => !(value instanceof Response),
    serviceClient: () => { clientsCreated++; return client ?? assert.fail("Unexpected service client"); },
    parseJson: request => request.json(), parseJsonOr: request => request.json(),
    safeErrorResponse: () => jsonResponse({ error: "Test operation failed" }, 500),
    INTEGRATION_PROVIDERS: ["apple_health", "garmin"], exports: {}
  };
  new Function(...Object.keys(scope), compiled(`${name}/index.ts`))(...Object.values(scope));
  return { run: callback, clientsCreated: () => clientsCreated };
}
function request(token, body = {}) {
  return new Request("https://local.test/worker", {
    method: "POST", headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
}

test("machine authentication accepts only the configured secret, not JWT-shaped claims", async () => {
  const guard = authGuard();
  assert.equal(await guard(request(secret)), null);
  for (const token of ["member-jwt", "anon-key", "", `${secret.slice(0, -1)}x`,
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.forged`]) {
    assert.equal((await guard(request(token))).status, token === "" ? 401 : 403);
  }
  assert.equal((await guard(request())).status, 401);
  assert.equal((await authGuard("")(request(secret))).status, 503);
});

for (const name of ["privacy_request_processor", "provider_webhook_ingest", "sync_dispatcher",
  "rank_recompute_weekly", "audit_event_ingest", "incident_notifier"]) {
  test(`${name}: members and anonymous callers cannot construct a privileged client`, async () => {
    for (const token of [undefined, "ordinary-member-token", `${secret.slice(0, -1)}x`]) {
      const worker = handler(name);
      const response = await worker.run(request(token, { actorRole: "founder", forceDrill: true }));
      assert.equal(response.status, token === undefined ? 401 : 403);
      assert.equal(worker.clientsCreated(), 0);
    }
    const unconfigured = handler(name, { key: "" });
    assert.equal((await unconfigured.run(request(secret))).status, 503);
    assert.equal(unconfigured.clientsCreated(), 0);
  });
}

test("authorized incident force-drill refuses before claiming any shared jobs", async () => {
  const worker = handler("incident_notifier");
  assert.equal((await worker.run(request(secret, { forceDrill: true }))).status, 400);
  assert.equal(worker.clientsCreated(), 0);
});

test("undelivered live notifications fail; explicit drill jobs can complete", async () => {
  for (const mode of ["live", "drill"]) {
    const calls = [];
    const worker = handler("incident_notifier", { client: { rpc: async (name, args) => {
      calls.push(name);
      if (name === "claim_incident_notification_jobs") return { data: [{
        id: "local-job", incident_id: "local-incident", channel: "email", destination: "test@example.test",
        delivery_mode: mode, payload: {}, template_key: "fixture", attempt_count: 1
      }], error: null };
      if (name === "fail_incident_notification_job") return { data: { status: "retry_scheduled" }, error: null };
      if (name === "complete_incident_notification_job") {
        assert.equal(mode, "drill");
        assert.equal(args.p_response_payload.delivered, false);
        return { data: {}, error: null };
      }
      assert.fail(`Unexpected RPC ${name}`);
    } } });
    const response = await worker.run(request(secret));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.succeededCount, mode === "drill" ? 1 : 0);
    assert.equal(calls.includes("complete_incident_notification_job"), mode === "drill");
    assert.equal(calls.includes("fail_incident_notification_job"), mode === "live");
  }
});
