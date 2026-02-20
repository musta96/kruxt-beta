# KRUXT Business Plan Gap Analysis (2026-02-20)

## Decision Summary

KRUXT should continue with a foundation-complete beta and activation-controlled rollout:

- Build all critical contracts now (already done for most B2C/B2B/compliance/integration surfaces).
- Keep risky/revenue-sensitive modules behind flags (`billing_live`, non-priority connectors, ML).
- Optimize first for retention and trust loops, not feature count.

This aligns with your business plan wedge while still preserving your request for future-proof architecture.

## Traceability: Plan vs Build

| Area | Current State | Gap | Action |
|---|---|---|---|
| B2C core loop (log -> post -> rank -> challenge) | Implemented at schema/runtime/wiring level | Full production UI polish pending | Ship with Prompt Pack v2 and flow-by-flow QA |
| B2B gym ops (classes, waitlist, check-ins, waivers) | Implemented at schema/runtime/wiring level | Gym-level customization missing | Add `gym_brand_settings` + `gym_feature_settings` (added in new migration) |
| Payments/invoicing | Schema-ready for subscriptions/invoices/transactions/refunds | Invoicing adapter layer for country-specific flows missing | Add invoice provider/compliance/delivery tables (added in new migration) |
| Device integrations | Apple + Garmin active path; others modeled and flaggable | Provider activation playbooks still needed | Keep dark launch for Fitbit/Huawei/Suunto/WHOOP until reliability gates |
| Compliance US+EU | Consents/privacy requests/policy versioning/audit logs already present | Support/legal ops linkage and incident triage automation needed | Add support + agent-approval pipeline tables/RPC (added in new migration) |
| Support + maintenance ops | Incident/compliance runtime exists | End-user ticketing + 24/7 AI assist not fully modeled | Add ticket + message + automation-run tables/RPC (added in new migration) |

## Monetization Readiness

### B2C

- Freemium + Pro remains correct.
- iOS digital unlocks must stay compliant with Apple IAP policies.
- Early monetization should be tested only after core loop activation/retention is stable.

### B2B

- Keep gym SaaS modules as paid tiers.
- Add per-gym module controls so gyms can buy only what they use.
- Keep charging disabled by default in pilot until reliability/support SLAs are stable.

### B2B2C

- Gym community layer should remain a distribution wedge:
  - gym-scoped challenges
  - gym-scoped leaderboards
  - staff analytics panels

## Competitor Signals You Should Copy/Improve

### Core competitors from your uploaded PDFs

| Competitor | Strongest public signals | What KRUXT should copy | What KRUXT should improve | Integration potential |
|---|---|---|---|---|
| Strava | Segment/social feed loops, strong API ecosystem | Clean social proof and activity graph patterns | Strength-native PR/feed credibility, gym-scoped social layers | Strong candidate (public API) |
| Hevy | Fast lifting logger UX, clear progress history | Low-friction set logging and progression visuals | Guild/gym network effects + stronger B2B ops | Indirect (export/import), no broad public API guarantee |
| Strong | Mature strength logging UX and analytics | Speed-first logging ergonomics | Social/guild status systems + admin/gym operations | Limited (exports, no clear public API) |
| Fitbod | Personalized plans and adaptive recommendations | Plan-guided adherence loops | Verifiable social proof + gym operations + rank ladder | Limited direct integration; likely data-import oriented |
| MyFitnessPal | Massive nutrition DB + ecosystem integrations | Nutrition linkage as optional expansion pillar | Strength/gym social graph and anti-cheat ranking integrity | Partnership-style integrations; connector feasible later |
| SugarWOD | WOD flow + community + gym/box context | Class/WOD community engagement patterns | Richer B2B2C monetization and broader gym ops suite | Possible via partner/integration channels |
| Mindbody | Full fitness business operating suite | Strong booking/membership operational completeness | Better strength-first consumer habit loops and social proof | Good B2B integration candidate (developer platform) |
| PushPress | Gym CRM/ops, member lifecycle features | Practical staff tools and retention automations | Better consumer app engagement loop and rank gamification | Integration likely via partner/API pathways |
| Wodify | CrossFit/gym management + performance tracking | Coach + member workflow cohesion | More modern social feed/UX and modular feature controls | Integration likely possible for specific data flows |

