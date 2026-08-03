import type { SupabaseClient } from "@supabase/supabase-js";

export type RequiredConsentType = "terms" | "privacy" | "health_data_processing";

type RequiredPolicyType = "terms" | "privacy" | "health_data";

type ConsentGapRow = {
  consent_type: string;
  required_policy_version_id: string | null;
  required_policy_version: string | null;
  reason: string;
};

type PolicyRow = {
  id: string;
  policy_type: RequiredPolicyType;
  version: string;
  label: string | null;
  document_url: string;
  checksum: string | null;
  effective_at: string;
  is_active: boolean;
  change_summary: string | null;
};

export type RequiredConsentPolicy = {
  id: string;
  consentType: RequiredConsentType;
  policyType: RequiredPolicyType;
  version: string;
  label: string;
  documentUrl: string;
  checksum: string;
  effectiveAt: string;
  changeSummary: string | null;
  reason: string;
};

const REQUIRED_CONSENT_ORDER: RequiredConsentType[] = ["terms", "privacy", "health_data_processing"];

const POLICY_TYPE_BY_CONSENT: Record<RequiredConsentType, RequiredPolicyType> = {
  terms: "terms",
  privacy: "privacy",
  health_data_processing: "health_data"
};

const DEFAULT_POLICY_LABELS: Record<RequiredConsentType, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Notice",
  health_data_processing: "Health Data Processing Notice"
};

function isRequiredConsentType(value: string): value is RequiredConsentType {
  return REQUIRED_CONSENT_ORDER.includes(value as RequiredConsentType);
}

function isReviewableDocumentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isSha256Binding(value: string | null): value is string {
  return Boolean(value && /^(sha256:)?[0-9a-f]{64}$/i.test(value.trim()));
}

export async function hasRequiredConsents(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client.rpc("user_has_required_consents", { p_user_id: userId });
  if (error) throw new Error(error.message || "Unable to validate required consents.");
  return Boolean(data);
}

export async function loadRequiredConsentPolicies(
  client: SupabaseClient,
  userId: string
): Promise<RequiredConsentPolicy[]> {
  const { data: gapData, error: gapError } = await client.rpc("list_missing_required_consents", {
    p_user_id: userId
  });

  if (gapError) throw new Error(gapError.message || "Unable to load required consents.");

  const gapRows = (gapData ?? []) as ConsentGapRow[];
  const unsupportedGap = gapRows.find((gap) => !isRequiredConsentType(gap.consent_type));
  if (unsupportedGap) {
    throw new Error(`Account access is paused because consent type ${unsupportedGap.consent_type} is not supported.`);
  }

  const gaps = gapRows.filter((gap) => isRequiredConsentType(gap.consent_type));
  if (gaps.length === 0) return [];

  const missingPublishedPolicy = gaps.find((gap) => !gap.required_policy_version_id);
  if (missingPublishedPolicy) {
    throw new Error(
      `Account access is paused because no approved, consent-ready ${DEFAULT_POLICY_LABELS[missingPublishedPolicy.consent_type as RequiredConsentType]} is published.`
    );
  }

  const policyIds = [...new Set(gaps.map((gap) => gap.required_policy_version_id as string))];
  const { data: policyData, error: policyError } = await client
    .from("policy_version_tracking")
    .select("id,policy_type,version,label,document_url,checksum,effective_at,is_active,change_summary")
    .in("id", policyIds);

  if (policyError) throw new Error(policyError.message || "Unable to load published policy versions.");

  const policiesById = new Map(((policyData ?? []) as PolicyRow[]).map((policy) => [policy.id, policy]));
  const now = Date.now();

  return REQUIRED_CONSENT_ORDER.flatMap((consentType) => {
    const gap = gaps.find((candidate) => candidate.consent_type === consentType);
    if (!gap) return [];

    const policy = policiesById.get(gap.required_policy_version_id as string);
    if (!policy) {
      throw new Error(`The active ${DEFAULT_POLICY_LABELS[consentType]} could not be loaded.`);
    }

    const effectiveAt = Date.parse(policy.effective_at);
    if (
      policy.policy_type !== POLICY_TYPE_BY_CONSENT[consentType] ||
      !policy.is_active ||
      !Number.isFinite(effectiveAt) ||
      effectiveAt > now ||
      !policy.version.trim() ||
      !isReviewableDocumentUrl(policy.document_url) ||
      !isSha256Binding(policy.checksum)
    ) {
      throw new Error(`The active ${DEFAULT_POLICY_LABELS[consentType]} is not available for review.`);
    }

    return [
      {
        id: policy.id,
        consentType,
        policyType: policy.policy_type,
        version: policy.version.trim(),
        label: policy.label?.trim() || DEFAULT_POLICY_LABELS[consentType],
        documentUrl: policy.document_url.trim(),
        checksum: policy.checksum.trim().toLowerCase(),
        effectiveAt: policy.effective_at,
        changeSummary: policy.change_summary,
        reason: gap.reason
      }
    ];
  });
}

export async function acceptRequiredConsentPolicies(
  client: SupabaseClient,
  userId: string,
  reviewedPolicies: RequiredConsentPolicy[]
): Promise<void> {
  const currentPolicies = await loadRequiredConsentPolicies(client, userId);
  if (currentPolicies.length === 0) return;

  const reviewedByType = new Map(reviewedPolicies.map((policy) => [policy.consentType, policy]));
  const changedPolicy = currentPolicies.find(
    (policy) => reviewedByType.get(policy.consentType)?.id !== policy.id
  );

  if (changedPolicy) {
    throw new Error("A required policy changed while you were reviewing it. Review the updated version before continuing.");
  }

  const locale = typeof navigator === "undefined" ? null : navigator.language;
  for (const policy of currentPolicies) {
    const { error } = await client.rpc("record_user_consent", {
      p_consent_type: policy.consentType,
      p_granted: true,
      p_policy_version_id: policy.id,
      p_source: "web",
      p_locale: locale
    });

    if (error) throw new Error(error.message || `Unable to record acceptance for ${policy.label}.`);
  }

  const remainingPolicies = await loadRequiredConsentPolicies(client, userId);
  if (remainingPolicies.length > 0) {
    throw new Error("Required consent verification did not complete. Review the current policies and try again.");
  }
}
