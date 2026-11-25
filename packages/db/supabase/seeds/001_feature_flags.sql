-- KRUXT default feature flags

insert into public.feature_flags(key, description, enabled, rollout_percentage)
values
  ('billing_live', 'Enable live subscription charging and payment collection', false, 0),
  ('provider_apple_health_enabled', 'Enable Apple HealthKit integration', true, 100),
  ('provider_garmin_enabled', 'Enable Garmin integration', true, 100),
  ('provider_fitbit_enabled', 'Enable Fitbit integration', false, 0),
  ('provider_huawei_health_enabled', 'Enable Huawei Health integration', false, 0),
  ('provider_suunto_enabled', 'Enable Suunto integration', false, 0),
  ('provider_oura_enabled', 'Enable Oura integration', false, 0),
  ('provider_whoop_enabled', 'Enable WHOOP integration', false, 0),
  ('ml_recommendations_enabled', 'Enable ML recommendation services', false, 0),
  ('public_feed_boost_enabled', 'Enable boosted feed ranking experiments', false, 0),
  ('privacy_requests_enabled', 'Allow in-app privacy request submission', true, 100),
  ('consent_capture_enabled', 'Require explicit legal consent capture at onboarding', true, 100),
  ('checkin_access_control_enabled', 'Enable gym check-in + access logs', true, 100),
  ('class_waitlist_enabled', 'Enable waitlist and auto-promotion flow for classes', true, 100)
on conflict (key)
do update
set description = excluded.description,
    enabled = excluded.enabled,
    rollout_percentage = excluded.rollout_percentage,
    updated_at = now();

-- Provisional policy placeholders. Issue #115 must publish approved, checksummed versions.
insert into public.policy_version_tracking(
  policy_type,
  version,
  label,
  document_url,
  checksum,
  effective_at,
  is_active,
  requires_reconsent,
  change_summary
)
values
  ('terms', 'v1.0.0', 'Provisional KRUXT Terms of Service', 'https://kruxt.app/legal/terms/v1.0.0', null, now(), false, true, 'Provisional seed only; not approved for clickwrap'),
  ('privacy', 'v1.0.0', 'Provisional KRUXT Privacy Notice', 'https://kruxt.app/legal/privacy/v1.0.0', null, now(), false, true, 'Provisional seed only; not approved for clickwrap'),
  ('health_data', 'v1.0.0', 'Provisional KRUXT Health Data Processing', 'https://kruxt.app/legal/health/v1.0.0', null, now(), false, true, 'Provisional seed only; not approved for clickwrap')
on conflict (policy_type, version)
do nothing;
