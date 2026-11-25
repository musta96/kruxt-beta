import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { memberSignInPath, normalizeMemberReturn } from "../src/lib/auth/member-return.ts";

const templateId = "11111111-2222-4333-8444-555555555555";
const planId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("only the explicit member routes are allowed, with a canonical trailing slash", () => {
  for (const path of ["/plan", "/feed", "/log", "/gyms", "/profile", "/privacy", "/support",
    "/integrations", "/library", "/guild", "/rank"]) {
    assert.equal(normalizeMemberReturn(path), path);
    assert.equal(normalizeMemberReturn(`${path}/?token=secret&returnTo=https://evil.test`), path);
  }
  for (const path of ["/", "/unknown", "/admin", "/admin/users", "/operator", "/org", "/org/classes",
    "/auth", "/login", "/join", "/accept-invite", "/activate-invite", "/Plan", "/log/child"]) {
    assert.equal(normalizeMemberReturn(path), null, path);
  }
});

test("gym classes use the actual dynamic route and a canonical UUID", () => {
  assert.ok(existsSync(new URL("../app/gyms/[gymId]/classes/page.tsx", import.meta.url)));
  assert.equal(normalizeMemberReturn(`/gyms/${planId.toUpperCase()}/classes?email=private`), `/gyms/${planId}/classes`);
  for (const path of ["/gyms/nope/classes", `/gyms/${planId}`, `/gyms/${planId}/classes/other`,
    `/gyms/{${planId}}/classes`, `/gyms/${planId.replaceAll("-", "")}/classes`]) {
    assert.equal(normalizeMemberReturn(path), null);
  }
});

test("external, normalized, encoded and injected paths fail closed", () => {
  for (const value of [undefined, null, 1, {}, [], new String("/log"), "", " /log", "/log ",
    "https://evil.test/log", "https://app.test/log", "//evil.test/log", "///log", "javascript:alert(1)",
    "\\evil.test\\log", "/\\evil.test", "/log\\", "/log#", "/log#member-login", "/log?x=1#fragment",
    "/%6cog", "%2Flog", "/log%2f", "/gyms/%2e%2e/log", "/plan/../log", "/./log", "/log//",
    "/%252flog", "/log;anything", "/log\n", "/log\r", "/log\t", "/log\0", "/log\u007f",
    "/log?x=%0aevil", "/log?x=%5cevil", "/log?x=%00", "/log?x=%C2%85", "/log?x=%", "/log?x=%ff"]) {
    assert.equal(normalizeMemberReturn(value), null, String(value));
    assert.equal(memberSignInPath(value), "/#member-login");
  }
});

test("only log identifiers survive, in deterministic order", () => {
  const canonical = `/log?planId=${planId}&dayId=0_day-A`;
  const value = `/log?dayId=0_day-A&session=private&token=secret&email=a%40b.test&reason=private&workout=payload&redirect=https://evil.test&planId=${planId.toUpperCase()}`;
  assert.equal(normalizeMemberReturn(value), canonical);
  assert.equal(normalizeMemberReturn(`/log?dayId=day-a&templateId=${templateId}`), `/log?templateId=${templateId}&dayId=day-a`);
  assert.equal(normalizeMemberReturn(`/log?%70lanId=${planId}&dayId=%64ay-a`), `/log?planId=${planId}&dayId=day-a`);
  assert.equal(normalizeMemberReturn("/log?token=secret&token=other&returnTo=%2Fadmin"), "/log");
  for (const value of ["/log", `/log?planId=${planId}`, `/log?templateId=${templateId}`, "/log?dayId=day-a"]) {
    assert.equal(normalizeMemberReturn(value), value);
  }
  assert.equal(memberSignInPath(value), `/?returnTo=${encodeURIComponent(canonical)}#member-login`);
});

test("duplicate or conflicting allowed keys and malformed identifiers reject the whole destination", () => {
  for (const query of [
    `planId=${planId}&planId=${planId}`, `templateId=${templateId}&templateId=${templateId}`,
    `planId=${planId}&%70lanId=${planId}`, `planId=${planId}&templateId=${templateId}`,
    "dayId=a&dayId=a", "dayId=a&%64ayId=b", "planId=", "templateId=", "planId=invalid",
    `planId=${planId}%20`, `templateId=${templateId}extra`, "dayId=", "dayId=day+one", "dayId=day%20one",
    "dayId=../log", "dayId=%252Flog", "dayId=a%26token%3Dsecret", "dayId=a%23fragment", "dayId=%E2%98%83",
    `dayId=${"a".repeat(201)}`
  ]) assert.equal(normalizeMemberReturn(`/log?${query}`), null, query);
});

test("input and day identifier bounds are inclusive and normalization is idempotent", () => {
  const atLimit = `/feed?x=${"a".repeat(2048 - "/feed?x=".length)}`;
  assert.equal(normalizeMemberReturn(atLimit), "/feed");
  assert.equal(normalizeMemberReturn(`${atLimit}a`), null);
  const maxDay = `/log?planId=${planId}&dayId=${"a".repeat(200)}`;
  assert.equal(normalizeMemberReturn(maxDay), maxDay);
  for (const value of ["/feed/?anything=gone", `/gyms/${planId.toUpperCase()}/classes/`, maxDay,
    `/log?dayId=day-a&planId=${planId.toUpperCase()}&session=removed`]) {
    const normalized = normalizeMemberReturn(value);
    assert.notEqual(normalized, null);
    assert.equal(normalizeMemberReturn(normalized), normalized);
    const signIn = new URL(memberSignInPath(value), "https://member.test");
    assert.equal(signIn.pathname, "/");
    assert.equal(signIn.hash, "#member-login");
    assert.deepEqual([...signIn.searchParams], [["returnTo", normalized]]);
  }
});
