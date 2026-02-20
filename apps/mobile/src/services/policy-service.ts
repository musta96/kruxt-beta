import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConsentRecord,
  LegalLocalizationOptions,
  PolicyVersion,
  PublishPolicyVersionInput,
  RequiredConsentGap,
  UpsertConsentInput
} from "@kruxt/types";
import { translateLegalText } from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type PolicyRow = {
  id: string;
  policy_type: PolicyVersion["policyType"];
  version: string;
  label: string | null;
  document_url: string;
  effective_at: string;
  is_active: boolean;
  published_at: string;
  requires_reconsent: boolean;
  change_summary: string | null;
  supersedes_policy_version_id: string | null;
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

type RequiredConsentGapRow = {
  consent_type: RequiredConsentGap["consentType"];
  required_policy_version_id: string | null;
  required_policy_version: string | null;
  reason: RequiredConsentGap["reason"];
};

function mapPolicy(row: PolicyRow): PolicyVersion {
  return {
    id: row.id,
    policyType: row.policy_type,
    version: row.version,
    label: row.label,
    documentUrl: row.document_url,
    effectiveAt: row.effective_at,
    isActive: row.is_active,
    publishedAt: row.published_at,
    requiresReconsent: row.requires_reconsent,
    changeSummary: row.change_summary,
    supersedesPolicyVersionId: row.supersedes_policy_version_id
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

function mapConsentGap(row: RequiredConsentGapRow): RequiredConsentGap {
  return {
    consentType: row.consent_type,
    requiredPolicyVersionId: row.required_policy_version_id,
    requiredPolicyVersion: row.required_policy_version,
    reason: row.reason
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
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly localization: Pick<LegalLocalizationOptions, "locale"> = {}
  ) {}

  private consentPolicyType(consentType: ConsentRecord["consentType"]): PolicyVersion["policyType"] {
    if (consentType === "terms") {
      return "terms";
    }

    if (consentType === "health_data_processing") {
      return "health_data";
    }

    return "privacy";
  }

  async listActivePolicies(): Promise<PolicyVersion[]> {
    const { data, error } = await this.supabase
      .from("policy_version_tracking")
      .select("*")
      .eq("is_active", true)
      .order("effective_at", { ascending: false });

    throwIfError(error, "POLICIES_READ_FAILED", "Unable to load active policies.");

    return (data as PolicyRow[]).map(mapPolicy);
  }

  async publishPolicyVersion(input: PublishPolicyVersionInput): Promise<PolicyVersion> {
    const { data, error } = await this.supabase.rpc("publish_policy_version", {
      p_policy_type: input.policyType,
      p_version: input.version,
      p_document_url: input.documentUrl,
      p_effective_at: input.effectiveAt ?? null,
      p_label: input.label ?? null,
      p_requires_reconsent: input.requiresReconsent ?? true,
      p_change_summary: input.changeSummary ?? null,
      p_is_active: input.isActive ?? true,
      p_supersedes_policy_version_id: input.supersedesPolicyVersionId ?? null
    });

    throwIfError(error, "POLICY_PUBLISH_FAILED", "Unable to publish policy version.");

    const policyId = data as string | null;
    if (!policyId) {
      throw new KruxtAppError("POLICY_PUBLISH_NO_ID", "Policy publish completed without a policy id.");
    }

    const { data: policyData, error: policyError } = await this.supabase
      .from("policy_version_tracking")
      .select("*")
      .eq("id", policyId)
      .maybeSingle();

    throwIfError(policyError, "POLICY_READ_FAILED", "Unable to read published policy version.");

    if (!policyData) {
      throw new KruxtAppError("POLICY_NOT_FOUND_AFTER_PUBLISH", "Published policy version was not found.");
    }

    return mapPolicy(policyData as PolicyRow);
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

  private async getConsentById(userId: string, consentId: string): Promise<ConsentRecord> {
    const { data, error } = await this.supabase
      .from("consents")
      .select("*")
      .eq("id", consentId)
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(error, "CONSENT_READ_BY_ID_FAILED", "Unable to read consent record.");

    if (!data) {
      throw new KruxtAppError("CONSENT_NOT_FOUND", "Consent record was not found.");
    }

    return mapConsent(data as ConsentRow);
  }

  private async resolvePolicyVersionId(
    consentType: ConsentRecord["consentType"],
    explicitPolicyVersionId?: string
  ): Promise<string> {
    if (explicitPolicyVersionId) {
      return explicitPolicyVersionId;
    }

    const { data, error } = await this.supabase.rpc("current_policy_version_id", {
      p_policy_type: this.consentPolicyType(consentType),
      p_as_of: new Date().toISOString()
    });

    throwIfError(error, "POLICY_CURRENT_VERSION_LOOKUP_FAILED", "Unable to resolve current policy version.");

    const policyVersionId = data as string | null;
    if (!policyVersionId) {
      throw new KruxtAppError(
        "POLICY_CURRENT_VERSION_MISSING",
        `No active policy version found for consent type ${consentType}.`
      );
    }

    return policyVersionId;
  }

  async upsertConsent(userId: string, input: UpsertConsentInput): Promise<ConsentRecord> {
    const policyVersionId = await this.resolvePolicyVersionId(input.consentType, input.policyVersionId);
    const latest = await this.getLatestConsent(userId, input.consentType);
    if (
      latest &&
      latest.granted === input.granted &&
      (latest.policyVersionId ?? null) === policyVersionId
    ) {
      return latest;
    }

    const { data, error } = await this.supabase.rpc("record_user_consent", {
      p_consent_type: input.consentType,
      p_granted: input.granted,
      p_policy_version_id: policyVersionId,
      p_source: input.source ?? "mobile",
      p_locale: input.locale ?? null,
      p_user_id: userId,
      p_ip_address: input.ipAddress ?? null,
      p_user_agent: input.userAgent ?? null,
      p_evidence: input.evidence ?? {}
    });

    throwIfError(error, "CONSENT_RECORD_FAILED", "Unable to capture consent.");

    const consentId = data as string | null;
    if (!consentId) {
      throw new KruxtAppError("CONSENT_RECORD_NO_ID", "Consent capture completed without a consent id.");
    }

    return this.getConsentById(userId, consentId);
  }

  async listRequiredConsentGaps(userId: string): Promise<RequiredConsentGap[]> {
    const { data, error } = await this.supabase.rpc("list_missing_required_consents", {
      p_user_id: userId
    });

    throwIfError(error, "CONSENT_GAPS_READ_FAILED", "Unable to load required consent gaps.");

    return ((data as RequiredConsentGapRow[]) ?? []).map(mapConsentGap);
  }

  async hasRequiredConsents(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("user_has_required_consents", {
      p_user_id: userId
    });

    throwIfError(error, "CONSENT_GATE_CHECK_FAILED", "Unable to validate consent requirements.");

    return Boolean(data);
  }

  async assertRequiredConsents(userId: string): Promise<void> {
    const hasRequiredConsents = await this.hasRequiredConsents(userId);
    if (hasRequiredConsents) {
      return;
    }

    const gaps = await this.listRequiredConsentGaps(userId);
    throw new KruxtAppError(
      "RECONSENT_REQUIRED",
      translateLegalText("legal.error.reconsent_required_action", this.localization),
      { gaps }
    );
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
        translateLegalText("legal.error.policy_baseline_missing", this.localization)
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
        translateLegalText("legal.error.baseline_consent_required", this.localization)
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
