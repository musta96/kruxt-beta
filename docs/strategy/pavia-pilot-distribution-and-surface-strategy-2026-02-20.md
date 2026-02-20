# KRUXT Pavia Pilot Distribution + Surface Strategy (2026-02-20)

## Decision

For the Pavia pilot cohort (starting with BZone Pavia and Wellness Zone), use a **mobile-first web app (PWA-ready)** instead of TestFlight.

This avoids install friction, avoids App Store/TestFlight review overhead at pilot start, and keeps cost near zero (hosting + existing Supabase stack).

## Why This Is Best for Pilot

1. No TestFlight account/app onboarding required for users.
2. Instant rollout via URL + QR code + WhatsApp/email.
3. Fast iteration: deploy fixes without App Store resubmission.
4. Lower support burden for a solo-founder launch.

## Channel Comparison (Pilot)

| Channel | User Friction | Cost | Speed | Notes |
|---|---|---|---|---|
| TestFlight iOS beta | Medium-high | Low | Medium | Requires TestFlight app + invite flow |
| Mobile web/PWA | Low | Low | High | Best for fast pilot activation |
| App Store production | High | Medium | Low | Better after pilot stabilization |

## Implementation Rule

- **Pilot channel**: web/PWA first.
- **Native app channel**: enable after pilot KPIs are stable.
- Keep one shared backend and contracts; only delivery channels differ.

## Device Surface Plan (Gym Side)

### Desktop + iPad (full ops)

- Members/roles administration
- Billing/compliance/integrations
- CRM pipeline and analytics dashboards
- Staff shift planning and approval workflows

### Phone (ops-lite)

- Class schedule edits
- Waitlist promotion
- Check-in/access overrides
- Shift clock-in/out and quick time-entry updates
- Quick CRM notes and follow-up updates

Hide or read-only on phone:

- Sensitive billing configuration
- Deep compliance/admin controls
- Broad permission matrix editing

## Permission Model

Use gym-scoped permissions on top of base roles:

- Base roles: `leader`, `officer`, `coach`, `member`
- Per-gym role matrix: `gym_role_permissions`
- Per-user exceptions: `gym_user_permission_overrides`
- Runtime guard: `user_has_gym_permission(gym_id, permission_key, viewer)`

This lets owners/managers control exactly which functionalities staff can access by device and by module.

## B2C Model Confirmation

Keep global social graph behavior:

- single-gym membership or cross-gym/public mode
- global competition (e.g., Pavia vs Los Angeles users)
- public/followers/gym/private feed visibility remains enforced via RLS

## Rollout Steps (Pavia)

1. Launch PWA URL for pilot cohort and staff.
2. Run role/device access matrix for BZone and Wellness Zone.
3. Keep monetization and high-risk automations behind flags.
4. Measure 2-week pilot KPIs before native beta expansion.

## Sources

- [Apple TestFlight overview](https://developer.apple.com/testflight/)
- [Firebase App Distribution (contrast option)](https://firebase.google.com/docs/app-distribution)
- [Apple: Add website icon/home-screen web app](https://support.apple.com/en-il/guide/iphone/iph42ab2f3a7/ios)
- [Apple: Receive web app notifications on iPhone](https://support.apple.com/en-us/102516)
- [Apple: Add a web app to Home Screen on iPad](https://support.apple.com/guide/ipad/add-a-web-app-ipadf1af38eb/ipados)
