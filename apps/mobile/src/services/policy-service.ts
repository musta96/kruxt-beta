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
import { isExplicitOptIn } from "./onboarding-semantics";

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

export type BaselinePolicyIds = {
  termsPolicyId: string;
  privacyPolicyId: string;
  healthDataPolicyId: string;
};

export interface BaselinePolicies {
  terms: PolicyVersion;
  privacy: PolicyVersion;
  healthData: PolicyVersion;
}

export interface BaselineConsentInput extends BaselinePolicyIds {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptHealthData: boolean;
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

  private async getCurrentPolicyVersionId(
    policyType: PolicyVersion["policyType"],
    asOf: string
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc("current_policy_version_id", {
      p_policy_type: policyType,
      p_as_of: asOf
    });

    throwIfError(error, "POLICY_CURRENT_VERSION_LOOKUP_FAILED", "Unable to resolve current policy version.");

    const policyVersionId = data as string | null;
    if (!policyVersionId) {
      throw new KruxtAppError(
        "POLICY_CURRENT_VERSION_MISSING",
        `No active policy version found for policy type ${policyType}.`
      );
    }

    return policyVersionId;
  }

  async getCurrentBaselinePolicies(): Promise<BaselinePolicies> {
    const asOf = new Date().toISOString();
    const [termsId, privacyId, healthDataId] = await Promise.all([
      this.getCurrentPolicyVersionId("terms", asOf),
      this.getCurrentPolicyVersionId("privacy", asOf),
      this.getCurrentPolicyVersionId("health_data", asOf)
    ]);
    const expectedIds = [termsId, privacyId, healthDataId];

    if (new Set(expectedIds).size !== expectedIds.length) {
      throw new KruxtAppError("POLICY_BASELINE_INVALID", "Required policy versions are not configured correctly.");
    }

    const { data, error } = await this.supabase
      .from("policy_version_tracking")
      .select("*")
      .in("id", expectedIds);

    throwIfError(error, "POLICIES_READ_FAILED", "Unable to load active policies.");

    const policies = ((data as PolicyRow[] | null) ?? []).map(mapPolicy);
    const byId = new Map(policies.map((policy) => [policy.id, policy]));
    const terms = byId.get(termsId);
    const privacy = byId.get(privacyId);
    const healthData = byId.get(healthDataId);

    const requiredPolicies = [terms, privacy, healthData];
    if (
      requiredPolicies.some(
        (policy) =>
          !policy ||
          !policy.isActive ||
          !policy.label?.trim() ||
          !policy.version.trim() ||
          !/^https:\/\//i.test(policy.documentUrl.trim()) ||
          new Date(policy.effectiveAt).getTime() > new Date(asOf).getTime()
      )
    ) {
      throw new KruxtAppError(
        "POLICY_BASELINE_INVALID",
        "The required policy documents are unavailable or incomplete. Please try again later."
      );
    }

    if (
      terms?.policyType !== "terms" ||
      privacy?.policyType !== "privacy" ||
      healthData?.policyType !== "health_data"
    ) {
      throw new KruxtAppError("POLICY_BASELINE_INVALID", "Required policy types do not match their active records.");
    }

    return { terms, privacy, healthData } as BaselinePolicies;
  }

  async captureBaselineConsents(userId: string, input: BaselineConsentInput): Promise<ConsentRecord[]> {
    const acceptTerms = isExplicitOptIn(input.acceptTerms);
    const acceptPrivacy = isExplicitOptIn(input.acceptPrivacy);
    const acceptHealthData = isExplicitOptIn(input.acceptHealthData);

    if (!acceptTerms || !acceptPrivacy || !acceptHealthData) {
      throw new KruxtAppError(
        "BASELINE_CONSENT_REQUIRED",
        translateLegalText("legal.error.baseline_consent_required", this.localization)
      );
    }

    const { data, error } = await this.supabase.rpc("capture_mobile_onboarding_consents", {
      p_terms_policy_version_id: input.termsPolicyId,
      p_privacy_policy_version_id: input.privacyPolicyId,
      p_health_data_policy_version_id: input.healthDataPolicyId,
      p_accept_terms: acceptTerms,
      p_accept_privacy: acceptPrivacy,
      p_accept_health_data: acceptHealthData,
      p_marketing_email_opt_in: isExplicitOptIn(input.marketingEmailOptIn),
      p_push_notifications_opt_in: isExplicitOptIn(input.pushNotificationsOptIn),
      p_locale: input.locale ?? null,
      p_source: input.source ?? "mobile",
      p_user_id: userId
    });

    if (error) {
      const changed = error.message.toLowerCase().includes("no longer current");
      throw new KruxtAppError(
        changed ? "POLICY_BASELINE_CHANGED" : "BASELINE_CONSENT_CAPTURE_FAILED",
        changed
          ? "A required policy changed while you were reviewing it. Review the current documents before continuing."
          : "Unable to save onboarding consent decisions.",
        error
      );
    }

    const records = ((data as ConsentRow[] | null) ?? []).map(mapConsent);
    const byType = new Map(records.map((record) => [record.consentType, record]));
    const validResponse =
      records.length === 5 &&
      new Set(records.map((record) => record.id)).size === 5 &&
      records.every((record) => record.userId === userId) &&
      byType.get("terms")?.granted === true &&
      byType.get("terms")?.policyVersionId === input.termsPolicyId &&
      byType.get("privacy")?.granted === true &&
      byType.get("privacy")?.policyVersionId === input.privacyPolicyId &&
      byType.get("health_data_processing")?.granted === true &&
      byType.get("health_data_processing")?.policyVersionId === input.healthDataPolicyId &&
      byType.get("marketing_email")?.granted === isExplicitOptIn(input.marketingEmailOptIn) &&
      byType.get("push_notifications")?.granted === isExplicitOptIn(input.pushNotificationsOptIn);

    if (!validResponse) {
      throw new KruxtAppError(
        "ONBOARDING_CONSENT_CAPTURE_INCOMPLETE",
        "The server did not confirm every onboarding consent decision."
      );
    }

    const order: ConsentRecord["consentType"][] = [
      "terms",
      "privacy",
      "health_data_processing",
      "marketing_email",
      "push_notifications"
    ];
    return records.sort((left, right) => order.indexOf(left.consentType) - order.indexOf(right.consentType));
  }
}
