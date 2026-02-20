import type { UserAuthEvent, UserTrustedDevice } from "@kruxt/types";

import {
  createPhase10SecurityCenterFlow,
  phase10SecurityCenterChecklist,
  type Phase10SecurityCenterError,
  type Phase10SecurityCenterLoadOptions,
  type Phase10SecurityCenterMutationResult,
  type Phase10SecurityCenterSnapshot
} from "./phase10-security-center";

export type SecurityCenterUiStep = "settings" | "device_control" | "risk_review";

export interface SecurityCenterActionCard {
  id: string;
  severity: "info" | "warning" | "critical";
  step: SecurityCenterUiStep;
  title: string;
  detail: string;
}

export interface SecurityCenterRiskSummary {
  highRiskEventCount24h: number;
  failedLoginCount24h: number;
  revokedDeviceCount30d: number;
  hasImmediateAction: boolean;
}

export interface SecurityCenterTimelineGroup {
  key: string;
  label: string;
  events: UserAuthEvent[];
}

export interface Phase10SecurityCenterUiSnapshot extends Phase10SecurityCenterSnapshot {
  riskSummary: SecurityCenterRiskSummary;
  actionCards: SecurityCenterActionCard[];
  timelineGroups: SecurityCenterTimelineGroup[];
  suspiciousDevices: UserTrustedDevice[];
}

export interface Phase10SecurityCenterUiLoadSuccess {
  ok: true;
  snapshot: Phase10SecurityCenterUiSnapshot;
}

export interface Phase10SecurityCenterUiLoadFailure {
  ok: false;
  error: Phase10SecurityCenterError;
}

export type Phase10SecurityCenterUiLoadResult =
  | Phase10SecurityCenterUiLoadSuccess
  | Phase10SecurityCenterUiLoadFailure;

export interface Phase10SecurityCenterUiMutationSuccess {
  ok: true;
  action: "upsert_settings" | "upsert_trusted_device" | "revoke_trusted_device" | "log_auth_event";
  snapshot: Phase10SecurityCenterUiSnapshot;
}

export interface Phase10SecurityCenterUiMutationFailure {
  ok: false;
  error: Phase10SecurityCenterError;
}

export type Phase10SecurityCenterUiMutationResult =
  | Phase10SecurityCenterUiMutationSuccess
  | Phase10SecurityCenterUiMutationFailure;

export const phase10SecurityCenterUiChecklist = [
  ...phase10SecurityCenterChecklist,
  "Group auth events into timeline buckets for quick risk scanning",
  "Surface explicit action cards when security posture requires intervention"
] as const;

function isWithinHours(isoTimestamp: string, hours: number): boolean {
  const deltaMs = Date.now() - Date.parse(isoTimestamp);
  if (!Number.isFinite(deltaMs)) {
    return false;
  }

  return deltaMs <= hours * 3_600_000;
}

function isWithinDays(isoTimestamp: string, days: number): boolean {
  return isWithinHours(isoTimestamp, days * 24);
}

function buildTimelineGroups(events: UserAuthEvent[]): SecurityCenterTimelineGroup[] {
  const now = Date.now();
  const groups = [
    { key: "last_24h", label: "Last 24h", minHours: 0, maxHours: 24 },
    { key: "last_7d", label: "Last 7d", minHours: 24, maxHours: 24 * 7 },
    { key: "older", label: "Older", minHours: 24 * 7, maxHours: Number.POSITIVE_INFINITY }
  ];

  return groups
    .map((group) => {
      const groupedEvents = events.filter((event) => {
        const hoursAgo = (now - Date.parse(event.occurredAt)) / 3_600_000;
        return hoursAgo >= group.minHours && hoursAgo < group.maxHours;
      });

      return {
        key: group.key,
        label: group.label,
        events: groupedEvents
      };
    })
    .filter((group) => group.events.length > 0);
}

