import { phase2StaffOpsChecklist } from "../flows/phase2-staff-ops";

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
    }
  };
}
