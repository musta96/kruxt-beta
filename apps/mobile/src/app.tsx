import type { FeatureFlagKey } from "@kruxt/types";

import { guildHallChecklist } from "./flows/guild-hall";
import { phase2OnboardingChecklist } from "./flows/phase2-onboarding";
import { phase3WorkoutLoggingChecklist } from "./flows/phase3-workout-logging";
import { phase4SocialFeedChecklist } from "./flows/phase4-social-feed";
import { phase6IntegrationsChecklist } from "./flows/phase6-integrations";
import { phase7RankTrialsChecklist } from "./flows/phase7-rank-trials";
import { phase8PrivacyRequestsChecklist } from "./flows/phase8-privacy-requests";

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
      checklist: [...phase2OnboardingChecklist],
      guildHallChecklist: [...guildHallChecklist],
      rpcEndpoints: [
        "log_workout_atomic",
        "join_waitlist",
        "promote_waitlist_member",
        "submit_privacy_request",
        "record_waiver_acceptance"
      ]
    },
    phase3: {
      flow: "log workout -> auto proof post -> xp/chain/rank progress",
      checklist: [...phase3WorkoutLoggingChecklist],
      rpcEndpoints: ["log_workout_atomic"],
      expectedSignals: ["feed_events.workout_logged", "feed_events.pr_verified", "profiles.xp_total"]
    },
    phase4: {
      flow: "load ranked feed -> social interactions -> moderation safety -> notifications",
      checklist: [...phase4SocialFeedChecklist],
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
    phase6: {
      flow: "connect provider -> queue sync -> import activities -> persist cursor",
      checklist: [...phase6IntegrationsChecklist],
      activeProviders: ["apple_health", "garmin"],
      darkLaunchProviders: ["fitbit", "huawei_health", "suunto", "oura", "whoop"],
      tables: [
        "device_connections",
        "device_sync_jobs",
        "device_sync_cursors",
        "external_activity_imports",
        "integration_webhook_events"
      ],
      edgeFunctions: ["provider_webhook_ingest", "sync_dispatcher"]
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
      flow: "submit privacy request -> triage/processing -> fulfillment timeline",
      checklist: [...phase8PrivacyRequestsChecklist],
      modules: ["PrivacyRequestCenter"],
      tables: ["privacy_requests", "consents", "policy_version_tracking", "audit_logs"],
      rpcEndpoints: ["submit_privacy_request"],
      edgeFunctions: ["privacy_request_processor"]
    }
  };
}