### Adjacent references you also requested

| Competitor | Signal to watch | KRUXT response |
|---|---|---|
| Nike Run Club, Runna, Runkeeper | Coaching + habit loops + integration expectations | Keep onboarding/adherence quality high and integration roadmap explicit |
| Ladder, Playbook, Thenx | Program/community and creator models | Add creator/coach program layer later behind strong proof integrity |
| SmartWOD Timer | Utility-first interaction speed | Keep logging and class actions one-tap and under 60 seconds |
| Sportclubby | Localized gym management breadth | Keep modular B2B controls and localization-ready compliance |

## Payments Stack Decision (2026)

### Recommended default

- **Use Stripe as primary billing rail** for both B2C and B2B.
- Add **Stripe Billing + Connect** for subscriptions, invoicing, discounts, and platform revenue share patterns.
- Keep charging behind `billing_live = false` until pilot stability gates pass.

### Why not “build ad hoc payments now”

- Slower time-to-market.
- Higher PCI/compliance risk.
- Harder to maintain globally.
- Worse solo-founder operational overhead.

### Provider role split (pragmatic)

- **Stripe**: primary PSP/orchestration (cards, wallets, Apple Pay/Google Pay, PayPal, recurring logic).
- **Chargebee** (optional later): subscription operations overlay if you outgrow native billing ops.
- **Adyen/Braintree/Square**: only if enterprise/region-specific requirement justifies multi-processor complexity.
- **FINOM**: useful as banking/finance ops, not your core PSP for app billing orchestration.
- **Satispay**: evaluate as region-specific add-on once Italy volume justifies it.

### Marketplace and policy constraints

- iOS digital in-app features must follow Apple in-app purchase rules.
- Keep web/B2B checkout flows separate and compliant per channel.
- Model invoice compliance adapters now (already done) so Italy electronic invoicing and country-specific rules can activate later without schema rewrite.

### Pricing experiments + discounts (already modeled)

- B2C and B2B pricing A/B support via:
  - `public.pricing_experiments`
  - `public.pricing_experiment_variants`
  - `public.pricing_experiment_assignments`
- Campaign/offer support via:
  - `public.discount_campaigns`
  - `public.discount_redemptions`

This enables:

- price tests by segment
- gym-specific offers
- targeted or global discounts
- delayed activation of live charging without reworking data contracts

### Gyms paying KRUXT (SaaS billing)

- Feasible with the same provider stack (Stripe Billing/Connect recommended).
- Current schema is ready for gym-to-member and experiment/promo logic.
- Dedicated platform-billing table family is now added (`platform_plans`, `gym_platform_subscriptions`, `gym_platform_invoices`, `gym_platform_payment_transactions`, `gym_platform_refunds`).
- Keep activation behind `billing_live` until pilot reliability/support gates pass.

## New Entrant/Product Rollout Watchlist

- Running/coaching apps continue to deepen integration ecosystems and plan intelligence.
- Strength/community apps are pushing team accountability and creator-led programming.
- Gym software keeps expanding into all-in-one management suites.

Practical rule: treat unconfirmed rumors as non-actionable. Build only from public release notes, docs, and observed user behavior.

## PMF Reality Check

No team can guarantee PMF in advance. KRUXT can maximize PMF probability if this order is enforced:

1. Nail weekly repeat logging and feed interaction density.
2. Prove chain/rank loops create habit, not vanity-only spikes.
3. Prove gym ROI in pilot (engagement + class fill + retention signals).
4. Only then expand paid feature surface and active connector set.

## What Was Missing and Is Now Added to Schema

New migration added:

- Gym customization:
  - `public.gym_brand_settings`
  - `public.gym_feature_settings`
- Billing/invoicing adapters:
  - `public.invoice_provider_connections`
  - `public.invoice_compliance_profiles`
  - `public.invoice_delivery_jobs`
- Support + 24/7 agent ops:
  - `public.support_tickets`
  - `public.support_ticket_messages`
  - `public.support_automation_runs`
  - RPCs `public.submit_support_ticket(...)`, `public.approve_support_automation_run(...)`
