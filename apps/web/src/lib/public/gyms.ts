import type { BillingInterval, GymRole, MembershipStatus } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type GymRow = {
  id: string;
  slug: string;
  name: string;
  motto: string | null;
  description: string | null;
  sigil_url: string | null;
  banner_url: string | null;
  city: string | null;
  country_code: string | null;
};

type BrandRow = {
  gym_id: string;
  app_display_name: string | null;
  logo_url: string | null;
  icon_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  launch_screen_message: string | null;
  metadata: Record<string, unknown> | null;
};

type MembershipPlanRow = {
  id: string;
  gym_id: string;
  name: string;
  billing_cycle: BillingInterval;
  price_cents: number;
  currency: string;
  class_credits_per_cycle: number | null;
  trial_days: number | null;
  cancel_policy: string | null;
};

type MembershipRow = {
  id: string;
  gym_id: string;
  role: GymRole;
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
};

type JoinRequestRow = {
  id: string;
  gym_id: string;
  requested_membership_plan_id: string | null;
  source: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  created_at: string;
};

export interface PublicGymPlan {
  id: string;
  name: string;
  billingCycle: BillingInterval;
  priceCents: number;
  currency: string;
  classCreditsPerCycle: number | null;
  trialDays: number | null;
  cancelPolicy: string | null;
}

export interface PublicGymBrand {
  displayName: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  surfaceColor: string | null;
  textColor: string | null;
  launchMessage: string | null;
  publicPage: {
    visibleMembershipPlanIds: string[] | null;
    scheduleVisible: boolean | null;
    publishedAt: string | null;
  } | null;
}

export interface PublicGymDirectoryItem {
  id: string;
  slug: string;
  name: string;
  motto: string | null;
  description: string | null;
  sigilUrl: string | null;
  bannerUrl: string | null;
  city: string | null;
  countryCode: string | null;
  brand: PublicGymBrand | null;
  plans: PublicGymPlan[];
  membership: {
    id: string;
    role: GymRole;
    status: MembershipStatus;
    planId: string | null;
  } | null;
  latestRequest: {
    id: string;
    planId: string | null;
    source: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    note: string | null;
    createdAt: string;
  } | null;
}

function mapPlan(row: MembershipPlanRow): PublicGymPlan {
  return {
    id: row.id,
    name: row.name,
    billingCycle: row.billing_cycle,
    priceCents: row.price_cents,
    currency: row.currency,
    classCreditsPerCycle: row.class_credits_per_cycle,
    trialDays: row.trial_days,
    cancelPolicy: row.cancel_policy
  };
}

function mapPublicPageMetadata(metadata: Record<string, unknown> | null): PublicGymBrand["publicPage"] {
  const publicPage = metadata?.publicPage;
  if (!publicPage || typeof publicPage !== "object" || Array.isArray(publicPage)) {
    return null;
  }

  const page = publicPage as Record<string, unknown>;
  const rawPlanIds = page.visibleMembershipPlanIds;
  return {
    visibleMembershipPlanIds: Array.isArray(rawPlanIds)
      ? rawPlanIds.filter((planId): planId is string => typeof planId === "string")
      : null,
    scheduleVisible: typeof page.scheduleVisible === "boolean" ? page.scheduleVisible : null,
    publishedAt: typeof page.publishedAt === "string" ? page.publishedAt : null
  };
}

