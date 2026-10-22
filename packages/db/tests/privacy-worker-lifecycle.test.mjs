import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";

const user = "7e000000-0000-4000-8000-000000000001";
const requestId = "7e000000-0000-4000-8000-000000000002";
const jobId = "7e000000-0000-4000-8000-000000000003";
const job = { id: jobId, user_id: user, privacy_request_id: requestId, retry_count: 0 };
const packagePath = `${user}/${requestId}/${jobId}-1000.json`;
const source = readFileSync(new URL("../../../supabase/functions/privacy_request_processor/index.ts", import.meta.url), "utf8");
const parsed = ts.createSourceFile("privacy.ts", source, ts.ScriptTarget.ES2022, true);
const noImports = ts.factory.updateSourceFile(parsed, parsed.statements.filter(s => !ts.isImportDeclaration(s)));
const compiled = ts.transpileModule(ts.createPrinter().printFile(noImports), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const attestation = {
  PRIVACY_REVIEWED_INVENTORY_VERSION: "v1",
  PRIVACY_EXPORT_READY_INVENTORY_VERSION: "v1",
  PRIVACY_OPERATOR_REVIEWED_ERASURE_INVENTORY_VERSION: "v1"
};

function fixture(options = {}) {
  const calls = [];
  const files = new Map((options.files ?? []).map(path => [path, "fixture"]));
  const expired = options.expired ?? [];
  const upstream = new Error("https://secret.invalid/?token=must-not-leak");
  const client = {
    auth: { admin: { updateUserById: async (id, attributes) => {
      calls.push(["disable_account", id, attributes]);
      assert.equal(id, user);
      assert.deepEqual(attributes, { ban_duration: "876000h" });
      return {
        data: { user: { id: options.wrongDisabledUser ? jobId : id,
          banned_until: options.invalidBan ? "invalid" : options.expiredBan ? "2000-01-01T00:00:00Z" : "2126-01-01T00:00:00Z" } },
        error: options.disableFailure ? upstream : null
      };
    } } },
    from: table => {
      let action = "select";
      const q = {};
      for (const name of ["select", "eq", "lt", "not", "order", "limit"]) q[name] = () => q;
      q.update = () => { action = "update"; return q; };
      q.then = resolve => {
        calls.push([`${table}.${action}`]);
        return Promise.resolve(resolve({ data: action === "select" ? expired : null, error: null }));
      };
      return q;
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "process_privacy_request_queue") return { data: {}, error: options.triageFailure ? upstream : null };
      if (name === "has_active_legal_hold") return { data: options.hold ?? false, error: null };
      if (name === "claim_privacy_export_jobs") return { data: options.exportJobs ?? [], error: null };
      if (name === "claim_privacy_delete_jobs") return { data: options.deleteJobs ?? [], error: null };
      if (name === "build_privacy_export_payload") return { data: { profile: { id: user } }, error: null };
      if (name === "complete_privacy_export_job") return { data: {}, error: options.completeFailure ? upstream : null };
      if (name === "apply_user_anonymization") {
        assert.equal([...files.keys()].some(path => path.startsWith(`${user}/`)), false);
        return { data: { reviewed: true }, error: options.anonymizationFailure ? upstream : null };
      }
      if (name.startsWith("fail_")) return { data: { status: "retry_scheduled" }, error: null };
      return { data: 0, error: null };
    },
    storage: { from: bucket => {
      assert.equal(bucket, "privacy-exports");
      return {
        upload: async path => {
          calls.push(["upload", path]);
          if (options.uploadFailure) return { error: upstream };
          files.set(path, "new fixture");
          return { error: null };
        },
        createSignedUrl: async path => {
          calls.push(["sign", path]);
          return { data: { signedUrl: "https://local.test/storage/fixture" }, error: options.signFailure ? upstream : null };
        },
        remove: async paths => {
          calls.push(["remove", paths]);
          if (options.removeFailure) return { error: upstream };
          if (!options.partialRemove) for (const path of paths) files.delete(path);
          return { error: null };
        },
        list: async folder => {
          calls.push(["list", folder]);
          if (options.invalidList) return { data: [{ name: "../outside", id: null }], error: null };
          const entries = new Map();
          for (const path of files.keys()) {
            if (!path.startsWith(`${folder}/`)) continue;
            const tail = path.slice(folder.length + 1);
            const [name] = tail.split("/");
            entries.set(name, { name, id: tail.includes("/") ? null : "object-id" });
          }
          return { data: [...entries.values()], error: null };
        }
      };
    } }
  };
  let run;
  new Function("Deno", "z", "jsonResponse", "parseJsonOr", "requireWorkerAuth", "serviceClient", compiled)(
    { serve: callback => { run = callback; }, env: { get: name => options.env?.[name] } }, z,
    (body, status = 200) => new Response(JSON.stringify(body), { status }),
    request => request.json(), async () => null, () => client
  );
  return { calls, files, run: async () => run(new Request("https://local.test/privacy", { method: "POST", body: "{}" })) };
}

test("unreviewed or mismatched inventories leave fulfillment queues untouched", async () => {
  for (const env of [{}, { ...attestation, PRIVACY_REVIEWED_INVENTORY_VERSION: "v2" }]) {
    const f = fixture({ env, exportJobs: [job], deleteJobs: [job] });
    const body = await (await f.run()).json();
    assert.equal(body.exportProcessing.enabled, false);
    assert.equal(body.deleteProcessing.enabled, false);
    assert.deepEqual(f.calls.map(([name]) => name), ["process_privacy_request_queue"]);
  }
});

