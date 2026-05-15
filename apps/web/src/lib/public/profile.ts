import type { MembershipStatus, GymRole, PaymentStatus, SubscriptionStatus } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROFILE_AVATAR_BUCKET = "profile-avatars";
const MANUAL_BILLING_FEATURE_KEY = "manual_billing";

export interface MemberProfileMembership {
  gymId: string;
  gymName: string;
  role: GymRole;
  membershipStatus: MembershipStatus;
  startedAt: string | null;
}

export interface MemberProfileSubscription {
  id: string;
  gymId: string;
  gymName: string;
  membershipPlanId: string | null;
  membershipPlanName: string | null;
  status: SubscriptionStatus;
  provider: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  createdAt: string;
}

export interface MemberProfileInvoice {
  id: string;
  subscriptionId: string | null;
  gymId: string;
  gymName: string;
  status: PaymentStatus;
  currency: string;
  totalCents: number;
  amountDueCents: number;
  dueAt: string | null;
  paidAt: string | null;
  invoicePdfUrl: string | null;
  createdAt: string;
}

export interface MemberProfilePayment {
  id: string;
  invoiceId: string | null;
  subscriptionId: string | null;
  gymId: string;
  gymName: string;
  provider: string;
  status: PaymentStatus;
  paymentMethodType: string | null;
  amountCents: number;
  feeCents: number;
  taxCents: number;
  netCents: number;
  currency: string;
  capturedAt: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

export interface ManualBillingSettings {
  instructions: string;
  bankAccountLabel: string;
  accountHolder: string;
  iban: string;
  paymentReferenceFormat: string;
  cashDeskNote: string;
  externalPaymentUrl: string;
}

export interface MemberProfileDetails {
  id: string;
  email: string | null;
  displayName: string;
  username: string;
  bio: string;
  avatarValue: string | null;
  avatarDisplayUrl: string | null;
  isPublic: boolean;
  homeGymId: string | null;
  memberships: MemberProfileMembership[];
  subscriptions: MemberProfileSubscription[];
  invoices: MemberProfileInvoice[];
  payments: MemberProfilePayment[];
  manualBillingByGymId: Record<string, ManualBillingSettings>;
}

function compactText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeManualBillingSettings(config: unknown): ManualBillingSettings {
  const row =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};

  return {
    instructions: compactText(row.instructions),
    bankAccountLabel: compactText(row.bankAccountLabel),
    accountHolder: compactText(row.accountHolder),
    iban: compactText(row.iban),
    paymentReferenceFormat: compactText(row.paymentReferenceFormat),
    cashDeskNote: compactText(row.cashDeskNote),
    externalPaymentUrl: compactText(row.externalPaymentUrl)
  };
}

function hasManualBillingContent(settings: ManualBillingSettings): boolean {
  return Object.values(settings).some((value) => value.length > 0);
}

function normalizeAvatarStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(https?:|data:)/i.test(value)) return null;
  return value.replace(/^profile-avatars\//, "");
}

