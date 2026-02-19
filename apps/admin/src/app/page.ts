export function adminHomePageScaffold() {
  return {
    title: "KRUXT Guild Hall Admin",
    description: "Manage memberships, classes, waivers, contracts, and operations.",
    brandRule: "Proof counts. Rank is earned weekly.",
    phase2: {
      modules: [
        "Staff access validation",
        "Membership approvals",
        "Gym role assignment",
        "Consent visibility",
        "Privacy request triage"
      ],
      serviceSurface: [
        "GymAdminService.listGymMemberships",
        "GymAdminService.approveMembership",
        "GymAdminService.assignMembershipRole",
        "GymAdminService.listUserConsentRecords"
      ]
    }
  };
}
