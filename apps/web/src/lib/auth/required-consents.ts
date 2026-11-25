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

export type VerifiedPolicyDocument = {
  policyId: string;
  blob: Blob;
  byteLength: number;
  contentType: string;
};

const MAX_POLICY_DOCUMENT_BYTES = 10 * 1024 * 1024;
const REVIEWABLE_CONTENT_TYPES = new Set([
  "application/pdf",
  "text/plain"
]);

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

const CONSENT_ERROR_COPY = {
  configuration: () => "Account access is paused because required policy configuration is unavailable. Contact support.",
  missingPublication: (label: string) => `Account access is paused because no approved, consent-ready ${label} is published.`,
  missingPolicy: (label: string) => `The active ${label} could not be loaded.`,
  unavailablePolicy: (label: string) => `The active ${label} is not available for review.`,
  binding: (label: string) => `${label} has no valid HTTPS document binding.`,
  download: (label: string) => `${label} could not be downloaded for checksum verification.`,
  format: (label: string) => `${label} was published with an unsupported document format.`,
  size: (label: string) => `${label} exceeds the verified review size limit.`,
  body: (label: string) => `${label} has no reviewable document body.`,
  empty: (label: string) => `${label} is empty or exceeds the verified review size limit.`,
  checksum: (label: string) => `${label} does not match its published SHA-256 checksum.`,
  changed: () => "A required policy changed while you were reviewing it. Review the updated version before continuing.",
  incomplete: () => "Required consent verification did not complete. Review the current policies and try again.",
  load: () => "Unable to load required policies. Try again or contact support.",
  accept: () => "Unable to record required consents. Try again or contact support."
};

type ConsentErrorCode = keyof typeof CONSENT_ERROR_COPY;
type ConsentErrorDetails = { code: ConsentErrorCode; label: string };
// Only errors created here carry trusted copy; SDK codes/messages cannot opt in.
const consentErrors = new WeakMap<Error, ConsentErrorDetails>();

function consentError(code: ConsentErrorCode, consentType?: RequiredConsentType): Error {
  const label = consentType && isRequiredConsentType(consentType)
    ? DEFAULT_POLICY_LABELS[consentType]
    : "Required policy";
  const error = new Error(CONSENT_ERROR_COPY[code](label));
  consentErrors.set(error, { code, label });
  return error;
}

export function requiredConsentErrorMessage(error: unknown, operation: "load" | "accept" = "load"): string {
  const details = error instanceof Error ? consentErrors.get(error) : undefined;
  return details
    ? CONSENT_ERROR_COPY[details.code](details.label)
    : CONSENT_ERROR_COPY[operation]();
}

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

function normalizeSha256(value: string): string {
  return value.trim().toLowerCase().replace(/^sha256:/, "");
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyRequiredConsentPolicyDocument(
  policy: RequiredConsentPolicy
): Promise<VerifiedPolicyDocument> {
  if (!isReviewableDocumentUrl(policy.documentUrl) || !isSha256Binding(policy.checksum)) {
    throw consentError("binding", policy.consentType);
  }
  const response = await fetch(policy.documentUrl, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw consentError("download", policy.consentType);
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!REVIEWABLE_CONTENT_TYPES.has(contentType)) {
    throw consentError("format", policy.consentType);
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_POLICY_DOCUMENT_BYTES) {
    throw consentError("size", policy.consentType);
  }

  if (!response.body) throw consentError("body", policy.consentType);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_POLICY_DOCUMENT_BYTES) {
        await reader.cancel();
        throw consentError("size", policy.consentType);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const documentBytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    documentBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (documentBytes.byteLength === 0 || documentBytes.byteLength > MAX_POLICY_DOCUMENT_BYTES) {
    throw consentError("empty", policy.consentType);
  }

  const digest = bytesToHex(await crypto.subtle.digest("SHA-256", documentBytes));
  if (digest !== normalizeSha256(policy.checksum)) {
    throw consentError("checksum", policy.consentType);
  }

  return {
    policyId: policy.id,
    blob: new Blob([documentBytes], { type: contentType }),
    byteLength: documentBytes.byteLength,
    contentType
  };
}

export async function hasRequiredConsents(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client.rpc("user_has_required_consents", { p_user_id: userId });
  if (error) throw consentError("load");
  return Boolean(data);
}

export async function loadRequiredConsentPolicies(
  client: SupabaseClient,
  userId: string
): Promise<RequiredConsentPolicy[]> {
  const { data: gapData, error: gapError } = await client.rpc("list_missing_required_consents", {
    p_user_id: userId
  });

  if (gapError) throw consentError("load");

  const gapRows = (gapData ?? []) as ConsentGapRow[];
  const unsupportedGap = gapRows.find((gap) => !isRequiredConsentType(gap.consent_type));
  if (unsupportedGap) {
    throw consentError("configuration");
  }

  const gaps = gapRows.filter((gap) => isRequiredConsentType(gap.consent_type));
  if (gaps.length === 0) return [];

  const missingPublishedPolicy = gaps.find((gap) => !gap.required_policy_version_id);
  if (missingPublishedPolicy) {
    throw consentError("missingPublication", missingPublishedPolicy.consent_type as RequiredConsentType);
  }

  const policyIds = [...new Set(gaps.map((gap) => gap.required_policy_version_id as string))];
  const { data: policyData, error: policyError } = await client
    .from("policy_version_tracking")
    .select("id,policy_type,version,label,document_url,checksum,effective_at,is_active,change_summary")
    .in("id", policyIds);

  if (policyError) throw consentError("load");

  const policiesById = new Map(((policyData ?? []) as PolicyRow[]).map((policy) => [policy.id, policy]));
  const now = Date.now();

  return REQUIRED_CONSENT_ORDER.flatMap((consentType) => {
    const gap = gaps.find((candidate) => candidate.consent_type === consentType);
    if (!gap) return [];

    const policy = policiesById.get(gap.required_policy_version_id as string);
    if (!policy) {
      throw consentError("missingPolicy", consentType);
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
      throw consentError("unavailablePolicy", consentType);
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
    throw consentError("changed");
  }

  const locale = typeof navigator === "undefined" ? null : navigator.language;
  const { error } = await client.rpc("accept_required_consents", {
    p_policy_version_ids: currentPolicies.map((policy) => policy.id),
    p_source: "web",
    p_locale: locale
  });

  if (error) throw consentError("accept");

  const remainingPolicies = await loadRequiredConsentPolicies(client, userId);
  if (remainingPolicies.length > 0) {
    throw consentError("incomplete");
  }
}
