import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentRecord, PolicyVersion, UpsertConsentInput } from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

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

type BaselinePolicyIds = {
  termsPolicyId: string;
  privacyPolicyId: string;
  healthDataPolicyId: string;
};

export interface BaselineConsentInput extends Partial<BaselinePolicyIds> {
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptHealthData?: boolean;
  marketingEmailOptIn?: boolean;
  pushNotificationsOptIn?: boolean;
  locale?: string;
  source?: "mobile" | "admin" | "web";
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

  private async getLatestConsent(userId: string, consentType: ConsentRecord["consentType"]): Promise<ConsentRecord | null> {
    const { data, error } = await this.supabase
      .from("consents")
      .select("*")
      .eq("user_id", userId)
      .eq("consent_type", consentType)
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfError(error, "CONSENT_READ_LATEST_FAILED", "Unable to read latest consent.");

    return data ? mapConsent(data as ConsentRow) : null;
  }

  async upsertConsent(userId: string, input: UpsertConsentInput): Promise<ConsentRecord> {
    const latest = await this.getLatestConsent(userId, input.consentType);
    if (
      latest &&
      latest.granted === input.granted &&
      (latest.policyVersionId ?? null) === (input.policyVersionId ?? null)
    ) {
      return latest;
    }

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

  private resolvePolicyByType(
    policies: PolicyVersion[],
    policyType: PolicyVersion["policyType"]
  ): PolicyVersion | undefined {
    return policies.find((policy) => policy.policyType === policyType);
  }

  private async resolveBaselinePolicyIds(input: BaselineConsentInput): Promise<BaselinePolicyIds> {
    if (input.termsPolicyId && input.privacyPolicyId && input.healthDataPolicyId) {
      return {
        termsPolicyId: input.termsPolicyId,
        privacyPolicyId: input.privacyPolicyId,
        healthDataPolicyId: input.healthDataPolicyId
      };
    }

    const policies = await this.listActivePolicies();
    const termsPolicy = input.termsPolicyId
      ? { id: input.termsPolicyId }
      : this.resolvePolicyByType(policies, "terms");
    const privacyPolicy = input.privacyPolicyId
      ? { id: input.privacyPolicyId }
      : this.resolvePolicyByType(policies, "privacy");
    const healthDataPolicy = input.healthDataPolicyId
      ? { id: input.healthDataPolicyId }
      : this.resolvePolicyByType(policies, "health_data");

    if (!termsPolicy?.id || !privacyPolicy?.id || !healthDataPolicy?.id) {
      throw new KruxtAppError(
        "POLICY_BASELINE_MISSING",
        "Missing active baseline policies for terms, privacy, or health data processing."
      );
    }

    return {
      termsPolicyId: termsPolicy.id,
      privacyPolicyId: privacyPolicy.id,
      healthDataPolicyId: healthDataPolicy.id
    };
  }

  async captureBaselineConsents(userId: string, input: BaselineConsentInput): Promise<ConsentRecord[]> {
    const acceptTerms = input.acceptTerms ?? true;
    const acceptPrivacy = input.acceptPrivacy ?? true;
    const acceptHealthData = input.acceptHealthData ?? true;

    if (!acceptTerms || !acceptPrivacy || !acceptHealthData) {
      throw new KruxtAppError(
        "BASELINE_CONSENT_REQUIRED",
        "Terms, privacy, and health-data processing consent are required to continue."
      );
    }

    const policyIds = await this.resolveBaselinePolicyIds(input);
    const source = input.source ?? "mobile";

    const writes: UpsertConsentInput[] = [
      {
        consentType: "terms",
        granted: true,
        policyVersionId: policyIds.termsPolicyId,
        locale: input.locale,
        source
      },
      {
        consentType: "privacy",
        granted: true,
        policyVersionId: policyIds.privacyPolicyId,
        locale: input.locale,
        source
      },
      {
        consentType: "health_data_processing",
        granted: true,
        policyVersionId: policyIds.healthDataPolicyId,
        locale: input.locale,
        source
      },
      {
        consentType: "marketing_email",
        granted: Boolean(input.marketingEmailOptIn),
        policyVersionId: policyIds.privacyPolicyId,
        locale: input.locale,
        source
      },
      {
        consentType: "push_notifications",
        granted: input.pushNotificationsOptIn ?? true,
        policyVersionId: policyIds.privacyPolicyId,
        locale: input.locale,
        source
      }
    ];

    const records: ConsentRecord[] = [];
    for (const write of writes) {
      records.push(await this.upsertConsent(userId, write));
    }

    return records;
  }
}
