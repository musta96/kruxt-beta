import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dbRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(dbRoot, "../..");
const migrationPath = resolve(dbRoot, "supabase/migrations/202608030004_consent_activation_hardening.sql");
const oldMigrationPath = resolve(dbRoot, "supabase/migrations/202608030002_consent_activation_hardening.sql");
const seedPath = resolve(dbRoot, "supabase/seeds/001_feature_flags.sql");

const migration = readFileSync(migrationPath, "utf8");
const seed = readFileSync(seedPath, "utf8");
const access = readFileSync(resolve(repoRoot, "apps/web/src/lib/auth/access.ts"), "utf8");
const adminShell = readFileSync(resolve(repoRoot, "apps/web/src/components/admin/AdminShell.tsx"), "utf8");
const consentService = readFileSync(resolve(repoRoot, "apps/web/src/lib/auth/required-consents.ts"), "utf8");

test("uses the integration-safe migration number", () => {
  assert.equal(existsSync(oldMigrationPath), false);
  assert.equal(existsSync(migrationPath), true);
});

test("workout creation is guarded at the table boundary", () => {
  assert.match(migration, /create trigger trg_workouts_require_consents\s+before insert on public\.workouts/i);
  assert.match(migration, /if public\.is_service_role\(\) then\s+return new;/i);
  assert.match(migration, /if not public\.user_has_required_consents\(new\.user_id\) then/i);
});

test("consent and activation writes are restricted to hardened contracts", () => {
  assert.match(migration, /revoke insert on table public\.consents from authenticated/i);
  assert.match(migration, /create trigger trg_profiles_protect_security_fields\s+before insert or update/i);
  assert.match(migration, /Profile activation fields are system-managed/i);
  assert.match(migration, /create or replace function public\.ensure_self_profile/i);
  assert.match(migration, /on conflict do nothing/i);
});

test("policies fail closed without HTTPS content binding and evidence is server-stamped", () => {
  assert.match(migration, /document_url ~\* '\^https:\/\//i);
  assert.match(migration, /\(sha256:\)\?\[0-9a-f\]\{64\}/i);
  assert.match(migration, /'policy_checksum', v_policy\.checksum/i);
  assert.match(migration, /'target_user_id', v_target_user/i);
  assert.match(migration, /case when v_is_service then coalesce\(p_evidence/);
  assert.match(consentService, /url\.protocol === "https:"/);
  assert.match(consentService, /isSha256Binding/);
  assert.doesNotMatch(consentService, /p_user_agent:/);
  assert.doesNotMatch(consentService, /p_evidence:/);
});

test("fresh seed keeps provisional legal rows inactive and unbound", () => {
  assert.match(seed, /Issue #115 must publish approved, checksummed versions/);
  assert.match(seed, /document_url,\s+checksum,\s+effective_at,\s+is_active/s);
  assert.equal((seed.match(/null, now\(\), false, true, 'Provisional seed only; not approved for clickwrap'/g) ?? []).length, 3);
  assert.doesNotMatch(seed, /null, now\(\), true, true, 'Initial baseline policy'/);
});

test("web access resolution and backoffice shell gate failures, activation, and consent", () => {
  assert.match(access, /platformResult\.error \?\? membershipsResult\.error \?\? profileResult\.error \?\? consentResult\.error/);
  assert.match(access, /if \(!profileResult\.data\)/);
  assert.doesNotMatch(access, /\?\? "active"/);
  assert.match(access, /status: "error"/);
  assert.match(access, /"consent_required"/);
  assert.match(adminShell, /access\.status === "activation_required" \|\| access\.status === "disabled"/);
  assert.match(adminShell, /access\.status === "consent_required"/);
});
