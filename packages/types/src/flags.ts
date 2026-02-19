export const FEATURE_FLAG_KEYS = [
  "billing_live",
  "provider_apple_health_enabled",
  "provider_garmin_enabled",
  "provider_fitbit_enabled",
  "provider_huawei_health_enabled",
  "provider_suunto_enabled",
  "provider_oura_enabled",
  "provider_whoop_enabled",
  "ml_recommendations_enabled",
  "public_feed_boost_enabled",
  "privacy_requests_enabled",
  "consent_capture_enabled",
  "checkin_access_control_enabled",
  "class_waitlist_enabled"
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