- Monetization experiments + promotions:
  - `public.consumer_plans`
  - `public.consumer_plan_prices`
  - `public.consumer_entitlements`
  - `public.pricing_experiments`
  - `public.pricing_experiment_variants`
  - `public.pricing_experiment_assignments`
  - `public.discount_campaigns`
  - `public.discount_redemptions`
- Gym SaaS billing (platform revenue side):
  - `public.platform_plans`
  - `public.gym_platform_subscriptions`
  - `public.gym_platform_invoices`
  - `public.gym_platform_payment_transactions`
  - `public.gym_platform_refunds`
- Founder control-plane + governance:
  - `public.platform_operator_accounts`
  - `public.gym_support_access_grants`
  - `public.gym_support_access_sessions`
  - `public.platform_kpi_daily_snapshots`
  - `public.platform_feature_overrides`
  - `public.user_data_sharing_preferences`
  - `public.data_partners`
  - `public.data_products`
  - `public.data_partner_access_grants`
  - `public.data_partner_exports`
- Account security:
  - `public.user_security_settings`
  - `public.user_trusted_devices`
  - `public.user_auth_events`
- B2B2C add-ons + partner/data ops:
  - `public.gym_addon_catalog`
  - `public.gym_addon_subscriptions`
  - `public.gym_advanced_analytics_views`
  - `public.gym_automation_playbooks`
  - `public.gym_automation_runs`
  - `public.partner_marketplace_apps`
  - `public.gym_partner_app_installs`
  - `public.partner_revenue_events`
  - `public.data_aggregation_jobs`
  - `public.data_anonymization_checks`
  - `public.data_release_approvals`

## Linkage You Need (Lovable <-> Repo <-> Supabase)

1. Keep Supabase as source of truth for auth/db/functions.
2. Connect Lovable to your GitHub repo and generate only UI layers/components.
3. Wire generated UI to existing typed flows/services in this monorepo.
4. Never let Lovable generate ad-hoc backend schema outside SQL migrations.
5. Enforce merge gates with lint/typecheck/tests before release flags are enabled.

Use this prompt pack: `docs/lovable/prompts-beta-master-pack-v2.md`
Pilot channel strategy: `docs/strategy/pavia-pilot-distribution-and-surface-strategy-2026-02-20.md`
Founder control-plane strategy: `docs/strategy/platform-control-plane-and-governance-2026-02-20.md`
Revenue extension strategy: `docs/strategy/revenue-extensions-foundation-2026-02-20.md`

## Recommended Execution Order (From Today)

1. Apply latest migration set including part5 customization/support + monetization foundations.
2. Build Lovable UI modules in prompt order and wire each to existing runtime contracts.
3. Launch closed pilot with billing disabled and Apple/Garmin only.
4. Stand up support-agent workflow with approval queue before wider rollout.
5. Run KPI gates weekly and only then expand paid modules/provider activations.

## Sources

