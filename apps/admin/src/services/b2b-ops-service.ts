import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessLog,
  AdminRecordAcceptanceInput,
  ClassBooking,
  ClassWaitlistEntry,
  Contract,
  ContractAcceptance,
  CreateContractInput,
  CreateGymClassInput,
  CreateMembershipPlanInput,
  CreateWaiverInput,
  DunningEvent,
  GymCheckin,
  GymClass,
  GymMembershipPlan,
  Invoice,
  MemberSubscription,
  PaymentTransaction,
  RecordAccessLogInput,
  RecordGymCheckinInput,
  Refund,
  UpsertClassBookingInput,
  UpsertMemberSubscriptionInput,
  UpdateClassWaitlistInput,
  UpdateContractInput,
  UpdateDunningEventInput,
  UpdateGymClassInput,
  UpdateInvoiceInput,
  UpdateMembershipPlanInput,
  UpdateWaiverInput,
  Waiver,
  WaiverAcceptance
} from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type GymMembershipPlanRow = {
  id: string;
  gym_id: string;
  name: string;
  billing_cycle: GymMembershipPlan["billingCycle"];
  price_cents: number;
  currency: string;
  class_credits_per_cycle: number | null;
  trial_days: number | null;
  cancel_policy: string | null;
  provider_product_id: string | null;
  provider_price_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type GymClassRow = {
  id: string;
  gym_id: string;
  coach_user_id: string | null;
  title: string;
  description: string | null;
  capacity: number;
  status: GymClass["status"];
  starts_at: string;
  ends_at: string;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClassBookingRow = {
  id: string;
  class_id: string;
  user_id: string;
  status: ClassBooking["status"];
  booked_at: string;
  checked_in_at: string | null;
  source_channel: string;
  updated_at: string;
};

type ClassWaitlistRow = {
  id: string;
  class_id: string;
  user_id: string;
  position: number;
  status: ClassWaitlistEntry["status"];
  notified_at: string | null;
  expires_at: string | null;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
};

type WaiverRow = {
  id: string;
  gym_id: string;
  title: string;
  policy_version: string;
  language_code: string;
  document_url: string;
  is_active: boolean;
  effective_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type WaiverAcceptanceRow = {
  id: string;
  waiver_id: string;
  user_id: string;
  gym_membership_id: string | null;
  accepted_at: string;
  source: string;
  locale: string | null;
  signature_data: Record<string, unknown>;
  created_at: string;
};

type ContractRow = {
  id: string;
  gym_id: string;
  title: string;
  contract_type: string;
  policy_version: string;
  language_code: string;
  document_url: string;
  is_active: boolean;
  effective_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ContractAcceptanceRow = {
  id: string;
  contract_id: string;
  user_id: string;
  gym_membership_id: string | null;
  accepted_at: string;
  source: string;
  locale: string | null;
  signature_data: Record<string, unknown>;
  created_at: string;
};

type GymCheckinRow = {
  id: string;
  gym_id: string;
  user_id: string;
  membership_id: string | null;
  class_id: string | null;
  event_type: GymCheckin["eventType"];
  result: GymCheckin["result"];
  source_channel: string;
  note: string | null;
  checked_in_at: string;
  created_by: string | null;
  created_at: string;
};

type AccessLogRow = {
  id: string;
  gym_id: string;
  user_id: string | null;
  checkin_id: string | null;
  event_type: AccessLog["eventType"];
  result: AccessLog["result"];
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
};

type MemberSubscriptionRow = {
  id: string;
  gym_id: string;
  user_id: string;
  membership_plan_id: string | null;
  status: MemberSubscription["status"];
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type InvoiceRow = {
  id: string;
  subscription_id: string | null;
  gym_id: string;
  user_id: string;
  provider_invoice_id: string | null;
  status: Invoice["status"];
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  due_at: string | null;
  paid_at: string | null;
  invoice_pdf_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PaymentTransactionRow = {
  id: string;
  invoice_id: string | null;
  subscription_id: string | null;
  gym_id: string;
  user_id: string | null;
  provider: string;
  provider_payment_intent_id: string | null;
  provider_charge_id: string | null;
  status: PaymentTransaction["status"];
  payment_method_type: string | null;
  amount_cents: number;
  fee_cents: number;
  tax_cents: number;
  net_cents: number;
  currency: string;
  failure_code: string | null;
  failure_message: string | null;
  captured_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type RefundRow = {
  id: string;
  payment_transaction_id: string;
  provider_refund_id: string | null;
  status: Refund["status"];
  amount_cents: number;
  currency: string;
  reason: string | null;
  processed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DunningEventRow = {
  id: string;
  subscription_id: string;
  invoice_id: string | null;
  stage: DunningEvent["stage"];
  attempt_number: number;
  scheduled_for: string | null;
  sent_at: string | null;
  result: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymMembershipLinkRow = {
  id: string;
  gym_id: string;
  user_id: string;
};

function mapPlan(row: GymMembershipPlanRow): GymMembershipPlan {
  return {
    id: row.id,
    gymId: row.gym_id,
    name: row.name,
    billingCycle: row.billing_cycle,
    priceCents: row.price_cents,
    currency: row.currency,
    classCreditsPerCycle: row.class_credits_per_cycle,
    trialDays: row.trial_days,
    cancelPolicy: row.cancel_policy,
    providerProductId: row.provider_product_id,
    providerPriceId: row.provider_price_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapClass(row: GymClassRow): GymClass {
  return {
    id: row.id,
    gymId: row.gym_id,
    coachUserId: row.coach_user_id,
    title: row.title,
    description: row.description,
    capacity: row.capacity,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    bookingOpensAt: row.booking_opens_at,
    bookingClosesAt: row.booking_closes_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBooking(row: ClassBookingRow): ClassBooking {
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    status: row.status,
    bookedAt: row.booked_at,
    checkedInAt: row.checked_in_at,
    sourceChannel: row.source_channel,
    updatedAt: row.updated_at
  };
}

function mapWaitlist(row: ClassWaitlistRow): ClassWaitlistEntry {
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    position: row.position,
    status: row.status,
    notifiedAt: row.notified_at,
    expiresAt: row.expires_at,
    promotedAt: row.promoted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapWaiver(row: WaiverRow): Waiver {
  return {
    id: row.id,
    gymId: row.gym_id,
    title: row.title,
    policyVersion: row.policy_version,
    languageCode: row.language_code,
    documentUrl: row.document_url,
    isActive: row.is_active,
    effectiveAt: row.effective_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapWaiverAcceptance(row: WaiverAcceptanceRow): WaiverAcceptance {
  return {
    id: row.id,
    waiverId: row.waiver_id,
    userId: row.user_id,
    gymMembershipId: row.gym_membership_id,
    acceptedAt: row.accepted_at,
    source: row.source,
    locale: row.locale,
    signatureData: row.signature_data ?? {},
    createdAt: row.created_at
  };
}

function mapContract(row: ContractRow): Contract {
  return {
    id: row.id,
    gymId: row.gym_id,
    title: row.title,
    contractType: row.contract_type,
    policyVersion: row.policy_version,
    languageCode: row.language_code,
    documentUrl: row.document_url,
    isActive: row.is_active,
    effectiveAt: row.effective_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapContractAcceptance(row: ContractAcceptanceRow): ContractAcceptance {
  return {
    id: row.id,
    contractId: row.contract_id,
    userId: row.user_id,
    gymMembershipId: row.gym_membership_id,
    acceptedAt: row.accepted_at,
    source: row.source,
    locale: row.locale,
    signatureData: row.signature_data ?? {},
    createdAt: row.created_at
  };
}

function mapCheckin(row: GymCheckinRow): GymCheckin {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    membershipId: row.membership_id,
    classId: row.class_id,
    eventType: row.event_type,
    result: row.result,
    sourceChannel: row.source_channel,
    note: row.note,
    checkedInAt: row.checked_in_at,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapAccessLog(row: AccessLogRow): AccessLog {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    checkinId: row.checkin_id,
    eventType: row.event_type,
    result: row.result,
    reason: row.reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

function mapSubscription(row: MemberSubscriptionRow): MemberSubscription {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    membershipPlanId: row.membership_plan_id,
    status: row.status,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
    cancelAt: row.cancel_at,
    canceledAt: row.canceled_at,
    paymentMethodLast4: row.payment_method_last4,
    paymentMethodBrand: row.payment_method_brand,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    gymId: row.gym_id,
    userId: row.user_id,
    providerInvoiceId: row.provider_invoice_id,
    status: row.status,
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    amountPaidCents: row.amount_paid_cents,
    amountDueCents: row.amount_due_cents,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    invoicePdfUrl: row.invoice_pdf_url,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPayment(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    subscriptionId: row.subscription_id,
    gymId: row.gym_id,
    userId: row.user_id,
    provider: row.provider,
    providerPaymentIntentId: row.provider_payment_intent_id,
    providerChargeId: row.provider_charge_id,
    status: row.status,
    paymentMethodType: row.payment_method_type,
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    taxCents: row.tax_cents,
    netCents: row.net_cents,
    currency: row.currency,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    capturedAt: row.captured_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentTransactionId: row.payment_transaction_id,
    providerRefundId: row.provider_refund_id,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    reason: row.reason,
    processedAt: row.processed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDunning(row: DunningEventRow): DunningEvent {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    invoiceId: row.invoice_id,
    stage: row.stage,
    attemptNumber: row.attempt_number,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    result: row.result,
    note: row.note,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class B2BOpsService {
  private readonly access: StaffAccessService;

  constructor(private readonly supabase: SupabaseClient) {
    this.access = new StaffAccessService(supabase);
  }

  private async resolveClassGymId(classId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("gym_classes")
      .select("id,gym_id")
      .eq("id", classId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_CLASS_READ_FAILED", "Unable to resolve class.");

    if (!data) {
      throw new KruxtAdminError("ADMIN_CLASS_NOT_FOUND", "Class not found.");
    }

    return (data as { gym_id: string }).gym_id;
  }

  private async assertClassBelongsToGym(classId: string, gymId: string): Promise<void> {
    const classGymId = await this.resolveClassGymId(classId);
    if (classGymId !== gymId) {
      throw new KruxtAdminError("ADMIN_CLASS_GYM_MISMATCH", "Class does not belong to the selected gym.");
    }
  }

  private async resolveMembership(membershipId: string): Promise<GymMembershipLinkRow> {
    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("id,gym_id,user_id")
      .eq("id", membershipId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_MEMBERSHIP_READ_FAILED", "Unable to resolve membership.");

    if (!data) {
      throw new KruxtAdminError("ADMIN_MEMBERSHIP_NOT_FOUND", "Membership not found.");
    }

    return data as GymMembershipLinkRow;
  }

  private async assertMembershipBelongsToGym(
    membershipId: string,
    gymId: string,
    userId?: string
  ): Promise<void> {
    const membership = await this.resolveMembership(membershipId);

    if (membership.gym_id !== gymId) {
      throw new KruxtAdminError(
        "ADMIN_MEMBERSHIP_GYM_MISMATCH",
        "Membership does not belong to the selected gym."
      );
    }

    if (userId && membership.user_id !== userId) {
      throw new KruxtAdminError(
        "ADMIN_MEMBERSHIP_USER_MISMATCH",
        "Membership does not belong to the selected user."
      );
    }
  }

  private async assertCheckinBelongsToGym(checkinId: string, gymId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from("gym_checkins")
      .select("id,gym_id")
      .eq("id", checkinId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_CHECKIN_LOOKUP_FAILED", "Unable to resolve check-in.");

    if (!data) {
      throw new KruxtAdminError("ADMIN_CHECKIN_NOT_FOUND", "Check-in not found.");
    }

    if ((data as { gym_id: string }).gym_id !== gymId) {
      throw new KruxtAdminError("ADMIN_CHECKIN_GYM_MISMATCH", "Check-in does not belong to the selected gym.");
    }
  }

  async listMembershipPlans(gymId: string, includeInactive = true): Promise<GymMembershipPlan[]> {
    await this.access.requireGymStaff(gymId);

    let query = this.supabase
      .from("gym_membership_plans")
      .select("*")
      .eq("gym_id", gymId)
      .order("price_cents", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    throwIfAdminError(error, "ADMIN_PLAN_LIST_FAILED", "Unable to list membership plans.");

    return ((data as GymMembershipPlanRow[]) ?? []).map(mapPlan);
  }

  async createMembershipPlan(gymId: string, input: CreateMembershipPlanInput): Promise<GymMembershipPlan> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_membership_plans")
      .insert({
        gym_id: gymId,
        name: input.name,
        billing_cycle: input.billingCycle,
        price_cents: input.priceCents,
        currency: (input.currency ?? "USD").toUpperCase(),
        class_credits_per_cycle: input.classCreditsPerCycle ?? null,
        trial_days: input.trialDays ?? null,
        cancel_policy: input.cancelPolicy ?? null,
        provider_product_id: input.providerProductId ?? null,
        provider_price_id: input.providerPriceId ?? null,
        is_active: input.isActive ?? true
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PLAN_CREATE_FAILED", "Unable to create membership plan.");

    return mapPlan(data as GymMembershipPlanRow);
  }

  async updateMembershipPlan(
    gymId: string,
    planId: string,
    input: UpdateMembershipPlanInput
  ): Promise<GymMembershipPlan> {
    await this.access.requireGymStaff(gymId);

    const payload = {
      name: input.name,
      billing_cycle: input.billingCycle,
      price_cents: input.priceCents,
      currency: input.currency ? input.currency.toUpperCase() : undefined,
      class_credits_per_cycle: input.classCreditsPerCycle,
      trial_days: input.trialDays,
      cancel_policy: input.cancelPolicy,
      provider_product_id: input.providerProductId,
      provider_price_id: input.providerPriceId,
      is_active: input.isActive
    };

    const { data, error } = await this.supabase
      .from("gym_membership_plans")
      .update(payload)
      .eq("id", planId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PLAN_UPDATE_FAILED", "Unable to update membership plan.");

    return mapPlan(data as GymMembershipPlanRow);
  }

  async listGymClasses(gymId: string, limit = 100): Promise<GymClass[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_classes")
      .select("*")
      .eq("gym_id", gymId)
      .order("starts_at", { ascending: true })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_CLASS_LIST_FAILED", "Unable to list gym classes.");

    return ((data as GymClassRow[]) ?? []).map(mapClass);
  }

  async createGymClass(gymId: string, input: CreateGymClassInput): Promise<GymClass> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_classes")
      .insert({
        gym_id: gymId,
        coach_user_id: input.coachUserId ?? null,
        title: input.title,
        description: input.description ?? null,
        capacity: input.capacity,
        status: input.status ?? "scheduled",
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        booking_opens_at: input.bookingOpensAt ?? null,
        booking_closes_at: input.bookingClosesAt ?? null
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CLASS_CREATE_FAILED", "Unable to create class.");

    return mapClass(data as GymClassRow);
  }

  async updateGymClass(gymId: string, classId: string, input: UpdateGymClassInput): Promise<GymClass> {
    await this.access.requireGymStaff(gymId);
    await this.assertClassBelongsToGym(classId, gymId);

    const payload = {
      coach_user_id: input.coachUserId,
      title: input.title,
      description: input.description,
      capacity: input.capacity,
      status: input.status,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      booking_opens_at: input.bookingOpensAt,
      booking_closes_at: input.bookingClosesAt
    };

    const { data, error } = await this.supabase
      .from("gym_classes")
      .update(payload)
      .eq("id", classId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CLASS_UPDATE_FAILED", "Unable to update class.");

    return mapClass(data as GymClassRow);
  }

  async setGymClassStatus(gymId: string, classId: string, status: GymClass["status"]): Promise<GymClass> {
    await this.access.requireGymStaff(gymId);
    await this.assertClassBelongsToGym(classId, gymId);

    const { data, error } = await this.supabase
      .from("gym_classes")
      .update({ status })
      .eq("id", classId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CLASS_STATUS_UPDATE_FAILED", "Unable to update class status.");

    return mapClass(data as GymClassRow);
  }

  async listClassBookings(gymId: string, classId: string, limit = 300): Promise<ClassBooking[]> {
    await this.access.requireGymStaff(gymId);
    await this.assertClassBelongsToGym(classId, gymId);

    const { data, error } = await this.supabase
      .from("class_bookings")
      .select("*")
      .eq("class_id", classId)
      .order("booked_at", { ascending: true })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_CLASS_BOOKINGS_READ_FAILED", "Unable to load class bookings.");

    return ((data as ClassBookingRow[]) ?? []).map(mapBooking);
  }

  async upsertClassBookingByStaff(gymId: string, input: UpsertClassBookingInput): Promise<ClassBooking> {
    await this.access.requireGymStaff(gymId);
    await this.assertClassBelongsToGym(input.classId, gymId);

    const { data, error } = await this.supabase
      .from("class_bookings")
      .upsert(
        {
          class_id: input.classId,
          user_id: input.userId,
          status: input.status ?? "booked",
          source_channel: input.sourceChannel ?? "admin_panel",
          checked_in_at: input.checkedInAt ?? null
        },
        { onConflict: "class_id,user_id" }
      )
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CLASS_BOOKING_UPSERT_FAILED", "Unable to upsert class booking.");

    return mapBooking(data as ClassBookingRow);
  }

  async updateClassBookingStatus(gymId: string, bookingId: string, status: ClassBooking["status"]): Promise<ClassBooking> {
    await this.access.requireGymStaff(gymId);

    const { data: bookingData, error: bookingError } = await this.supabase
      .from("class_bookings")
      .select("id,class_id")
      .eq("id", bookingId)
      .maybeSingle();

    throwIfAdminError(bookingError, "ADMIN_CLASS_BOOKING_LOOKUP_FAILED", "Unable to resolve booking.");

    if (!bookingData) {
      throw new KruxtAdminError("ADMIN_CLASS_BOOKING_NOT_FOUND", "Class booking not found.");
    }

    await this.assertClassBelongsToGym((bookingData as { class_id: string }).class_id, gymId);

    const { data, error } = await this.supabase
      .from("class_bookings")
      .update({ status })
      .eq("id", bookingId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CLASS_BOOKING_UPDATE_FAILED", "Unable to update class booking status.");

    return mapBooking(data as ClassBookingRow);
  }

  async listClassWaitlist(gymId: string, classId: string, limit = 300): Promise<ClassWaitlistEntry[]> {
    await this.access.requireGymStaff(gymId);
    await this.assertClassBelongsToGym(classId, gymId);

    const { data, error } = await this.supabase
      .from("class_waitlist")
      .select("*")
      .eq("class_id", classId)
      .order("position", { ascending: true })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_CLASS_WAITLIST_READ_FAILED", "Unable to load class waitlist.");

    return ((data as ClassWaitlistRow[]) ?? []).map(mapWaitlist);
  }

  async updateClassWaitlistEntry(
    gymId: string,
    waitlistEntryId: string,
    input: UpdateClassWaitlistInput
  ): Promise<ClassWaitlistEntry> {
    await this.access.requireGymStaff(gymId);

    const { data: waitlistData, error: waitlistError } = await this.supabase
      .from("class_waitlist")
      .select("id,class_id")
      .eq("id", waitlistEntryId)
      .maybeSingle();

    throwIfAdminError(waitlistError, "ADMIN_CLASS_WAITLIST_LOOKUP_FAILED", "Unable to resolve waitlist entry.");

    if (!waitlistData) {
      throw new KruxtAdminError("ADMIN_CLASS_WAITLIST_NOT_FOUND", "Waitlist entry not found.");
    }

    await this.assertClassBelongsToGym((waitlistData as { class_id: string }).class_id, gymId);

    const { data, error } = await this.supabase
      .from("class_waitlist")
      .update({
        status: input.status,
        notified_at: input.notifiedAt,
        expires_at: input.expiresAt
      })
      .eq("id", waitlistEntryId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CLASS_WAITLIST_UPDATE_FAILED", "Unable to update class waitlist entry.");

    return mapWaitlist(data as ClassWaitlistRow);
  }

  async promoteWaitlistMember(gymId: string, classId: string): Promise<string> {
    await this.access.requireGymStaff(gymId);
    await this.assertClassBelongsToGym(classId, gymId);

    const { data, error } = await this.supabase.rpc("promote_waitlist_member", { p_class_id: classId });

    throwIfAdminError(error, "ADMIN_WAITLIST_PROMOTE_FAILED", "Unable to promote waitlist member.");

    const bookingId = data as string | null;
    if (!bookingId) {
      throw new KruxtAdminError("ADMIN_WAITLIST_PROMOTE_NO_BOOKING", "Waitlist promotion completed without a booking id.");
    }

    return bookingId;
  }

  async listWaivers(gymId: string, includeInactive = true): Promise<Waiver[]> {
    await this.access.requireGymStaff(gymId);

    let query = this.supabase
      .from("waivers")
      .select("*")
      .eq("gym_id", gymId)
      .order("effective_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    throwIfAdminError(error, "ADMIN_WAIVERS_READ_FAILED", "Unable to load waivers.");

    return ((data as WaiverRow[]) ?? []).map(mapWaiver);
  }

  async createWaiver(gymId: string, input: CreateWaiverInput): Promise<Waiver> {
    const staff = await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("waivers")
      .insert({
        gym_id: gymId,
        title: input.title,
        policy_version: input.policyVersion,
        language_code: input.languageCode ?? "en",
        document_url: input.documentUrl,
        is_active: input.isActive ?? true,
        effective_at: input.effectiveAt ?? new Date().toISOString(),
        created_by: staff.user_id
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_WAIVER_CREATE_FAILED", "Unable to create waiver.");

    return mapWaiver(data as WaiverRow);
  }

  async updateWaiver(gymId: string, waiverId: string, input: UpdateWaiverInput): Promise<Waiver> {
    await this.access.requireGymStaff(gymId);

    const payload = {
      title: input.title,
      policy_version: input.policyVersion,
      language_code: input.languageCode,
      document_url: input.documentUrl,
      is_active: input.isActive,
      effective_at: input.effectiveAt
    };

    const { data, error } = await this.supabase
      .from("waivers")
      .update(payload)
      .eq("id", waiverId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_WAIVER_UPDATE_FAILED", "Unable to update waiver.");

    return mapWaiver(data as WaiverRow);
  }

  async listWaiverAcceptances(gymId: string, waiverId: string, limit = 300): Promise<WaiverAcceptance[]> {
    await this.access.requireGymStaff(gymId);

    const { data: waiverData, error: waiverError } = await this.supabase
      .from("waivers")
      .select("id,gym_id")
      .eq("id", waiverId)
      .maybeSingle();

    throwIfAdminError(waiverError, "ADMIN_WAIVER_LOOKUP_FAILED", "Unable to resolve waiver.");

    if (!waiverData || (waiverData as { gym_id: string }).gym_id !== gymId) {
      throw new KruxtAdminError("ADMIN_WAIVER_GYM_MISMATCH", "Waiver does not belong to selected gym.");
    }

    const { data, error } = await this.supabase
      .from("waiver_acceptances")
      .select("*")
      .eq("waiver_id", waiverId)
      .order("accepted_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_WAIVER_ACCEPTANCES_READ_FAILED", "Unable to load waiver acceptances.");

    return ((data as WaiverAcceptanceRow[]) ?? []).map(mapWaiverAcceptance);
  }

  async recordWaiverAcceptanceByStaff(
    gymId: string,
    waiverId: string,
    input: AdminRecordAcceptanceInput
  ): Promise<string> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase.rpc("admin_record_waiver_acceptance", {
      p_waiver_id: waiverId,
      p_user_id: input.userId,
      p_membership_id: input.membershipId ?? null,
      p_signature_data: input.signatureData ?? {},
      p_source: "admin"
    });

    throwIfAdminError(error, "ADMIN_WAIVER_ACCEPTANCE_RECORD_FAILED", "Unable to record waiver acceptance.");

    const acceptanceId = data as string | null;
    if (!acceptanceId) {
      throw new KruxtAdminError("ADMIN_WAIVER_ACCEPTANCE_NO_ID", "Waiver acceptance recorded without an id.");
    }

    return acceptanceId;
  }

  async listContracts(gymId: string, includeInactive = true): Promise<Contract[]> {
    await this.access.requireGymStaff(gymId);

    let query = this.supabase
      .from("contracts")
      .select("*")
      .eq("gym_id", gymId)
      .order("effective_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    throwIfAdminError(error, "ADMIN_CONTRACTS_READ_FAILED", "Unable to load contracts.");

    return ((data as ContractRow[]) ?? []).map(mapContract);
  }

  async createContract(gymId: string, input: CreateContractInput): Promise<Contract> {
    const staff = await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("contracts")
      .insert({
        gym_id: gymId,
        title: input.title,
        contract_type: input.contractType ?? "membership",
        policy_version: input.policyVersion,
        language_code: input.languageCode ?? "en",
        document_url: input.documentUrl,
        is_active: input.isActive ?? true,
        effective_at: input.effectiveAt ?? new Date().toISOString(),
        created_by: staff.user_id
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CONTRACT_CREATE_FAILED", "Unable to create contract.");

    return mapContract(data as ContractRow);
  }

  async updateContract(gymId: string, contractId: string, input: UpdateContractInput): Promise<Contract> {
    await this.access.requireGymStaff(gymId);

    const payload = {
      title: input.title,
      contract_type: input.contractType,
      policy_version: input.policyVersion,
      language_code: input.languageCode,
      document_url: input.documentUrl,
      is_active: input.isActive,
      effective_at: input.effectiveAt
    };

    const { data, error } = await this.supabase
      .from("contracts")
      .update(payload)
      .eq("id", contractId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CONTRACT_UPDATE_FAILED", "Unable to update contract.");

    return mapContract(data as ContractRow);
  }

  async listContractAcceptances(gymId: string, contractId: string, limit = 300): Promise<ContractAcceptance[]> {
    await this.access.requireGymStaff(gymId);

    const { data: contractData, error: contractError } = await this.supabase
      .from("contracts")
      .select("id,gym_id")
      .eq("id", contractId)
      .maybeSingle();

    throwIfAdminError(contractError, "ADMIN_CONTRACT_LOOKUP_FAILED", "Unable to resolve contract.");

    if (!contractData || (contractData as { gym_id: string }).gym_id !== gymId) {
      throw new KruxtAdminError("ADMIN_CONTRACT_GYM_MISMATCH", "Contract does not belong to selected gym.");
    }

    const { data, error } = await this.supabase
      .from("contract_acceptances")
      .select("*")
      .eq("contract_id", contractId)
      .order("accepted_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_CONTRACT_ACCEPTANCES_READ_FAILED", "Unable to load contract acceptances.");

    return ((data as ContractAcceptanceRow[]) ?? []).map(mapContractAcceptance);
  }

  async recordContractAcceptanceByStaff(
    gymId: string,
    contractId: string,
    input: AdminRecordAcceptanceInput
  ): Promise<string> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase.rpc("admin_record_contract_acceptance", {
      p_contract_id: contractId,
      p_user_id: input.userId,
      p_membership_id: input.membershipId ?? null,
      p_signature_data: input.signatureData ?? {},
      p_source: "admin"
    });

    throwIfAdminError(error, "ADMIN_CONTRACT_ACCEPTANCE_RECORD_FAILED", "Unable to record contract acceptance.");

    const acceptanceId = data as string | null;
    if (!acceptanceId) {
      throw new KruxtAdminError("ADMIN_CONTRACT_ACCEPTANCE_NO_ID", "Contract acceptance recorded without an id.");
    }

    return acceptanceId;
  }

  async listRecentCheckins(gymId: string, limit = 200): Promise<GymCheckin[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_checkins")
      .select("*")
      .eq("gym_id", gymId)
      .order("checked_in_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_CHECKINS_READ_FAILED", "Unable to load check-ins.");

    return ((data as GymCheckinRow[]) ?? []).map(mapCheckin);
  }

  async recordCheckin(gymId: string, input: RecordGymCheckinInput): Promise<GymCheckin> {
    const staff = await this.access.requireGymStaff(gymId);

    if (input.classId) {
      await this.assertClassBelongsToGym(input.classId, gymId);
    }

    if (input.membershipId) {
      await this.assertMembershipBelongsToGym(input.membershipId, gymId, input.userId);
    }

    const { data, error } = await this.supabase
      .from("gym_checkins")
      .insert({
        gym_id: gymId,
        user_id: input.userId,
        membership_id: input.membershipId ?? null,
        class_id: input.classId ?? null,
        event_type: input.eventType,
        result: input.result,
        source_channel: input.sourceChannel ?? "admin_panel",
        note: input.note ?? null,
        checked_in_at: input.checkedInAt ?? new Date().toISOString(),
        created_by: staff.user_id
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_CHECKIN_CREATE_FAILED", "Unable to record check-in.");

    return mapCheckin(data as GymCheckinRow);
  }

  async listRecentAccessLogs(gymId: string, limit = 200): Promise<AccessLog[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("access_logs")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_ACCESS_LOGS_READ_FAILED", "Unable to load access logs.");

    return ((data as AccessLogRow[]) ?? []).map(mapAccessLog);
  }

  async recordAccessLog(gymId: string, input: RecordAccessLogInput): Promise<AccessLog> {
    const staff = await this.access.requireGymStaff(gymId);

    if (input.checkinId) {
      await this.assertCheckinBelongsToGym(input.checkinId, gymId);
    }

    const { data, error } = await this.supabase
      .from("access_logs")
      .insert({
        gym_id: gymId,
        user_id: input.userId ?? null,
        checkin_id: input.checkinId ?? null,
        event_type: input.eventType,
        result: input.result,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
        created_by: staff.user_id
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_ACCESS_LOG_CREATE_FAILED", "Unable to record access log.");

    return mapAccessLog(data as AccessLogRow);
  }

  async listMemberSubscriptions(gymId: string, limit = 200): Promise<MemberSubscription[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("member_subscriptions")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_SUBSCRIPTIONS_READ_FAILED", "Unable to load member subscriptions.");

    return ((data as MemberSubscriptionRow[]) ?? []).map(mapSubscription);
  }

  async upsertMemberSubscription(
    gymId: string,
    input: UpsertMemberSubscriptionInput,
    subscriptionId?: string
  ): Promise<MemberSubscription> {
    await this.access.requireGymStaff(gymId);

    const payload = {
      gym_id: gymId,
      user_id: input.userId,
      membership_plan_id: input.membershipPlanId ?? null,
      status: input.status ?? "incomplete",
      provider: input.provider ?? "stripe",
      provider_customer_id: input.providerCustomerId ?? null,
      provider_subscription_id: input.providerSubscriptionId ?? null,
      current_period_start: input.currentPeriodStart ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
      trial_ends_at: input.trialEndsAt ?? null,
      cancel_at: input.cancelAt ?? null,
      canceled_at: input.canceledAt ?? null,
      payment_method_last4: input.paymentMethodLast4 ?? null,
      payment_method_brand: input.paymentMethodBrand ?? null,
      metadata: input.metadata ?? {}
    };

    if (subscriptionId) {
      const { data, error } = await this.supabase
        .from("member_subscriptions")
        .update(payload)
        .eq("id", subscriptionId)
        .eq("gym_id", gymId)
        .select("*")
        .single();

      throwIfAdminError(error, "ADMIN_SUBSCRIPTION_UPDATE_FAILED", "Unable to update member subscription.");

      return mapSubscription(data as MemberSubscriptionRow);
    }

    const { data, error } = await this.supabase
      .from("member_subscriptions")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUBSCRIPTION_CREATE_FAILED", "Unable to create member subscription.");

    return mapSubscription(data as MemberSubscriptionRow);
  }

  async listInvoices(gymId: string, limit = 200): Promise<Invoice[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("invoices")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_INVOICES_READ_FAILED", "Unable to load invoices.");

    return ((data as InvoiceRow[]) ?? []).map(mapInvoice);
  }

  async updateInvoice(gymId: string, invoiceId: string, input: UpdateInvoiceInput): Promise<Invoice> {
    await this.access.requireGymStaff(gymId);

    const payload = {
      status: input.status,
      amount_paid_cents: input.amountPaidCents,
      amount_due_cents: input.amountDueCents,
      due_at: input.dueAt,
      paid_at: input.paidAt,
      invoice_pdf_url: input.invoicePdfUrl,
      metadata: input.metadata
    };

    const { data, error } = await this.supabase
      .from("invoices")
      .update(payload)
      .eq("id", invoiceId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_INVOICE_UPDATE_FAILED", "Unable to update invoice.");

    return mapInvoice(data as InvoiceRow);
  }

  async listPaymentTransactions(gymId: string, limit = 200): Promise<PaymentTransaction[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("payment_transactions")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_PAYMENTS_READ_FAILED", "Unable to load payment transactions.");

    return ((data as PaymentTransactionRow[]) ?? []).map(mapPayment);
  }

  async listRefunds(gymId: string, limit = 200): Promise<Refund[]> {
    await this.access.requireGymStaff(gymId);

    const { data: paymentData, error: paymentError } = await this.supabase
      .from("payment_transactions")
      .select("id")
      .eq("gym_id", gymId)
      .limit(1000);

    throwIfAdminError(paymentError, "ADMIN_REFUNDS_PAYMENT_LOOKUP_FAILED", "Unable to resolve payments for refunds.");

    const paymentIds = ((paymentData as Array<{ id: string }>) ?? []).map((row) => row.id);
    if (paymentIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("refunds")
      .select("*")
      .in("payment_transaction_id", paymentIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_REFUNDS_READ_FAILED", "Unable to load refunds.");

    return ((data as RefundRow[]) ?? []).map(mapRefund);
  }

  async listDunningEvents(gymId: string, limit = 200): Promise<DunningEvent[]> {
    await this.access.requireGymStaff(gymId);

    const { data: subscriptionData, error: subscriptionError } = await this.supabase
      .from("member_subscriptions")
      .select("id")
      .eq("gym_id", gymId)
      .limit(1000);

    throwIfAdminError(
      subscriptionError,
      "ADMIN_DUNNING_SUBSCRIPTIONS_LOOKUP_FAILED",
      "Unable to resolve subscriptions for dunning events."
    );

    const subscriptionIds = ((subscriptionData as Array<{ id: string }>) ?? []).map((row) => row.id);
    if (subscriptionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("dunning_events")
      .select("*")
      .in("subscription_id", subscriptionIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_DUNNING_READ_FAILED", "Unable to load dunning events.");

    return ((data as DunningEventRow[]) ?? []).map(mapDunning);
  }

  async updateDunningEvent(
    gymId: string,
    dunningEventId: string,
    input: UpdateDunningEventInput
  ): Promise<DunningEvent> {
    await this.access.requireGymStaff(gymId);

    const { data: existingData, error: existingError } = await this.supabase
      .from("dunning_events")
      .select("id,subscription_id")
      .eq("id", dunningEventId)
      .maybeSingle();

    throwIfAdminError(existingError, "ADMIN_DUNNING_LOOKUP_FAILED", "Unable to resolve dunning event.");

    if (!existingData) {
      throw new KruxtAdminError("ADMIN_DUNNING_NOT_FOUND", "Dunning event not found.");
    }

    const { data: subscriptionData, error: subscriptionError } = await this.supabase
      .from("member_subscriptions")
      .select("id,gym_id")
      .eq("id", (existingData as { subscription_id: string }).subscription_id)
      .maybeSingle();

    throwIfAdminError(subscriptionError, "ADMIN_DUNNING_SUBSCRIPTION_READ_FAILED", "Unable to resolve subscription.");

    if (!subscriptionData || (subscriptionData as { gym_id: string }).gym_id !== gymId) {
      throw new KruxtAdminError("ADMIN_DUNNING_GYM_MISMATCH", "Dunning event does not belong to selected gym.");
    }

    const payload = {
      stage: input.stage,
      attempt_number: input.attemptNumber,
      scheduled_for: input.scheduledFor,
      sent_at: input.sentAt,
      result: input.result,
      note: input.note,
      metadata: input.metadata
    };

    const { data, error } = await this.supabase
      .from("dunning_events")
      .update(payload)
      .eq("id", dunningEventId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DUNNING_UPDATE_FAILED", "Unable to update dunning event.");

    return mapDunning(data as DunningEventRow);
  }
}
