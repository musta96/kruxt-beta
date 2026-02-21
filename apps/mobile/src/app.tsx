import type { FeatureFlagKey } from "@kruxt/types";

import { guildHallChecklist } from "./flows/guild-hall";
import { phase2OnboardingChecklist } from "./flows/phase2-onboarding";
import { phase3WorkoutLoggingChecklist } from "./flows/phase3-workout-logging";
import { phase4SocialFeedChecklist } from "./flows/phase4-social-feed";
import { phase5GuildHallUiChecklist } from "./flows/phase5-guild-hall-ui";
import { phase6IntegrationsUiChecklist } from "./flows/phase6-integrations-ui";
import { phase7RankTrialsChecklist } from "./flows/phase7-rank-trials";
import { phase8PrivacyRequestsChecklist } from "./flows/phase8-privacy-requests";
import { phase10SupportCenterChecklist } from "./flows/phase10-support-center";
import { phase10SecurityCenterChecklist } from "./flows/phase10-security-center";
import { phase10SecurityCenterUiChecklist } from "./flows/phase10-security-center-ui";

const defaultEnabledFlags: FeatureFlagKey[] = [
  "provider_apple_health_enabled",
  "provider_garmin_enabled",
  "privacy_requests_enabled",
  "consent_capture_enabled",
  "checkin_access_control_enabled",
  "class_waitlist_enabled"
];