function buildRiskSummary(snapshot: Phase10SecurityCenterSnapshot): SecurityCenterRiskSummary {
  const highRiskEventCount24h = snapshot.authEvents.filter(
    (event) => event.riskLevel === "high" && isWithinHours(event.occurredAt, 24)
  ).length;

  const failedLoginCount24h = snapshot.authEvents.filter(
    (event) => event.eventType === "login_failed" && isWithinHours(event.occurredAt, 24)
  ).length;

  const revokedDeviceCount30d = snapshot.trustedDevices.filter(
    (device) => Boolean(device.revokedAt) && isWithinDays(device.revokedAt ?? "", 30)
  ).length;

  return {
    highRiskEventCount24h,
    failedLoginCount24h,
    revokedDeviceCount30d,
    hasImmediateAction: highRiskEventCount24h > 0 || failedLoginCount24h >= 3
  };
}

function buildActionCards(
  snapshot: Phase10SecurityCenterSnapshot,
  riskSummary: SecurityCenterRiskSummary
): SecurityCenterActionCard[] {
  const cards: SecurityCenterActionCard[] = [];

  if (!snapshot.settings.mfaEnabled) {
    cards.push({
      id: "enable-mfa",
      severity: "critical",
      step: "settings",
      title: "Enable MFA",
      detail: "MFA is disabled. Turn it on to reduce account takeover risk."
    });
  }

  if (riskSummary.highRiskEventCount24h > 0) {
    cards.push({
      id: "review-high-risk-events",
      severity: "critical",
      step: "risk_review",
      title: "Review high-risk events",
      detail: `${riskSummary.highRiskEventCount24h} high-risk authentication events were detected in the last 24h.`
    });
  }

  if (riskSummary.failedLoginCount24h >= 3) {
    cards.push({
      id: "failed-logins-spike",
      severity: "warning",
      step: "risk_review",
      title: "Failed login spike",
      detail: `${riskSummary.failedLoginCount24h} failed logins occurred in the last 24h.`
    });
  }

  if (!snapshot.settings.newDeviceAlerts) {
    cards.push({
      id: "enable-device-alerts",
      severity: "warning",
      step: "settings",
      title: "Enable new-device alerts",
      detail: "New-device alerts are off. Enable them for early compromise detection."
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: "security-posture-stable",
      severity: "info",
      step: "risk_review",
      title: "Security posture stable",
      detail: "No urgent account-security interventions are required right now."
    });
  }

  return cards;
}

function mapUiSnapshot(snapshot: Phase10SecurityCenterSnapshot): Phase10SecurityCenterUiSnapshot {
  const riskSummary = buildRiskSummary(snapshot);
  const suspiciousDevices = snapshot.trustedDevices.filter(
    (device) => !device.isActive || Boolean(device.revokedAt)
  );

  return {
    ...snapshot,
    riskSummary,
    actionCards: buildActionCards(snapshot, riskSummary),
    timelineGroups: buildTimelineGroups(snapshot.authEvents),
    suspiciousDevices
  };
}

function toUiMutationResult(result: Phase10SecurityCenterMutationResult): Phase10SecurityCenterUiMutationResult {
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    action: result.action,
    snapshot: mapUiSnapshot(result.snapshot)
  };
}

export function createPhase10SecurityCenterUiFlow() {
  const runtime = createPhase10SecurityCenterFlow();

  return {
    checklist: [...phase10SecurityCenterUiChecklist],
    load: async (options: Phase10SecurityCenterLoadOptions = {}): Promise<Phase10SecurityCenterUiLoadResult> => {
      const result = await runtime.load(options);
      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        snapshot: mapUiSnapshot(result.snapshot)
      };
    },
    upsertSettings: async (...args: Parameters<typeof runtime.upsertSettings>) =>
      toUiMutationResult(await runtime.upsertSettings(...args)),
    upsertTrustedDevice: async (...args: Parameters<typeof runtime.upsertTrustedDevice>) =>
      toUiMutationResult(await runtime.upsertTrustedDevice(...args)),
    revokeTrustedDevice: async (...args: Parameters<typeof runtime.revokeTrustedDevice>) =>
      toUiMutationResult(await runtime.revokeTrustedDevice(...args)),
    logAuthEvent: async (...args: Parameters<typeof runtime.logAuthEvent>) =>
      toUiMutationResult(await runtime.logAuthEvent(...args))
  };
}
