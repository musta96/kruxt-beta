# KRUXT Revenue Extensions Foundation (2026-02-20)

## Scope Added

This foundation adds runtime-ready schema for:

1. B2B2C add-ons (advanced analytics/workforce/automation modules).
2. Partner ecosystem revenue (marketplace apps + install tracking + revenue events).
3. Governed aggregate data-product operations (aggregation jobs, anonymization checks, release approvals).

Migration:

- `packages/db/supabase/migrations/202602200007_krux_beta_part5_s007_addons_partner_dataops.sql`

## Operational Outcome

You can eventually run most operational and monetization controls from the platform control plane, including:

- add-on catalog and gym add-on activation
- automation playbook lifecycle
- partner app catalog/install oversight
- partner revenue recognition dashboards
- governed aggregate data export approvals

Feature building still follows code/migration workflow.  
Operational tuning and policy controls can increasingly be handled through control-plane UI.

## Compliance Posture

- Data-product flows are modeled with explicit anonymization checks and release approvals.
- Aggregate-anonymous exports remain the safe default.
- Pseudonymous/export flows require governance approval and legal basis controls.

## Recommended Activation Order

1. Add-ons for analytics/workforce (low legal risk, high B2B value).
2. Partner marketplace installs and revenue tracking.
3. Aggregate data products with strict governance gates.
4. Pseudonymous flows only after legal review and mature controls.
