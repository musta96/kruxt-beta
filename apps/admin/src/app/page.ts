import { phase2StaffOpsChecklist } from "../flows/phase2-staff-ops";
import { phase6IntegrationMonitorChecklist } from "../flows/phase6-integration-monitor";
import { phase5B2BOpsChecklist } from "../flows/phase5-b2b-ops";
import { phase8ComplianceOpsChecklist } from "../flows/phase8-compliance-ops";

export function adminHomePageScaffold() {
  return {
    title: "KRUXT Guild Hall Admin",
    description: "Manage memberships, classes, waivers, contracts, and operations.",
    brandRule: "Proof counts. Rank is earned weekly.",
    phase2: {
      modules: [...phase2StaffOpsChecklist],
      serviceSurface: [
        "GymAdminService.getGymOpsSummary",
        "GymAdminService.listGymMemberships",
        "GymAdminService.listPendingMemberships",
        "GymAdminService.listPendingWaitlistEntries",
        "GymAdminService.listUpcomingClasses",
        "GymAdminService.approveMembership",
        "GymAdminService.assignMembershipRole",
        "GymAdminService.listUserConsentRecords",
        "GymAdminService.listOpenPrivacyRequests"
      ]
    },
    phase5: {
      modules: [...phase5B2BOpsChecklist],
      serviceSurface: [
        "B2BOpsService.listMembershipPlans",
        "B2BOpsService.createGymClass",
        "B2BOpsService.listClassBookings",
        "B2BOpsService.listClassWaitlist",
        "B2BOpsService.promoteWaitlistMember",
        "B2BOpsService.listWaivers",
        "B2BOpsService.recordWaiverAcceptanceByStaff",
        "B2BOpsService.listContracts",
        "B2BOpsService.recordContractAcceptanceByStaff",
        "B2BOpsService.recordCheckin",
        "B2BOpsService.recordAccessLog",
        "B2BOpsService.listMemberSubscriptions",
        "B2BOpsService.listInvoices"
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
