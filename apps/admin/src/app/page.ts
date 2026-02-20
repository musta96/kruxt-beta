import { phase2StaffConsoleUiChecklist } from "../flows/phase2-staff-console-ui";
import { phase6IntegrationMonitorChecklist } from "../flows/phase6-integration-monitor";
import { phase5OpsConsoleUiChecklist } from "../flows/phase5-ops-console-ui";
import { phase8ComplianceOpsChecklist } from "../flows/phase8-compliance-ops";
import { phase10CustomizationSupportChecklist } from "../flows/phase10-customization-support";
import { phase10PlatformControlPlaneChecklist } from "../flows/phase10-platform-control-plane";
import { phase10PlatformControlPlaneUiChecklist } from "../flows/phase10-platform-control-plane-ui";

export function adminHomePageScaffold() {
  return {
    title: "KRUXT Guild Hall Admin",
    description: "Manage memberships, classes, waivers, contracts, and operations.",
    brandRule: "Proof counts. Rank is earned weekly.",
    phase2: {
      modules: [...phase2StaffConsoleUiChecklist],
      screenFlow: "staff access gate -> membership queue -> approve/reject -> role assignment -> refreshed snapshot",
      recoverableErrors: [
        "ADMIN_MEMBERSHIP_UPDATE_FAILED",
        "ADMIN_ROLE_ASSIGN_FAILED",
        "ADMIN_PENDING_MEMBERSHIPS_FAILED"
      ],
      serviceSurface: [
        "GymAdminService.getGymOpsSummary",
        "GymAdminService.listGymMemberships",
        "GymAdminService.listPendingMemberships",
        "GymAdminService.listPendingWaitlistEntries",
        "GymAdminService.listUpcomingClasses",
        "GymAdminService.approveMembership",
        "GymAdminService.updateMembershipStatus",
        "GymAdminService.assignMembershipRole",
        "GymAdminService.listUserConsentRecords",
        "GymAdminService.listOpenPrivacyRequests"
      ]
    },
    phase5: {
      modules: [...phase5OpsConsoleUiChecklist],
      screenFlow:
        "class schedule -> bookings/waitlist -> check-in/access -> waiver/contract evidence -> refreshed snapshot",
      recoverableErrors: [
        "ADMIN_CLASS_CREATE_FAILED",
        "ADMIN_CLASS_BOOKING_UPSERT_FAILED",
        "ADMIN_CLASS_WAITLIST_UPDATE_FAILED",
        "ADMIN_WAITLIST_PROMOTE_FAILED",
        "ADMIN_CHECKIN_CREATE_FAILED",
        "ADMIN_ACCESS_LOG_CREATE_FAILED",
        "ADMIN_WAIVER_ACCEPTANCE_RECORD_FAILED",
        "ADMIN_CONTRACT_ACCEPTANCE_RECORD_FAILED"
      ],
      serviceSurface: [
        "createPhase5OpsConsoleUiFlow.load",
        "createPhase5OpsConsoleUiFlow.createClass",
        "createPhase5OpsConsoleUiFlow.upsertClassBooking",
        "createPhase5OpsConsoleUiFlow.promoteWaitlistMember",
        "createPhase5OpsConsoleUiFlow.recordCheckinAndAccessLog",
        "createPhase5OpsConsoleUiFlow.recordWaiverAcceptance",
        "createPhase5OpsConsoleUiFlow.recordContractAcceptance",
        "B2BOpsService.listMemberSubscriptions",
        "B2BOpsService.listInvoices",
        "B2BOpsService.listPaymentTransactions",
        "B2BOpsService.listRefunds",
        "B2BOpsService.listDunningEvents"
      ]
    },
    phase6: {
      modules: [...phase6IntegrationMonitorChecklist],
      serviceSurface: [
        "IntegrationMonitorService.getSummary",
        "IntegrationMonitorService.listConnectionHealth",
        "IntegrationMonitorService.listRecentSyncFailures"
      ]
    },
    phase8: {
      modules: [...phase8ComplianceOpsChecklist],
      serviceSurface: [
        "GymAdminService.listOpenPrivacyRequests",
        "GymAdminService.listActivePolicyVersions",
        "GymAdminService.getPrivacyOpsMetrics",
        "GymAdminService.transitionPrivacyRequest"
      ]
    },
    phase10CustomizationSupport: {
      modules: [...phase10CustomizationSupportChecklist],
      screenFlow: "branding/feature toggles -> invoice adapters -> support queue/thread -> automation approvals",
      recoverableErrors: [
        "ADMIN_GYM_BRAND_SETTINGS_UPSERT_FAILED",
        "ADMIN_GYM_FEATURE_SETTING_UPSERT_FAILED",
        "ADMIN_INVOICE_PROVIDER_CONNECTION_UPSERT_FAILED",
        "ADMIN_INVOICE_COMPLIANCE_PROFILE_UPSERT_FAILED",
        "ADMIN_SUPPORT_TICKET_SUBMIT_FAILED",
        "ADMIN_SUPPORT_AUTOMATION_RUN_APPROVAL_FAILED"
      ],
      serviceSurface: [
        "createPhase10CustomizationSupportFlow.load",
        "createPhase10CustomizationSupportFlow.upsertBrandSettings",
        "createPhase10CustomizationSupportFlow.upsertFeatureSetting",
        "createPhase10CustomizationSupportFlow.upsertInvoiceProviderConnection",
        "createPhase10CustomizationSupportFlow.upsertInvoiceComplianceProfile",
        "createPhase10CustomizationSupportFlow.submitSupportTicket",
        "createPhase10CustomizationSupportFlow.approveSupportAutomationRun"
      ]
    },
    phase10ControlPlane: {
      modules: [...phase10PlatformControlPlaneChecklist],
      screenFlow: "overview -> operator/security governance -> delegated support access -> add-ons/partner/data-ops",
      recoverableErrors: [
        "ADMIN_PLATFORM_OVERVIEW_READ_FAILED",
        "ADMIN_PLATFORM_OPERATOR_ACCOUNT_UPSERT_FAILED",
        "ADMIN_SUPPORT_ACCESS_GRANT_CREATE_FAILED",
        "ADMIN_PLATFORM_FEATURE_OVERRIDE_UPSERT_FAILED",
        "ADMIN_DATA_PARTNER_ACCESS_GRANT_UPSERT_FAILED",
        "ADMIN_GYM_ADDON_SUBSCRIPTION_UPSERT_FAILED",
        "ADMIN_PARTNER_REVENUE_EVENT_CREATE_FAILED",
        "ADMIN_DATA_RELEASE_APPROVAL_UPSERT_FAILED"
      ],
      serviceSurface: [
        "createPhase10PlatformControlPlaneFlow.load",
        "createPhase10PlatformControlPlaneFlow.upsertOperatorAccount",
        "createPhase10PlatformControlPlaneFlow.createSupportAccessGrant",
        "createPhase10PlatformControlPlaneFlow.upsertFeatureOverride",
        "createPhase10PlatformControlPlaneFlow.createDataPartner",
        "createPhase10PlatformControlPlaneFlow.upsertDataPartnerAccessGrant",
        "createPhase10PlatformControlPlaneFlow.upsertAddonSubscription",
        "createPhase10PlatformControlPlaneFlow.createPartnerRevenueEvent",
        "createPhase10PlatformControlPlaneFlow.upsertDataReleaseApproval"
      ]
    },
    phase10ControlPlaneUi: {
      modules: [...phase10PlatformControlPlaneUiChecklist],
      screenFlow: "summary cards -> alert rail -> domain board actions -> mutation -> refreshed UI snapshot",
      serviceSurface: [
        "createPhase10PlatformControlPlaneUiFlow.load",
        "createPhase10PlatformControlPlaneUiFlow.upsertOperatorAccount",
        "createPhase10PlatformControlPlaneUiFlow.createSupportAccessGrant",
        "createPhase10PlatformControlPlaneUiFlow.upsertFeatureOverride",
        "createPhase10PlatformControlPlaneUiFlow.upsertDataReleaseApproval"
      ]
    }
  };
}