async function resolveAvatarDisplayUrl(
  client: SupabaseClient,
  avatarValue: string | null | undefined
): Promise<string | null> {
  if (!avatarValue) return null;
  if (/^(https?:|data:)/i.test(avatarValue)) return avatarValue;

  const objectPath = normalizeAvatarStoragePath(avatarValue);
  if (!objectPath) return null;

  const { data, error } = await client.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(objectPath, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function loadMemberProfile(
  client: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<MemberProfileDetails> {
  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select("id,display_name,username,bio,avatar_url,is_public,home_gym_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Unable to load profile.");
  }

  const profileRow = (profileData as {
    id: string;
    display_name: string | null;
    username: string | null;
    bio: string | null;
    avatar_url: string | null;
    is_public: boolean | null;
    home_gym_id: string | null;
  } | null) ?? null;

  const [membershipsResponse, subscriptionsResponse, invoicesResponse, paymentsResponse] = await Promise.all([
    client
      .from("gym_memberships")
      .select("gym_id,role,membership_status,started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false }),
    client
      .from("member_subscriptions")
      .select(
        "id,gym_id,membership_plan_id,status,provider,current_period_start,current_period_end,trial_ends_at,cancel_at,canceled_at,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("invoices")
      .select("id,subscription_id,gym_id,status,currency,total_cents,amount_due_cents,due_at,paid_at,invoice_pdf_url,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("payment_transactions")
      .select(
        "id,invoice_id,subscription_id,gym_id,provider,status,payment_method_type,amount_cents,fee_cents,tax_cents,net_cents,currency,captured_at,metadata,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
  ]);

  if (membershipsResponse.error) {
    throw new Error(membershipsResponse.error.message || "Unable to load gym memberships.");
  }
  if (subscriptionsResponse.error) {
    throw new Error(subscriptionsResponse.error.message || "Unable to load member subscriptions.");
  }
  if (invoicesResponse.error) {
    throw new Error(invoicesResponse.error.message || "Unable to load invoices.");
  }
  if (paymentsResponse.error) {
    throw new Error(paymentsResponse.error.message || "Unable to load payment history.");
  }

  const memberships =
    (membershipsResponse.data as Array<{
      gym_id: string;
      role: GymRole;
      membership_status: MembershipStatus;
      started_at: string | null;
    }> | null) ?? [];

  const subscriptions =
    (subscriptionsResponse.data as Array<{
      id: string;
      gym_id: string;
      membership_plan_id: string | null;
      status: SubscriptionStatus;
      provider: string;
      current_period_start: string | null;
      current_period_end: string | null;
      trial_ends_at: string | null;
      cancel_at: string | null;
      canceled_at: string | null;
      created_at: string;
    }> | null) ?? [];

  const invoices =
    (invoicesResponse.data as Array<{
      id: string;
      subscription_id: string | null;
      gym_id: string;
      status: PaymentStatus;
      currency: string;
      total_cents: number;
      amount_due_cents: number;
      due_at: string | null;
      paid_at: string | null;
      invoice_pdf_url: string | null;
      created_at: string;
    }> | null) ?? [];

  const payments =
    (paymentsResponse.data as Array<{
      id: string;
      invoice_id: string | null;
      subscription_id: string | null;
      gym_id: string;
      provider: string;
      status: PaymentStatus;
      payment_method_type: string | null;
      amount_cents: number;
      fee_cents: number;
      tax_cents: number;
      net_cents: number;
      currency: string;
      captured_at: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }> | null) ?? [];

  const gymIds = Array.from(
    new Set([
      ...memberships.map((item) => item.gym_id),
      ...subscriptions.map((item) => item.gym_id),
      ...invoices.map((item) => item.gym_id),
      ...payments.map((item) => item.gym_id)
    ])
  );
  const planIds = Array.from(
    new Set(subscriptions.map((item) => item.membership_plan_id).filter((value): value is string => Boolean(value)))
  );
  const gymNameMap = new Map<string, string>();
  const planNameMap = new Map<string, string>();
  const manualBillingByGymId: Record<string, ManualBillingSettings> = {};

  const [gymsResponse, plansResponse, manualBillingResponse] = await Promise.all([
    gymIds.length > 0
      ? client.from("gyms").select("id,name").in("id", gymIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length > 0
      ? client.from("gym_membership_plans").select("id,name").in("id", planIds)
      : Promise.resolve({ data: [], error: null }),
    gymIds.length > 0
      ? client
          .from("gym_feature_settings")
          .select("gym_id,config")
          .in("gym_id", gymIds)
          .eq("feature_key", MANUAL_BILLING_FEATURE_KEY)
          .eq("enabled", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (gymsResponse.error) {
    throw new Error(gymsResponse.error.message || "Unable to load gyms.");
  }
  if (plansResponse.error) {
    throw new Error(plansResponse.error.message || "Unable to load membership plans.");
  }
  if (manualBillingResponse.error) {
    throw new Error(manualBillingResponse.error.message || "Unable to load billing instructions.");
  }

  for (const gym of ((gymsResponse.data as Array<{ id: string; name: string }> | null) ?? [])) {
    gymNameMap.set(gym.id, gym.name);
  }

  for (const plan of ((plansResponse.data as Array<{ id: string; name: string }> | null) ?? [])) {
    planNameMap.set(plan.id, plan.name);
  }

  for (const row of ((manualBillingResponse.data as Array<{ gym_id: string; config: unknown }> | null) ?? [])) {
    const settings = normalizeManualBillingSettings(row.config);
    if (hasManualBillingContent(settings)) {
      manualBillingByGymId[row.gym_id] = settings;
    }
  }

  const avatarValue = profileRow?.avatar_url ?? null;

  return {
    id: userId,
    email: email ?? null,
    displayName: profileRow?.display_name?.trim() || email?.split("@")[0] || "Member",
    username: profileRow?.username?.trim() || "",
    bio: profileRow?.bio?.trim() || "",
    avatarValue,
    avatarDisplayUrl: await resolveAvatarDisplayUrl(client, avatarValue),
    isPublic: profileRow?.is_public ?? true,
    homeGymId: profileRow?.home_gym_id ?? null,
    memberships: memberships.map((item) => ({
      gymId: item.gym_id,
      gymName: gymNameMap.get(item.gym_id) ?? item.gym_id,
      role: item.role,
      membershipStatus: item.membership_status,
      startedAt: item.started_at
    })),
    subscriptions: subscriptions.map((item) => ({
      id: item.id,
      gymId: item.gym_id,
      gymName: gymNameMap.get(item.gym_id) ?? item.gym_id,
      membershipPlanId: item.membership_plan_id,
      membershipPlanName: item.membership_plan_id ? planNameMap.get(item.membership_plan_id) ?? null : null,
      status: item.status,
      provider: item.provider,
      currentPeriodStart: item.current_period_start,
      currentPeriodEnd: item.current_period_end,
      trialEndsAt: item.trial_ends_at,
      cancelAt: item.cancel_at,
      canceledAt: item.canceled_at,
      createdAt: item.created_at
    })),
    invoices: invoices.map((item) => ({
      id: item.id,
      subscriptionId: item.subscription_id,
      gymId: item.gym_id,
      gymName: gymNameMap.get(item.gym_id) ?? item.gym_id,
      status: item.status,
      currency: item.currency,
      totalCents: item.total_cents,
      amountDueCents: item.amount_due_cents,
      dueAt: item.due_at,
      paidAt: item.paid_at,
      invoicePdfUrl: item.invoice_pdf_url,
      createdAt: item.created_at
    })),
    payments: payments.map((item) => ({
      id: item.id,
      invoiceId: item.invoice_id,
      subscriptionId: item.subscription_id,
      gymId: item.gym_id,
      gymName: gymNameMap.get(item.gym_id) ?? item.gym_id,
      provider: item.provider,
      status: item.status,
      paymentMethodType: item.payment_method_type,
      amountCents: item.amount_cents,
      feeCents: item.fee_cents,
      taxCents: item.tax_cents,
      netCents: item.net_cents,
      currency: item.currency,
      capturedAt: item.captured_at,
      reference: typeof item.metadata?.reference === "string" ? item.metadata.reference : null,
      note: typeof item.metadata?.note === "string" ? item.metadata.note : null,
      createdAt: item.created_at
    })),
    manualBillingByGymId
  };
}

export async function updateMemberProfile(
  client: SupabaseClient,
  userId: string,
  input: {
    displayName: string;
    username: string;
    bio: string;
    isPublic: boolean;
    homeGymId?: string | null;
    avatarValue?: string | null;
  }
): Promise<void> {
  const username = input.username.trim().replace(/^@+/, "");
  if (!username) {
    throw new Error("Username is required.");
  }

  const { error } = await client.from("profiles").upsert(
    {
      id: userId,
      display_name: input.displayName.trim() || username,
      username,
      bio: input.bio.trim() || null,
      is_public: input.isPublic,
      home_gym_id: input.homeGymId ?? null,
      ...(typeof input.avatarValue !== "undefined" ? { avatar_url: input.avatarValue } : {})
    },
    { onConflict: "id", ignoreDuplicates: false }
  );

  if (error) {
    throw new Error(error.message || "Unable to save profile.");
  }
}

export async function uploadMemberAvatar(
  client: SupabaseClient,
  userId: string,
  file: File,
  existingAvatarValue?: string | null
): Promise<{ avatarValue: string; avatarDisplayUrl: string | null }> {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();
  const extension =
    extensionFromName && /^[a-z0-9]+$/.test(extensionFromName)
      ? extensionFromName
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

  const objectPath = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await client.storage.from(PROFILE_AVATAR_BUCKET).upload(objectPath, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
    cacheControl: "3600"
  });

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload avatar.");
  }

  const previousObjectPath = normalizeAvatarStoragePath(existingAvatarValue);
  if (previousObjectPath && previousObjectPath !== objectPath) {
    await client.storage.from(PROFILE_AVATAR_BUCKET).remove([previousObjectPath]);
  }

  return {
    avatarValue: objectPath,
    avatarDisplayUrl: await resolveAvatarDisplayUrl(client, objectPath)
  };
}

export async function removeMemberAvatar(
  client: SupabaseClient,
  avatarValue: string | null | undefined
): Promise<void> {
  const objectPath = normalizeAvatarStoragePath(avatarValue);
  if (!objectPath) return;
  await client.storage.from(PROFILE_AVATAR_BUCKET).remove([objectPath]);
}