test("signing/completion failures remove only their just-uploaded artifact", async () => {
  for (const failure of ["signFailure", "completeFailure"]) {
    const unrelated = "other-user/unrelated.json";
    const f = fixture({ env: attestation, exportJobs: [job], [failure]: true, files: [unrelated] });
    const response = await f.run();
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.doesNotMatch(text, /must-not-leak|secret.invalid/);
    assert.deepEqual([...f.files.keys()], [unrelated]);
    assert.equal(f.calls.filter(([name]) => name === "remove").length, 1);
    assert.ok(f.calls.some(([name]) => name === "fail_privacy_export_job"));
  }
});

test("failed uploads do not attempt deletion and cleanup failures remain actionable", async () => {
  const upload = fixture({ env: attestation, exportJobs: [job], uploadFailure: true });
  await upload.run();
  assert.equal(upload.calls.some(([name]) => name === "remove"), false);
  const cleanup = fixture({ env: attestation, exportJobs: [job], signFailure: true, removeFailure: true });
  const body = await (await cleanup.run()).json();
  assert.equal(body.exportErrors[0].error, "export_cleanup_required");
  assert.equal(body.exportSucceededCount, 0);
});

test("an operator-attested export can complete after upload and signing", async () => {
  const f = fixture({ env: attestation, exportJobs: [job] });
  const body = await (await f.run()).json();
  assert.equal(body.exportSucceededCount, 1);
  const names = f.calls.map(([name]) => name);
  assert.ok(names.indexOf("upload") < names.indexOf("sign"));
  assert.ok(names.indexOf("sign") < names.indexOf("complete_privacy_export_job"));
});

test("legal holds and unknown hold state prevent storage/anonymization", async () => {
  for (const hold of [true, "unknown"]) {
    const f = fixture({ env: attestation, hold, deleteJobs: [job], files: [packagePath] });
    const body = await (await f.run()).json();
    assert.equal(body.deleteSucceededCount, 0);
    assert.equal(f.calls.some(([name]) => ["remove", "disable_account", "apply_user_anonymization", "complete_privacy_delete_job"].includes(name)), false);
  }
});

test("erasure cleans exact subject packages before anonymization and leaves other users alone", async () => {
  const other = "other-user/unrelated.json";
  const f = fixture({ env: attestation, deleteJobs: [job], files: [packagePath, other] });
  const body = await (await f.run()).json();
  assert.equal(body.deleteSucceededCount, 1);
  assert.deepEqual([...f.files.keys()], [other]);
  const names = f.calls.map(([name]) => name);
  assert.ok(names.indexOf("remove") < names.indexOf("apply_user_anonymization"));
  assert.ok(names.indexOf("remove") < names.indexOf("disable_account"));
  assert.ok(names.indexOf("disable_account") < names.indexOf("apply_user_anonymization"));
});

test("unconfirmed account disablement blocks anonymization and erasure completion", async () => {
  for (const option of ["disableFailure", "wrongDisabledUser", "invalidBan", "expiredBan"]) {
    const f = fixture({ env: attestation, deleteJobs: [job], [option]: true });
    const body = await (await f.run()).json();
    assert.equal(body.deleteSucceededCount, 0);
    assert.equal(body.deleteErrors[0].error, "account_disablement_failed");
    assert.equal(f.calls.some(([name]) => ["apply_user_anonymization", "complete_privacy_delete_job"].includes(name)), false);
    assert.doesNotMatch(JSON.stringify(body), /secret.invalid|must-not-leak/);
  }
});

test("anonymization failure does not reverse account disablement or claim completion", async () => {
  const f = fixture({ env: attestation, deleteJobs: [job], anonymizationFailure: true });
  const body = await (await f.run()).json();
  assert.equal(body.deleteSucceededCount, 0);
  assert.equal(body.deleteErrors[0].error, "anonymization_failed");
  assert.equal(f.calls.filter(([name]) => name === "disable_account").length, 1);
  assert.equal(f.calls.some(([name]) => name === "complete_privacy_delete_job"), false);
});

test("failed/partial removal or suspicious paths cannot produce erasure completion", async () => {
  for (const option of ["removeFailure", "partialRemove", "invalidList"]) {
    const f = fixture({ env: attestation, deleteJobs: [job], files: [packagePath], [option]: true });
    const body = await (await f.run()).json();
    assert.equal(body.deleteSucceededCount, 0);
    assert.equal(f.calls.some(([name]) => name === "apply_user_anonymization"), false);
    assert.equal(f.calls.some(([name]) => name === "complete_privacy_delete_job"), false);
  }
});

test("expired packages are removed with a durable checkpoint; foreign paths fail closed", async () => {
  const expiredJob = { ...job, storage_bucket: "privacy-exports", storage_path: packagePath };
  const f = fixture({ env: attestation, expired: [expiredJob], files: [packagePath] });
  const body = await (await f.run()).json();
  assert.equal(body.expiredExportPackagesRemoved, 1);
  assert.equal(f.files.size, 0);
  assert.ok(f.calls.some(([name]) => name === "privacy_export_jobs.update"));
  const invalid = fixture({ env: attestation, expired: [{ ...expiredJob, storage_path: "outside/secret.json" }] });
  assert.equal((await invalid.run()).status, 500);
  assert.equal(invalid.calls.some(([name]) => name === "remove"), false);
});

test("worker-level upstream failures return only a generic error", async () => {
  const f = fixture({ triageFailure: true });
  const response = await f.run();
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /must-not-leak|secret.invalid/);
});
