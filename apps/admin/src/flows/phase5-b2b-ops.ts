import type {
  AccessLog,
  ClassBooking,
  ClassWaitlistEntry,
  Contract,
  DunningEvent,
  GymCheckin,
  GymClass,
  GymMembershipPlan,
  Invoice,
  MemberSubscription,
  PaymentTransaction,
  Refund,
  Waiver
} from "@kruxt/types";

import { B2BOpsService, createAdminSupabaseClient } from "../services";

export interface Phase5B2BOpsLoadOptions {
  classId?: string;
  includeInactivePlans?: boolean;
  includeInactiveWaivers?: boolean;
  includeInactiveContracts?: boolean;
}

export interface Phase5B2BOpsSnapshot {
  membershipPlans: GymMembershipPlan[];
  classes: GymClass[];
  selectedClassId?: string;
  selectedClassBookings: ClassBooking[];
  selectedClassWaitlist: ClassWaitlistEntry[];
  waivers: Waiver[];
  contracts: Contract[];
  recentCheckins: GymCheckin[];
  recentAccessLogs: AccessLog[];
  subscriptions: MemberSubscription[];
  invoices: Invoice[];
  paymentTransactions: PaymentTransaction[];
  refunds: Refund[];
  dunningEvents: DunningEvent[];
}

export const phase5B2BOpsChecklist = [
  "Load membership plans",
  "Load classes and waitlist state",
  "Load waiver and contract evidence",
  "Load check-in and access logs",
  "Load subscription, invoice, and payment telemetry"
] as const;

function selectDefaultClassId(classes: GymClass[], preferredClassId?: string): string | undefined {
  if (preferredClassId && classes.some((gymClass) => gymClass.id === preferredClassId)) {
    return preferredClassId;
  }

  const scheduled = classes.find((gymClass) => gymClass.status === "scheduled");
  return scheduled?.id ?? classes[0]?.id;
}

export function createPhase5B2BOpsFlow() {
  const supabase = createAdminSupabaseClient();
  const service = new B2BOpsService(supabase);

  return {
    checklist: phase5B2BOpsChecklist,
    load: async (gymId: string, options: Phase5B2BOpsLoadOptions = {}): Promise<Phase5B2BOpsSnapshot> => {
      const [
        membershipPlans,
        classes,
        waivers,
        contracts,
        recentCheckins,
        recentAccessLogs,
        subscriptions,
        invoices,
        paymentTransactions,
        refunds,
        dunningEvents
      ] = await Promise.all([
        service.listMembershipPlans(gymId, options.includeInactivePlans ?? true),
        service.listGymClasses(gymId, 100),
        service.listWaivers(gymId, options.includeInactiveWaivers ?? true),
        service.listContracts(gymId, options.includeInactiveContracts ?? true),
        service.listRecentCheckins(gymId, 150),
        service.listRecentAccessLogs(gymId, 150),
        service.listMemberSubscriptions(gymId, 200),
        service.listInvoices(gymId, 200),
        service.listPaymentTransactions(gymId, 200),
        service.listRefunds(gymId, 200),
        service.listDunningEvents(gymId, 200)
      ]);

      const selectedClassId = selectDefaultClassId(classes, options.classId);
      const [selectedClassBookings, selectedClassWaitlist] = selectedClassId
        ? await Promise.all([
            service.listClassBookings(gymId, selectedClassId, 200),
            service.listClassWaitlist(gymId, selectedClassId, 200)
          ])
        : [[], []];

      return {
        membershipPlans,
        classes,
        selectedClassId,
        selectedClassBookings,
        selectedClassWaitlist,
        waivers,
        contracts,
        recentCheckins,
        recentAccessLogs,
        subscriptions,
        invoices,
        paymentTransactions,
        refunds,
        dunningEvents
      };
    }
  };
}
