import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentRecord, PolicyVersion, UpsertConsentInput } from "@kruxt/types";

import { throwIfError } from "./errors";

type PolicyRow = {
  id: string;
  policy_type: PolicyVersion["policyType"];
  version: string;
  label: string | null;
  document_url: string;
  effective_at: string;
  is_active: boolean;
};

type ConsentRow = {
  id: string;
  user_id: string;
  consent_type: ConsentRecord["consentType"];
  policy_version_id: string | null;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  source: string;
  locale: string | null;
};

function mapPolicy(row: PolicyRow): PolicyVersion {
  return {
    id: row.id,
    policyType: row.policy_type,
    version: row.version,
    label: row.label,
    documentUrl: row.document_url,
    effectiveAt: row.effective_at,
    isActive: row.is_active
  };
}

function mapConsent(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    consentType: row.consent_type,
    policyVersionId: row.policy_version_id,
    granted: row.granted,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    source: row.source,
    locale: row.locale
  };
}

export interface BaselineConsentInput {
  termsPolicyId: string;
  privacyPolicyId: string;
  healthDataPolicyId: string;
  marketingEmailOptIn?: boolean;
  pushNotificationsOptIn?: boolean;
  locale?: string;
}

export class PolicyService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listActivePolicies(): Promise<PolicyVersion[]> {
    const { data, error } = await this.supabase
      .from("policy_version_tracking")
      .select("*")
      .eq("is_active", true)
      .order("effective_at", { ascending: false });

    throwIfError(error, "POLICIES_READ_FAILED", "Unable to load active policies.");

    return (data as PolicyRow[]).map(mapPolicy);
  }

  async listUserConsents(userId: string): Promise<ConsentRecord[]> {
    const { data, error } = await this.supabase
      .from("consents")
      .select("*")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false });

    throwIfError(error, "CONSENTS_READ_FAILED", "Unable to load consent records.");

    return (data as ConsentRow[]).map(mapConsent);
  }

  async upsertConsent(userId: string, input: UpsertConsentInput): Promise<ConsentRecord> {
    const { data, error } = await this.supabase
      .from("consents")
      .insert({
        user_id: userId,
        consent_type: input.consentType,
        policy_version_id: input.policyVersionId ?? null,
        granted: input.granted,
        revoked_at: input.granted ? null : new Date().toISOString(),
        source: input.source ?? "mobile",
        locale: input.locale ?? null
      })
      .select("*")
      .single();

    throwIfError(error, "CONSENT_UPSERT_FAILED", "Unable to capture consent.");

    return mapConsent(data as ConsentRow);
  }

  async captureBaselineConsents(userId: string, input: BaselineConsentInput): Promise<ConsentRecord[]> {
    const writes: UpsertConsentInput[] = [
      {
        consentType: "terms",
        granted: true,
        policyVersionId: input.termsPolicyId,
        locale: input.locale
      },
      {
        consentType: "privacy",
        granted: true,
        policyVersionId: input.privacyPolicyId,
        locale: input.locale
      },
      {
        consentType: "health_data_processing",
        granted: true,
        policyVersionId: input.healthDataPolicyId,
        locale: input.locale
      },
      {
        consentType: "marketing_email",
        granted: Boolean(input.marketingEmailOptIn),
        policyVersionId: input.privacyPolicyId,
        locale: input.locale
      },
      {
        consentType: "push_notifications",
        granted: input.pushNotificationsOptIn ?? true,
        policyVersionId: input.privacyPolicyId,
        locale: input.locale
      }
    ];

    const records: ConsentRecord[] = [];

    for (const write of writes) {
      records.push(await this.upsertConsent(userId, write));
    }

    return records;
  }
}
