import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";

const ids = {
  gym: "7b000000-0000-4000-8000-000000000001",
  actor: "7b000000-0000-4000-8000-000000000002",
  owner: "7b000000-0000-4000-8000-000000000003",
  invite: "7b000000-0000-4000-8000-000000000004",
  recipient: "7b000000-0000-4000-8000-000000000005",
  membership: "7b000000-0000-4000-8000-000000000006",
};
const email = "recipient@example.test";
const inviteToken = "test-invite-token-at-least-16-characters";
const actionLink = "https://auth.example.test/verify?token=recipient-login-credential&type=magiclink";
const outputs = new Map(["send-invite", "accept-invite", "create-profile-invite"].map((name) => {
  const source = readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), "utf8");
  const parsed = ts.createSourceFile(`${name}.ts`, source, ts.ScriptTarget.ES2022, true);
  const withoutImports = ts.factory.updateSourceFile(parsed,
    parsed.statements.filter((statement) => !ts.isImportDeclaration(statement)));
  const { outputText } = ts.transpileModule(ts.createPrinter().printFile(withoutImports), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return [name, outputText];
}));

function fixture({ role = "leader", founder = false, owner = false, operatorRole, issuer = ids.actor } = {}) {
  return {
    gyms: [{ id: ids.gym, owner_user_id: owner ? ids.actor : ids.owner, name: "Test Gym" }],
    gym_memberships: [{ id: ids.membership, gym_id: ids.gym, user_id: ids.actor, role, membership_status: "active" }],
    platform_operator_accounts: founder || operatorRole
      ? [{ user_id: ids.actor, role: operatorRole ?? "founder", is_active: true }] : [],
    gym_staff_invites: [{ id: ids.invite, gym_id: ids.gym, invited_by: issuer, email, role: "leader",
      token_hash: createHash("sha256").update(inviteToken).digest("hex"),
      status: "pending", expires_at: "2099-01-01T00:00:00Z", revoked_at: null }],
    gym_profile_invitations: [{ id: ids.invite, gym_id: ids.gym, email, requested_role: "member",
      display_name: "Recipient", invited_user_id: ids.recipient, status: "pending_activation", invite_attempt: 1 }],
    profiles: [], audit_logs: [],
  };
}

function harness(name, rows, { auth = { userId: ids.actor }, emailMode = "sent", readError } = {}) {
  const writes = [], reads = [], links = [], emails = [];
  // Execute real handlers against a filter-aware in-memory transport; no network or database access.
  const client = {
    from(table) {
      const filters = [];
      let operation = "read", values;
      const query = {
        select() { return this; }, order() { return this; }, limit() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        insert(value) { operation = "insert"; values = value; return this; },
        update(value) { operation = "update"; values = value; return this; },
        upsert(value) { operation = "upsert"; values = value; return this; },
        maybeSingle() { return execute(true); }, single() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      async function execute(single) {
        assert.ok(Object.hasOwn(rows, table), `Unexpected table: ${table}`);
        const matches = rows[table].filter((row) => filters.every((filter) => filter(row)));
        if (operation === "read") {
          reads.push(table);
          if (readError === table) return { data: null, error: new Error("Read failed") };
          return { data: single ? matches[0] ?? null : matches, error: null };
        }
        writes.push({ table, operation, values: structuredClone(values) });
        const result = operation === "update" ? matches : [{ id: ids.invite, ...values }];
        if (operation === "update") matches.forEach((row) => Object.assign(row, values));
        else rows[table].push(...result);
        return { data: single ? result[0] ?? null : result, error: null };
      }
      return query;
    },
    auth: { admin: {
      getUserById: async () => ({ data: { user: { email } }, error: null }),
      generateLink: async (args) => {
        links.push(args);
        return { data: { user: { id: ids.recipient }, properties: { action_link: actionLink } }, error: null };
      },
    } },
  };
  let handler;
  new Function("Deno", "z", "parseJsonOr", "requireAuth", "isAuthResult", "serviceClient", "safeErrorResponse", "crypto", "fetch", "exports", outputs.get(name))(
    { serve: (next) => { handler = next; }, env: { get: (key) => emailMode === "unconfigured" ? undefined : ({
      RESEND_API_KEY: "mock-only", INVITE_EMAIL_FROM: "test@example.test",
    })[key] } }, z, async (request) => request.json(), async () => auth,
    (value) => !(value instanceof Response), () => client,
    () => new Response(JSON.stringify({ error: "Request failed" }), { status: 500 }), webcrypto,
    async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      emails.push(JSON.parse(options.body));
      if (emailMode === "throw") throw new Error(actionLink);
      return new Response(emailMode === "failed" ? actionLink : "{}", { status: emailMode === "failed" ? 500 : 200 });
    }, {},
  );
  return { handler, writes, reads, links, emails };
}

const request = (body) => new Request("https://example.test/invite", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
});
const sendPayload = { gymId: ids.gym, email, role: "leader", inviteId: ids.invite };
const profilePayload = { gymId: ids.gym, email, fullName: "Recipient", role: "member", inviteId: ids.invite };
const acceptPayload = { token: inviteToken };

test("ordinary staff cannot send, resend, or revoke any staff invitation before writes", async () => {
  for (const role of ["coach", "officer", "member"]) {
    for (const action of ["send", "resend", "revoke"]) {
      const h = harness("send-invite", fixture({ role }));
      assert.equal((await h.handler(request({ ...sendPayload, action }))).status, 403, `${role}/${action}`);
      assert.deepEqual(h.writes, []);
      assert.deepEqual(h.emails, []);
    }
  }
});

