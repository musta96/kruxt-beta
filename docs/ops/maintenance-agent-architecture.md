# KRUXT 24/7 Maintenance + Support Agent Architecture

## Objective

Provide continuous support and ops triage while keeping high-risk actions human-approved.

## Recommended Stack

### Core

- **Ticket front door**: Intercom or Zendesk (chat, email, web form, help center).
- **Issue system of record**: GitHub Issues (engineering) + optional Linear for product triage.
- **Automation/orchestration**: n8n (or equivalent workflow engine) for deterministic pipelines.
- **AI reasoning layer**: LLM-based triage/summarization agent.
- **Backend**: Supabase tables/RPC for ticket state, approval state, and audit logs.
- **Notifications**: Slack + email for approvals and incident escalation.

### Why this stack

- Fast to operate as solo founder.
- Strong human-in-the-loop controls.
- Clear auditability for legal and operational review.

## Workflow Design

### 1) Intake

1. User/gym opens ticket from app or support channel.
2. Ticket is persisted in `public.support_tickets`.
3. Initial message is stored in `public.support_ticket_messages`.

### 2) AI Triage

1. Agent reads ticket + account context + recent incidents.
2. Agent writes:
   - concise summary
   - severity
   - probable root cause
   - recommended next action
   - confidence score
3. Output is written to `public.support_automation_runs`.

### 3) Approval Gate

1. If proposed action is low-risk (knowledge-base response only), auto-send reply.
2. If proposed action changes data/permissions/integrations, require approval.
3. Founder receives approval request with:
   - plain-language explanation
   - technical explanation
   - rollback plan

### 4) Execution

1. Approved actions run via constrained playbooks (no freeform prod shell by default).
2. Every action appends audit entries.
3. Ticket status and user-facing message are updated automatically.

### 5) Post-Resolution

1. Agent creates bug/incident issue if needed.
2. Root-cause and prevention notes are attached.
3. KPI events are emitted for support SLA and recurrence tracking.

## Guardrails (Non-Negotiable)

- No direct destructive DB actions from agent without explicit approval.
- No policy/privacy state mutation without staff authorization.
- All automated actions must be reversible or have rollback playbook.
- Every run produces structured logs and immutable audit trail.

## Suggested Agent Roles

1. **Triage Agent**
   - Classifies, summarizes, and prioritizes tickets.
2. **Knowledge Agent**
   - Drafts user-facing responses from docs/runbooks.
3. **Ops Agent**
   - Executes approved low-risk remediation playbooks.
4. **Incident Agent**
   - Handles Sev-1/Sev-2 routing and escalation timelines.

## Playbook Catalog (Start Here)

1. Auth/login issues
2. Workout log submit failures
3. Feed visibility/report/block disputes
4. Class booking/waitlist inconsistencies
5. Integration sync failures (Apple/Garmin first)
6. Privacy request status clarification
7. Billing access or invoice delivery failures (once activated)

## KPI + SLO Targets

- First response time:
  - P1/P2: < 15 minutes
  - P3/P4: < 4 hours
- Resolution time:
  - P1: < 4 hours
  - P2: < 24 hours
  - P3/P4: < 72 hours
- AI triage acceptance rate by human reviewer: > 70%
- Reopened ticket rate: < 10%

## Implementation Steps

1. Enable the new support schema migration.
2. Add in-app Support Center UI (mobile + admin) using prompt pack v2.
3. Connect intake webhooks from Intercom/Zendesk to Supabase edge function.
4. Implement triage agent workflow in n8n:
   - intake trigger
   - summary/classification
   - approval route
   - execution route
5. Send approval requests to Slack/email with action buttons.
6. Add weekly support quality review and playbook updates.

## Recommended First Release Scope

- AI triage + summary + suggested response.
- Human approval mandatory for all non-read-only actions.
- Automatic user updates only for approved responses.
- Escalation routing for Sev-1 incidents.