- [Lovable GitHub integration](https://docs.lovable.dev/tips-tricks/lovable-github-integration)
- [Lovable Supabase integration](https://docs.lovable.dev/integrations/supabase)
- [Lovable Stripe integration](https://docs.lovable.dev/integrations/stripe)
- [Lovable prompting best practices](https://docs.lovable.dev/tips-tricks/prompting-lovable)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Strava subscription features](https://support.strava.com/hc/en-us/articles/216917657-Strava-Subscription-Features)
- [Strava API reference](https://developers.strava.com/docs/reference/)
- [Strava webhooks](https://developers.strava.com/docs/webhooks/)
- [Strava API agreement update](https://press.strava.com/articles/updates-to-stravas-api-agreement)
- [Hevy app](https://www.hevyapp.com/)
- [Hevy social features](https://www.hevyapp.com/features/social-features/)
- [Hevy import/export (Strong CSV)](https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy)
- [Strong app feature page](https://www.strong.app/)
- [Strong CSV export](https://help.strongapp.io/article/235-export-workout-data)
- [Fitbod integrations](https://fitbod.zendesk.com/hc/en-us/sections/35305345636375-Integrations)
- [MyFitnessPal App Gallery linking](https://support.myfitnesspal.com/hc/en-us/articles/360032273332-How-do-I-link-or-unlink-MyFitnessPal-with-an-App-Gallery-partner)
- [MyFitnessPal Apple Health integration](https://support.myfitnesspal.com/hc/en-us/articles/360032271092-How-do-I-Link-or-Unlink-MyFitnessPal-with-Apples-HealthKit)
- [MyFitnessPal Garmin integration](https://support.myfitnesspal.com/hc/en-us/articles/360040110912-Garmin-Connect-FAQ-and-Troubleshooting)
- [SugarWOD athlete features](https://www.sugarwod.com/athlete-features/)
- [SugarWOD owner features](https://www.sugarwod.com/owner-features/)
- [SugarWOD developers API docs](https://app.sugarwod.com/developers-api-docs)
- [Mindbody developer tools](https://www.mindbodyonline.com/index.php/business/developer-tools)
- [Mindbody API FAQs](https://developers.mindbodyonline.com/resources/faqs)
- [Mindbody athletic club software](https://www.mindbodyonline.com/business/fitness/athletic-club-software)
- [PushPress features](https://www.pushpress.com/features)
- [PushPress integrations](https://www.pushpress.com/integrations)
- [PushPress integrations hub help](https://help.pushpress.com/en/articles/12631598-how-to-use-pushpress-integrations-hub)
- [Wodify integrations](https://www.wodify.com/integrations)
- [Wodify pricing](https://www.wodify.com/pricing)
- [Wodify Program API](https://help.wodify.com/hc/en-us/articles/209425797-Wodify-s-Program-API)
- [Wodify payments](https://www.wodify.com/products/payments)
- [Sportclubby](https://www.sportclubby.com/es)
- [Stripe payment methods overview](https://docs.stripe.com/payments/payment-methods/overview)
- [Stripe discounts](https://docs.stripe.com/payments/advanced/discounts)
- [Stripe coupons & promotion codes](https://docs.stripe.com/billing/subscriptions/coupons)
- [Stripe A/B testing for payment methods](https://docs.stripe.com/payments/a-b-testing)
- [Stripe Connect (SaaS)](https://docs.stripe.com/connect/enable-payment-acceptance-guide)
- [Adyen payment methods](https://docs.adyen.com/payment-methods/)
- [Adyen tokenization](https://docs.adyen.com/online-payments/tokenization)
- [Braintree recurring billing overview](https://developer.paypal.com/braintree/docs/guides/recurring-billing/overview/)
- [Braintree local payment methods overview](https://developer.paypal.com/braintree/docs/guides/local-payment-methods/overview)
- [Square subscriptions API](https://developer.squareup.com/docs/subscriptions-api/overview)
- [Chargebee subscriptions API](https://apidocs.chargebee.com/docs/api/subscriptions)
- [Chargebee subscriptions docs](https://www.chargebee.com/docs/billing/1.0/subscriptions/subscriptions)
- [FINOM business account](https://finom.co/)
- [FINOM iDEAL help article](https://help.finom.co/en/articles/11983052-how-to-create-a-payment-via-ideal-from-your-finom-account)
- [AGID - Sistema di Interscambio](https://www.agid.gov.it/it/piattaforme/sistema-interscambio)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/)
- [Fitbit OAuth guidance](https://dev.fitbit.com/build/reference/web-api/developer-guide/application-design/#oauth-2-0)
- [Huawei Health Kit](https://developer.huawei.com/consumer/en/hms/huaweihealth/)
- [Suunto developer portal](https://developer.suunto.com/)
- [WHOOP developer docs](https://developer.whoop.com/docs/developing/user-data)
- [Intercom Fin](https://www.intercom.com/fin)
- [Zendesk AI agents](https://www.zendesk.it/service/ai/)
- [Runna features](https://www.runna.com/features)
- [Runkeeper (ASICS)](https://www.asics.com/us/en-us/runkeeper/)
- [Nike Run Club (App Store)](https://apps.apple.com/us/app/nike-run-club-running-coach/id387771637)
- [Thenx (App Store)](https://apps.apple.com/us/app/thenx/id1209555066)
- [Ladder app](https://www.joinladder.com/app)
- [Playbook community docs](https://help.playbookapp.io/en/articles/9486408-build-your-in-app-community)
- [SmartWOD Timer](https://smartwod.app/wod-timer/)