function mapBrand(row: BrandRow): PublicGymBrand {
  return {
    displayName: row.app_display_name,
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
    bannerUrl: row.banner_url,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    surfaceColor: row.surface_color,
    textColor: row.text_color,
    launchMessage: row.launch_screen_message,
    publicPage: mapPublicPageMetadata(row.metadata)
  };
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

export async function listPublicGyms(client: SupabaseClient): Promise<PublicGymDirectoryItem[]> {
  const userId = await requireUserId(client);

  const { data: gymsData, error: gymsError } = await client
    .from("gyms")
    .select("id,slug,name,motto,description,sigil_url,banner_url,city,country_code")
    .eq("is_public", true)
    .order("name", { ascending: true });

  if (gymsError) {
    throw new Error(gymsError.message || "Unable to load gyms.");
  }

  const gyms = ((gymsData ?? []) as GymRow[]) ?? [];
  if (gyms.length === 0) return [];

  const gymIds = gyms.map((gym) => gym.id);

  const [brandResponse, planResponse, membershipResponse, requestResponse] = await Promise.all([
    client
      .from("gym_brand_settings")
      .select(
        "gym_id,app_display_name,logo_url,icon_url,banner_url,primary_color,accent_color,background_color,surface_color,text_color,launch_screen_message,metadata"
      )
      .in("gym_id", gymIds),
    client
      .from("gym_membership_plans")
      .select("id,gym_id,name,billing_cycle,price_cents,currency,class_credits_per_cycle,trial_days,cancel_policy")
      .in("gym_id", gymIds)
      .eq("is_active", true)
      .order("price_cents", { ascending: true }),
    client
      .from("gym_memberships")
      .select("id,gym_id,role,membership_status,membership_plan_id")
      .eq("user_id", userId)
      .in("gym_id", gymIds),
    client
      .from("gym_join_requests")
      .select("id,gym_id,requested_membership_plan_id,source,status,note,created_at")
      .eq("user_id", userId)
      .in("gym_id", gymIds)
      .order("created_at", { ascending: false })
  ]);

  if (brandResponse.error) {
    throw new Error(brandResponse.error.message || "Unable to load gym branding.");
  }
  if (planResponse.error) {
    throw new Error(planResponse.error.message || "Unable to load gym plans.");
  }
  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message || "Unable to load memberships.");
  }
  if (requestResponse.error) {
    throw new Error(requestResponse.error.message || "Unable to load access requests.");
  }

  const brandMap = new Map<string, PublicGymBrand>();
  for (const row of ((brandResponse.data ?? []) as BrandRow[]) ?? []) {
    brandMap.set(row.gym_id, mapBrand(row));
  }

  const planMap = new Map<string, PublicGymPlan[]>();
  for (const row of ((planResponse.data ?? []) as MembershipPlanRow[]) ?? []) {
    const list = planMap.get(row.gym_id) ?? [];
    list.push(mapPlan(row));
    planMap.set(row.gym_id, list);
  }

  const membershipMap = new Map<string, MembershipRow>();
  for (const row of ((membershipResponse.data ?? []) as MembershipRow[]) ?? []) {
    membershipMap.set(row.gym_id, row);
  }

  const requestMap = new Map<string, JoinRequestRow>();
  for (const row of ((requestResponse.data ?? []) as JoinRequestRow[]) ?? []) {
    if (!requestMap.has(row.gym_id)) {
      requestMap.set(row.gym_id, row);
    }
  }

  return gyms.map((gym) => {
    const membership = membershipMap.get(gym.id) ?? null;
    const latestRequest = requestMap.get(gym.id) ?? null;
    const brand = brandMap.get(gym.id) ?? null;
    const planIds = brand?.publicPage?.visibleMembershipPlanIds ?? null;
    const plans = planMap.get(gym.id) ?? [];
    const visiblePlanSet = planIds ? new Set(planIds) : null;

    return {
      id: gym.id,
      slug: gym.slug,
      name: gym.name,
      motto: gym.motto,
      description: gym.description,
      sigilUrl: gym.sigil_url,
      bannerUrl: gym.banner_url,
      city: gym.city,
      countryCode: gym.country_code,
      brand,
      plans: visiblePlanSet ? plans.filter((plan) => visiblePlanSet.has(plan.id)) : plans,
      membership: membership
        ? {
            id: membership.id,
            role: membership.role,
            status: membership.membership_status,
            planId: membership.membership_plan_id
          }
        : null,
      latestRequest: latestRequest
        ? {
            id: latestRequest.id,
            planId: latestRequest.requested_membership_plan_id,
            source: latestRequest.source,
            status: latestRequest.status,
            note: latestRequest.note,
            createdAt: latestRequest.created_at
          }
        : null
    };
  });
}

export async function requestPublicGymAccess(
  client: SupabaseClient,
  input: { gymId: string; membershipPlanId?: string | null; note?: string | null }
): Promise<string> {
  const { data, error } = await client.rpc("request_gym_membership", {
    p_gym_id: input.gymId,
    p_membership_plan_id: input.membershipPlanId ?? null,
    p_note: input.note?.trim() ? input.note.trim() : null
  });

  if (error) {
    throw new Error(error.message || "Unable to request gym access.");
  }

  return String(data);
}