export function mobileAppScaffold() {
  return {
    name: "KRUXT Mobile",
    tagline: "No log, no legend.",
    theme: "guild-premium",
    defaultEnabledFlags,
    phase2: {
      flow: "auth -> profile -> consents -> gym role -> guild hall",
      screenFlow: "welcome -> auth -> profile -> consents -> gym -> review -> guild hall",
      checklist: [...phase2OnboardingChecklist],
      guildHallChecklist: [...guildHallChecklist],
      recoverableErrors: [
        "ONBOARDING_VALIDATION_FAILED",
        "AUTH_SIGNIN_FAILED",
        "PROFILE_UPSERT_FAILED",
        "BASELINE_CONSENT_REQUIRED",
        "GYM_JOIN_FAILED",
        "ONBOARDING_HOME_GYM_NOT_PERSISTED"
      ],
      rpcEndpoints: [
        "log_workout_atomic",
        "join_waitlist",
        "promote_waitlist_member",
        "submit_privacy_request",
        "record_waiver_acceptance"
      ]
    },
    phase3: {
      flow: "consent gate check -> log workout -> auto proof post -> xp/chain/rank progress",
      screenFlow: "metadata -> exercise blocks -> sets -> visibility -> review -> submit",
      checklist: [...phase3WorkoutLoggingChecklist],
      recoverableErrors: [
        "WORKOUT_LOGGER_VALIDATION_FAILED",
        "RECONSENT_REQUIRED",
        "WORKOUT_LOG_RPC_FAILED",
        "WORKOUT_LOGGER_SIGNALS_INCOMPLETE"
      ],
      rpcEndpoints: ["log_workout_atomic"],
      expectedSignals: ["feed_events.workout_logged", "feed_events.pr_verified", "profiles.xp_total"]
    },
    phase4: {
      flow: "load ranked feed -> social interactions -> moderation safety -> notifications",
      screenFlow: "proof feed cards -> react/comment -> block/report -> refreshed feed snapshot",
      checklist: [...phase4SocialFeedChecklist],
      recoverableErrors: [
        "SOCIAL_REACTION_CREATE_FAILED",
        "SOCIAL_COMMENT_CREATE_FAILED",
        "SOCIAL_REPORT_CREATE_FAILED",
        "SOCIAL_BLOCK_CREATE_FAILED"
      ],
      tables: [
        "feed_events",
        "social_connections",
        "social_interactions",
        "user_blocks",
        "user_reports",
        "notification_preferences",
        "push_notification_tokens"
      ],
      featureFlags: ["public_feed_boost_enabled"]
    },
    phase5: {
      flow: "role-aware guild hall -> member status surface + staff operations board",
      screenFlow:
        "member status (membership/classes/waitlist/check-ins/compliance) -> conditional staff operations board",
      checklist: [...phase5GuildHallUiChecklist],
      modules: ["GuildHallMemberView", "GuildHallStaffView"],
      tables: [
        "gym_memberships",
        "gym_membership_plans",
        "gym_classes",
        "class_bookings",
        "class_waitlist",
        "gym_checkins",
        "access_logs",
        "waivers",
        "contracts",
        "waiver_acceptances",
        "contract_acceptances"
      ],
      uiSurface: ["createPhase5GuildHallUiFlow.load", "createPhase5GuildHallUiFlow.getStaffConfirmDialog"],
      guardrails: [
        "member surfaces never expose staff mutations",
        "staff controls always require explicit confirm dialogs"
      ]
    },
    phase6: {
      flow: "connect provider -> queue sync -> import activities -> persist cursor",
      screenFlow:
        "provider selection -> connect/disconnect -> request sync -> validate imports/mapping -> activation report",
      checklist: [...phase6IntegrationsUiChecklist],
      recoverableErrors: [
        "INTEGRATION_CONNECTION_UPSERT_FAILED",
        "INTEGRATION_CONNECTION_STATUS_UPDATE_FAILED",
        "INTEGRATION_SYNC_JOB_QUEUE_FAILED",
        "INTEGRATION_CONNECTION_INACTIVE",
        "INTEGRATION_IMPORTS_READ_FAILED"
      ],
      activeProviders: ["apple_health", "garmin"],
      darkLaunchProviders: ["fitbit", "huawei_health", "suunto", "oura", "whoop"],
      tables: [
        "device_connections",
        "device_sync_jobs",
        "device_sync_cursors",
        "external_activity_imports",
        "integration_webhook_events"
      ],
      edgeFunctions: ["provider_webhook_ingest", "sync_dispatcher"],
      activationSurface: [
        "createPhase6IntegrationsUiFlow.connectProvider",
        "createPhase6IntegrationsUiFlow.disconnectProvider",
        "createPhase6IntegrationsUiFlow.queueSync",
        "createPhase6IntegrationsUiFlow.validateActivation"
      ]
    },
    phase7: {
      flow: "load weekly rank ladders -> load trials -> submit challenge progress -> weekly recompute",
      checklist: [...phase7RankTrialsChecklist],
      modules: ["RankLadder", "Trials"],
      tables: ["leaderboards", "leaderboard_entries", "challenges", "challenge_participants"],
      rpcEndpoints: ["join_challenge", "leave_challenge", "submit_challenge_progress", "rebuild_leaderboard_scope"],
      edgeFunctions: ["rank_recompute_weekly"]
    },
    phase8: {
      flow: "submit privacy request -> triage/processing -> export package/sign link -> fulfillment timeline",
      checklist: [...phase8PrivacyRequestsChecklist],
      modules: ["PrivacyRequestCenter", "ReconsentGate", "ExportVault"],
      tables: ["privacy_requests", "consents", "policy_version_tracking", "audit_logs"],
      rpcEndpoints: [
        "submit_privacy_request",
        "record_user_consent",
        "list_missing_required_consents",
        "user_has_required_consents"
      ],
      edgeFunctions: ["privacy_request_processor"]
    },
    phase10Support: {
      flow: "open support center -> submit ticket -> message thread -> automation approval",
      checklist: [...phase10SupportCenterChecklist],
      modules: ["SupportCenter", "TicketThread", "AutomationApproval"],
      tables: ["support_tickets", "support_ticket_messages", "support_automation_runs"],
      rpcEndpoints: ["submit_support_ticket", "approve_support_automation_run"]
    },
    phase10Security: {
      flow: "review settings -> manage trusted devices -> inspect auth timeline -> apply security actions",
      checklist: [...phase10SecurityCenterChecklist],
      modules: ["SecurityCenter", "TrustedDevices", "AuthTimeline"],
      tables: ["user_security_settings", "user_trusted_devices", "user_auth_events"],
      rpcEndpoints: ["log_user_auth_event"]
    },
    phase10SecurityUi: {
      flow: "summary/risk cards -> timeline groups -> device actions -> refresh-safe state",
      checklist: [...phase10SecurityCenterUiChecklist],
      modules: ["SecuritySummaryCards", "RiskActionRail", "TimelineBuckets"],
      uiSurface: [
        "createPhase10SecurityCenterUiFlow.load",
        "createPhase10SecurityCenterUiFlow.upsertSettings",
        "createPhase10SecurityCenterUiFlow.revokeTrustedDevice",
        "createPhase10SecurityCenterUiFlow.logAuthEvent"
      ]
    }
  };
}
