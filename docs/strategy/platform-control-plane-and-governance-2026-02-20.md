# KRUXT Founder Control Plane + Governance Strategy (2026-02-20)

## Purpose

Define the platform-level interface above all gyms/users, with legal-by-design access controls and auditable operations.

## Founder Control Plane Scope

The control plane should provide:

1. Global platform overview (users, gyms, growth, health metrics).
2. Global feature override controls (with safe rollout percentages).
3. Operator account and permission management.
4. Delegated gym support access with explicit approval and time limits.
5. Data governance workflows for analytics/data products.
6. Compliance oversight dashboards and incident/ticket visibility.

Implemented foundations are now in migration:

- `packages/db/supabase/migrations/202602200005_krux_beta_part5_s005_platform_control_plane_governance.sql`
- `packages/db/supabase/migrations/202602200006_krux_beta_part5_s006_account_security_foundations.sql`

## Access Model (Legal + Trust)

Do not use unrestricted “god mode” access for day-to-day operations.

Use this hierarchy:

1. Platform operator role grants base capability.
2. Sensitive gym-level access requires a delegated support grant:
   - explicit reason
   - approved by gym manager/owner (or compliant emergency policy path)
   - scope-limited permissions
   - start/end timestamps
3. Actual access occurs via logged support sessions.
4. All actions remain auditable.

This protects gyms while still letting you help when they request support.

## Compliance Baseline

### Data protection

- Keep privacy-by-design/default controls active.
- Separate PII-sensitive flows from aggregate analytics.
- Keep immutable audit trails for high-risk actions.
- Enforce purpose limitation and data minimization.

### Health/sensitive data handling

- Treat health-related signals as high-risk category.
- Use explicit consent where required.
- Keep support and export actions approval-gated.

## Data Monetization Position

Data monetization can be a revenue stream, but only if implemented with strong governance.

### Recommended default

- Primary route: **aggregate anonymous insights** products.
- Secondary route: tightly controlled pseudonymous research products with explicit legal review.
- Avoid default reliance on identifiable-level data sales.

### Required controls before external data products

1. Partner contracts + DPA validation.
2. Product-level rules (`min_k_anonymity`, allowed metrics, retention).
3. Approval workflow for each export.
4. User preference controls and consent linkage where required.
5. Region-aware policy enforcement (EU/US differences).

## Revenue Streams (Low UX Damage, Higher Trust)

Prioritize:

1. B2B SaaS subscriptions (gym ops modules).
2. B2C premium tiers (advanced analytics, advanced programs).
3. B2B2C upsells (white-label modules, advanced staff intelligence).
4. Partner ecosystem revenue (integrations/marketplace/affiliate).
5. Controlled data products (aggregate anonymized only at first).

This order preserves user/gym trust while improving monetization resilience.

## How You Implement Changes Going Forward

Use three change paths:

1. **Config/flag changes** (fastest):
   - do from admin/control-plane UI
   - no deployment required
2. **UI/flow changes**:
   - generate/update with Lovable prompts
   - wire/fix in Cursor/Codex
3. **Schema/runtime logic changes**:
   - add SQL migration + typed contracts + tests
   - deploy through repo workflow

Operationally, yes: you can continue requesting changes in this chat and I will translate them into migrations/code/docs in the repo.  
Later, you can also add an internal “change request” form in the control plane that creates GitHub issues automatically.

## Sources

- [EU Commission: What are my rights? (GDPR)](https://commission.europa.eu/law/law-topic/data-protection/reform/rights-citizens/my-rights_en)
- [EU Commission: Data minimisation](https://commission.europa.eu/law/law-topic/data-protection/reform/rules-business-and-organisations/principles-gdpr/how-does-gdpr-affect-small-and-medium-enterprises-smes/data-minimisation_en)
- [EDPB: Anonymisation techniques](https://www.edpb.europa.eu/sme-data-protection-guide/faq-frequently-asked-questions/answer/what-anonymisation_en)
- [FTC Health Breach Notification Rule update (2024)](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule)
- [California AG: CCPA](https://oag.ca.gov/privacy/ccpa)
- [Washington AG: My Health My Data Act](https://www.atg.wa.gov/my-health-my-data-act)
