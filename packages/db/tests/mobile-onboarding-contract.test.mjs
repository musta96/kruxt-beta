import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootMigrationUrl = new URL(
  "../../../supabase/migrations/202608030005_mobile_onboarding_contract.sql",
  import.meta.url
);
const packageMigrationUrl = new URL(
  "../supabase/migrations/202608030005_mobile_onboarding_contract.sql",
  import.meta.url
);

const [rootSql, packageSql] = await Promise.all([
  readFile(rootMigrationUrl, "utf8"),
  readFile(packageMigrationUrl, "utf8")
]);

test("mobile onboarding migration copies remain identical", () => {
  assert.equal(packageSql, rootSql);
});
test("consent capture is one authenticated locked contract with strict reviewed policy ids", () => {
  assert.match(rootSql, /create or replace function public\.capture_mobile_onboarding_consents\(/i);
  assert.match(rootSql, /p_terms_policy_version_id uuid,\s+p_privacy_policy_version_id uuid,\s+p_health_data_policy_version_id uuid,/i);
  assert.match(rootSql, /lock table public\.policy_version_tracking in share mode;/i);
  assert.match(rootSql, /p_terms_policy_version_id <> v_terms_policy_id/i);
  assert.match(rootSql, /p_privacy_policy_version_id <> v_privacy_policy_id/i);
  assert.match(rootSql, /p_health_data_policy_version_id <> v_health_data_policy_id/i);
  assert.match(rootSql, /public\.policy_version_has_content_binding\(v_terms_policy_id, v_now\)/i);
  assert.match(rootSql, /\(sha256:\)\?\[0-9a-f\]\{64\}/i);
  assert.equal((rootSql.match(/public\.record_user_consent\(/g) ?? []).length, 5);
  assert.match(rootSql, /p_push_notifications_opt_in boolean default false/i);
  assert.match(rootSql, /coalesce\(p_push_notifications_opt_in, false\)/i);
  assert.doesNotMatch(rootSql, /p_evidence\s+jsonb/i);
  assert.doesNotMatch(rootSql, /user_metadata|raw_user_meta_data/i);
});

test("completion is server controlled and revalidates profile plus current required consents", () => {
  assert.match(rootSql, /mobile_onboarding_completed_at timestamptz/i);
  assert.match(rootSql, /create trigger trg_profiles_protect_mobile_onboarding_completion/i);
  assert.match(rootSql, /current_user not in \('postgres', 'service_role', 'supabase_admin'\)/i);
  assert.match(rootSql, /public\.mobile_user_has_bound_required_consents\(v_target_user\)/i);
  assert.match(rootSql, /v_profile\.username ~ '\^\[a-z0-9_\]\{3,24\}\$'/i);
  assert.match(rootSql, /update public\.profiles p\s+set mobile_onboarding_completed_at = now\(\)/i);
  assert.match(rootSql, /update public\.profiles\s+set mobile_onboarding_completed_at = coalesce/i);
  assert.match(rootSql, /revoke all on function public\.complete_mobile_onboarding\(uuid\) from public/i);
  assert.match(rootSql, /grant execute on function public\.complete_mobile_onboarding\(uuid\) to authenticated, service_role/i);
});
