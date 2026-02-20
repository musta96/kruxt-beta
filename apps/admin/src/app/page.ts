import { phase2StaffConsoleUiChecklist } from "../flows/phase2-staff-console-ui";
import { phase6IntegrationMonitorChecklist } from "../flows/phase6-integration-monitor";
import { phase5OpsConsoleUiChecklist } from "../flows/phase5-ops-console-ui";
import { phase8ComplianceOpsChecklist } from "../flows/phase8-compliance-ops";

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
    }
  };
}
