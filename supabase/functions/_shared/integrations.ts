import { isFlagEnabled } from "./flags.ts";

export const INTEGRATION_PROVIDERS = [
  "apple_health",
  "garmin",
  "fitbit",
  "huawei_health",
  "suunto",
  "oura",
  "whoop",
  "manual"
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

const providerFlags: Record<IntegrationProvider, string> = {
  apple_health: "provider_apple_health_enabled",
  garmin: "provider_garmin_enabled",
  fitbit: "provider_fitbit_enabled",
  huawei_health: "provider_huawei_health_enabled",
  suunto: "provider_suunto_enabled",
  oura: "provider_oura_enabled",
  whoop: "provider_whoop_enabled",
  manual: "provider_apple_health_enabled"
};

const ACTIVE_SYNC_PROVIDER_SET = new Set<IntegrationProvider>(["apple_health", "garmin"]);

export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return typeof value === "string" && INTEGRATION_PROVIDERS.includes(value as IntegrationProvider);
}

export function isActiveSyncProvider(provider: IntegrationProvider): boolean {
  return ACTIVE_SYNC_PROVIDER_SET.has(provider);
}

export async function isProviderEnabled(provider: IntegrationProvider): Promise<boolean> {
  return isFlagEnabled(providerFlags[provider]);
}

export function normalizeWebhookEventId(provider: IntegrationProvider, providerEventId: string | null, payloadHash: string): string {
  const raw = providerEventId?.trim() ?? "";
  return raw ? raw : `${provider}:${payloadHash}`;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function sha256Hex(value: unknown): Promise<string> {
  const payload = JSON.stringify(value ?? {});
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