test("owners, active leaders, and active founders can issue staff invitations", async () => {
  for (const permission of [{ owner: true, role: "member" }, { role: "leader" }, { founder: true, role: "member" }]) {
    const h = harness("send-invite", fixture(permission));
    assert.equal((await h.handler(request(sendPayload))).status, 200);
    assert.ok(h.writes.some((write) => write.table === "gym_staff_invites"));
  }
});

test("owner resend replaces a legacy issuer and rotates its token", async () => {
  const rows = fixture({ owner: true });
  rows.gym_staff_invites[0].invited_by = ids.recipient;
  const previousHash = rows.gym_staff_invites[0].token_hash;
  const h = harness("send-invite", rows);
  assert.equal((await h.handler(request({ ...sendPayload, action: "resend" }))).status, 200);
  assert.equal(rows.gym_staff_invites[0].invited_by, ids.actor);
  assert.notEqual(rows.gym_staff_invites[0].token_hash, previousHash);
});

test("legacy tokens from coaches/officers or missing issuers cannot elevate recipients", async () => {
  for (const role of ["coach", "officer", "member"]) {
    for (const invitedRole of ["leader", "officer", "coach"]) {
      const rows = fixture({ role });
      rows.gym_staff_invites[0].role = invitedRole;
      const h = harness("accept-invite", rows);
      assert.equal((await h.handler(request(acceptPayload))).status, 403);
      assert.deepEqual(h.writes, []);
    }
  }
  const h = harness("accept-invite", fixture({ issuer: null }));
  assert.equal((await h.handler(request(acceptPayload))).status, 403);
  assert.deepEqual(h.writes, []);
});

test("acceptance allows current authorized issuers but rejects removed or inactive authority", async () => {
  for (const permission of [{ owner: true, role: "member" }, { role: "leader" }, { founder: true, role: "member" }]) {
    const h = harness("accept-invite", fixture(permission), { auth: { userId: ids.recipient } });
    assert.equal((await h.handler(request(acceptPayload))).status, 200);
    const membership = h.writes.find((write) => write.table === "gym_memberships");
    assert.equal(membership.values.user_id, ids.recipient);
    assert.equal(membership.values.role, "leader");
  }
  for (const variant of ["cancelled-leader", "inactive-founder", "other-gym-leader"]) {
    const rows = fixture({ founder: variant === "inactive-founder", role: variant === "inactive-founder" ? "member" : "leader" });
    if (variant === "cancelled-leader") rows.gym_memberships[0].membership_status = "cancelled";
    if (variant === "inactive-founder") rows.platform_operator_accounts[0].is_active = false;
    if (variant === "other-gym-leader") rows.gym_memberships[0].gym_id = ids.owner;
    const h = harness("accept-invite", rows);
    assert.equal((await h.handler(request(acceptPayload))).status, 403, variant);
    assert.deepEqual(h.writes, []);
  }
});

test("staff and non-founder operators cannot create, resend, or disable profile invites", async () => {
  for (const permission of [{ role: "coach" }, { role: "officer" }, { role: "member" }, { role: "member", operatorRole: "support" }]) {
    for (const action of ["create", "resend", "disable"]) {
      const h = harness("create-profile-invite", fixture(permission));
      assert.equal((await h.handler(request({ ...profilePayload, action }))).status, 403);
      assert.deepEqual(h.writes, []);
      assert.deepEqual(h.links, []);
      assert.deepEqual(h.emails, []);
    }
  }
});

test("profile create/resend deliver recipient links only by email, never in responses", async () => {
  for (const action of ["create", "resend"]) {
    for (const emailMode of ["sent", "failed", "throw", "unconfigured"]) {
      const h = harness("create-profile-invite", fixture({ owner: true }), { emailMode });
      const response = await h.handler(request({ ...profilePayload, action }));
      assert.equal(response.status, 200, `${action}/${emailMode}`);
      const text = await response.text();
      assert.ok(!text.includes(actionLink));
      assert.ok(!text.includes("recipient-login-credential"));
      const body = JSON.parse(text);
      assert.equal(body.inviteUrl, undefined);
      assert.equal(body.action_link, undefined);
      assert.equal(body.emailDelivery, emailMode === "sent" ? "sent" : "failed");
      assert.equal(h.links[0].type, action === "create" ? "invite" : "magiclink");
      assert.equal(h.links[0].email, email);
      assert.equal(h.emails.length, emailMode === "unconfigured" ? 0 : 1);
      if (h.emails.length) {
        assert.deepEqual(h.emails[0].to, [email]);
        assert.ok(h.emails[0].text.includes(actionLink));
      }
    }
  }
});

test("profile owner-role invitations require an active founder", async () => {
  const owner = harness("create-profile-invite", fixture({ owner: true }));
  assert.equal((await owner.handler(request({ ...profilePayload, role: "owner" }))).status, 403);
  assert.deepEqual(owner.writes, []);
  assert.deepEqual(owner.links, []);
  const founder = harness("create-profile-invite", fixture({ founder: true, role: "member" }));
  const response = await founder.handler(request({ ...profilePayload, role: "owner" }));
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes("recipient-login-credential"));
  assert.equal(founder.emails.length, 1);
});

test("authorization read failures fail closed before invite writes", async () => {
  for (const name of ["send-invite", "accept-invite"]) {
    const h = harness(name, fixture(), { readError: "gym_memberships" });
    assert.equal((await h.handler(request(name === "send-invite" ? sendPayload : acceptPayload))).status, 500);
    assert.deepEqual(h.writes, []);
  }
});

test("unauthenticated invitation requests cannot reach service storage", async () => {
  for (const name of outputs.keys()) {
    const h = harness(name, fixture(), { auth: new Response("Unauthorized", { status: 401 }) });
    assert.equal((await h.handler(request(profilePayload))).status, 401);
    assert.deepEqual(h.reads, []);
    assert.deepEqual(h.writes, []);
  }
});
