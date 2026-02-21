import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessLog,
  ClassBooking,
  ClassWaitlistEntry,
  Contract,
  ContractAcceptance,
  CreateGymInput,
  GymCheckin,
  GymClass,
  GuildHallSnapshot,
  GuildRole,
  GuildRosterMember,
  Gym,
  GymMembership,
  GymMembershipPlan,
  GymRole,
  JoinGymInput,
  MembershipStatus,
  RankTier,
  Waiver,
  WaiverAcceptance
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";
import { slugify } from "./utils";

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
  timezone: string;
  is_public: boolean;
  owner_user_id: string;
};

type GymMembershipRow = {
  id: string;
  gym_id: string;
  user_id: string;
  role: GymRole;
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type GuildHallProfileRow = {
  rank_tier: RankTier;
  level: number;
  xp_total: number;
  chain_days: number;
};

type GuildRosterProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  rank_tier: RankTier | null;
};

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

export interface GymComplianceTaskCounts {
  activeMembers: number;
  activeWaivers: number;
  activeContracts: number;
  unresolvedWaiverTasks: number;
  unresolvedContractTasks: number;
}

export interface GymStaffOpsSnapshot {
  classes: GymClass[];
  selectedClassId?: string;
  selectedClassBookings: ClassBooking[];
  selectedClassWaitlist: ClassWaitlistEntry[];
  recentCheckins: GymCheckin[];
  recentAccessLogs: AccessLog[];
  pendingApprovals: number;
  complianceTasks: GymComplianceTaskCounts;
}

function mapGym(row: GymRow): Gym {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    motto: row.motto,
    description: row.description,
    sigilUrl: row.sigil_url,
    bannerUrl: row.banner_url,
    city: row.city,
    countryCode: row.country_code,
    timezone: row.timezone,
    isPublic: row.is_public,
    ownerUserId: row.owner_user_id
  };
}

function mapMembership(row: GymMembershipRow): GymMembership {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    role: row.role,
    membershipStatus: row.membership_status,
    membershipPlanId: row.membership_plan_id,
    startedAt: row.started_at,
    endsAt: row.ends_at
  };
}

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

function toGuildRole(role: GymRole): GuildRole {
  if (role === "leader") {
    return "leader";
  }

  if (role === "officer") {
    return "officer";
  }

  return "member";
}

function isStaffRole(role: GymRole): boolean {
  return role === "leader" || role === "officer" || role === "coach";
}

function rankMembershipStatus(status: MembershipStatus): number {
  switch (status) {
    case "active":
      return 0;
    case "trial":
      return 1;
    case "pending":
      return 2;
    case "paused":
      return 3;
    case "cancelled":
      return 4;
    default:
      return 5;
  }
}

function rankRole(role: GymRole): number {
  switch (role) {
    case "leader":
      return 0;
    case "officer":
      return 1;
    case "coach":
      return 2;
    case "member":
      return 3;
    default:
      return 4;
  }
}

function isActiveMembership(status: MembershipStatus): boolean {
  return status === "active" || status === "trial";
}

function sortMembershipRows(rows: GymMembershipRow[]): GymMembershipRow[] {
  return [...rows].sort((a, b) => {
    const statusRank = rankMembershipStatus(a.membership_status) - rankMembershipStatus(b.membership_status);
    if (statusRank !== 0) {
      return statusRank;
    }

    return rankRole(a.role) - rankRole(b.role);
  });
}

function utcDayBounds(date: Date): { start: string; end: string } {
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
}

export class GymService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listVisibleGyms(limit = 50): Promise<Gym[]> {
    const { data, error } = await this.supabase
      .from("gyms")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "GYM_LIST_FAILED", "Unable to load gyms.");

    return (data as GymRow[]).map(mapGym);
  }

  async getMembershipForGymUser(gymId: string, userId: string): Promise<GymMembership | null> {
    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("gym_id", gymId)
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(error, "GYM_MEMBERSHIP_READ_FAILED", "Unable to load gym membership.");

    return data ? mapMembership(data as GymMembershipRow) : null;
  }

  async createGymWithLeaderMembership(userId: string, input: CreateGymInput): Promise<{ gym: Gym; membership: GymMembership }> {
    const baseSlug = slugify(input.slug || input.name);

    if (!baseSlug) {
      throw new KruxtAppError("GYM_SLUG_INVALID", "Gym slug is required.");
    }

    let createdGym: GymRow | null = null;
    let lastError: unknown;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${Math.floor(Math.random() * 9000) + 1000}`;
      const candidateSlug = `${baseSlug}${suffix}`.slice(0, 64);

      const { data, error } = await this.supabase
        .from("gyms")
        .insert({
          slug: candidateSlug,
          name: input.name,
          motto: input.motto ?? null,
          description: input.description ?? null,
          city: input.city ?? null,
          country_code: input.countryCode ?? null,
          timezone: input.timezone ?? "Europe/Rome",
          is_public: input.isPublic ?? true,
          owner_user_id: userId
        })
        .select("*")
        .single();

      if (!error && data) {
        createdGym = data as GymRow;
        break;
      }

      const detail = String(error?.message ?? "").toLowerCase();
      if (detail.includes("duplicate") || detail.includes("gyms_slug_key")) {
        lastError = error;
        continue;
      }

      throwIfError(error, "GYM_CREATE_FAILED", "Unable to create gym.");
    }

    if (!createdGym) {
      throw new KruxtAppError(
        "GYM_SLUG_CONFLICT",
        "Unable to allocate a unique gym slug.",
        lastError
      );
    }

    const { data: membershipData, error: membershipError } = await this.supabase
      .from("gym_memberships")
      .upsert(
        {
          gym_id: createdGym.id,
          user_id: userId,
          role: "leader",
          membership_status: "active",
          started_at: new Date().toISOString()
        },
        { onConflict: "gym_id,user_id" }
      )
      .select("*")
      .single();

    throwIfError(membershipError, "GYM_LEADER_MEMBERSHIP_FAILED", "Unable to create leader membership.");

    return {
      gym: mapGym(createdGym),
      membership: mapMembership(membershipData as GymMembershipRow)
    };
  }

  async joinGym(userId: string, input: JoinGymInput): Promise<GymMembership> {
    const existing = await this.getMembershipForGymUser(input.gymId, userId);
    if (existing && (existing.membershipStatus === "active" || existing.membershipStatus === "trial")) {
      return existing;
    }

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .upsert(
        {
          gym_id: input.gymId,
          user_id: userId,
          role: existing?.role ?? "member",
          membership_status: "pending"
        },
        { onConflict: "gym_id,user_id" }
      )
      .select("*")
      .single();

    throwIfError(error, "GYM_JOIN_FAILED", "Unable to request gym membership.");

    return mapMembership(data as GymMembershipRow);
  }

  async listMyMemberships(userId: string): Promise<GymMembership[]> {
    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    throwIfError(error, "MEMBERSHIP_LIST_FAILED", "Unable to load memberships.");

    return (data as GymMembershipRow[]).map(mapMembership);
  }

  async getPrimaryMembership(userId: string): Promise<GymMembership | null> {
    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    throwIfError(error, "MEMBERSHIP_LIST_FAILED", "Unable to load memberships.");

    const memberships = sortMembershipRows((data as GymMembershipRow[]) ?? []);
    return memberships[0] ? mapMembership(memberships[0]) : null;
  }

  async getGuildHallSnapshot(userId: string): Promise<GuildHallSnapshot> {
    const { data: profileData, error: profileError } = await this.supabase
      .from("profiles")
      .select("rank_tier,level,xp_total,chain_days")
      .eq("id", userId)
      .maybeSingle();

    throwIfError(profileError, "GUILD_HALL_PROFILE_FAILED", "Unable to load profile for Guild Hall.");

    const { data: membershipData, error: membershipError } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    throwIfError(membershipError, "GUILD_HALL_MEMBERSHIPS_FAILED", "Unable to load memberships for Guild Hall.");

    const memberships = sortMembershipRows((membershipData as GymMembershipRow[]) ?? []);

    const primary = memberships[0];
    const profile = profileData as GuildHallProfileRow | null;

    if (!primary) {
      return {
        userId,
        isStaff: false,
        rosterCount: 0,
        pendingApprovals: 0,
        upcomingClasses: 0,
        rankTier: profile?.rank_tier,
        level: profile?.level,
        xpTotal: profile?.xp_total,
        chainDays: profile?.chain_days
      };
    }

    const { data: gymData, error: gymError } = await this.supabase
      .from("gyms")
      .select("*")
      .eq("id", primary.gym_id)
      .maybeSingle();

    throwIfError(gymError, "GUILD_HALL_GYM_FAILED", "Unable to load gym for Guild Hall.");

    const nowIso = new Date().toISOString();

    const { count: rosterCount, error: rosterError } = await this.supabase
      .from("gym_memberships")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", primary.gym_id)
      .in("membership_status", ["pending", "trial", "active"]);

    throwIfError(rosterError, "GUILD_HALL_ROSTER_FAILED", "Unable to load guild roster count.");

    let pendingApprovals = 0;
    if (isStaffRole(primary.role)) {
      const { count, error } = await this.supabase
        .from("gym_memberships")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", primary.gym_id)
        .eq("membership_status", "pending");

      throwIfError(error, "GUILD_HALL_PENDING_FAILED", "Unable to load pending approvals.");
      pendingApprovals = count ?? 0;
    }

    const { count: upcomingClasses, error: classesError } = await this.supabase
      .from("gym_classes")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", primary.gym_id)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso);

    throwIfError(classesError, "GUILD_HALL_CLASSES_FAILED", "Unable to load upcoming classes.");

    const gym = gymData as GymRow | null;

    return {
      userId,
      gymId: primary.gym_id,
      gymName: gym?.name,
      gymSlug: gym?.slug,
      role: primary.role,
      guildRole: toGuildRole(primary.role),
      membershipStatus: primary.membership_status,
      isStaff: isStaffRole(primary.role),
      rosterCount: rosterCount ?? 0,
      pendingApprovals,
      upcomingClasses: upcomingClasses ?? 0,
      rankTier: profile?.rank_tier,
      level: profile?.level,
      xpTotal: profile?.xp_total,
      chainDays: profile?.chain_days
    };
  }

  async listGuildRoster(gymId: string, limit = 50): Promise<GuildRosterMember[]> {
    const { data: membershipData, error: membershipError } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("gym_id", gymId)
      .in("membership_status", ["pending", "trial", "active"])
      .order("created_at", { ascending: true })
      .limit(limit);

    throwIfError(membershipError, "GUILD_ROSTER_MEMBERSHIPS_FAILED", "Unable to load guild roster.");

    const memberships = (membershipData as GymMembershipRow[]) ?? [];
    if (memberships.length === 0) {
      return [];
    }

    const userIds = Array.from(new Set(memberships.map((row) => row.user_id)));

    const { data: profileData, error: profileError } = await this.supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,level,rank_tier")
      .in("id", userIds);

    throwIfError(profileError, "GUILD_ROSTER_PROFILES_FAILED", "Unable to load guild member profiles.");

    const profileById = new Map<string, GuildRosterProfileRow>();
    for (const row of (profileData as GuildRosterProfileRow[]) ?? []) {
      profileById.set(row.id, row);
    }

    const rosterMembers = memberships
      .map((row): GuildRosterMember | null => {
        const profile = profileById.get(row.user_id);
        if (!profile) {
          return null;
        }

        return {
          membershipId: row.id,
          userId: row.user_id,
          role: row.role,
          guildRole: toGuildRole(row.role),
          membershipStatus: row.membership_status,
          displayName: profile.display_name,
          username: profile.username,
          avatarUrl: profile.avatar_url ?? undefined,
          level: profile.level,
          rankTier: profile.rank_tier ?? "initiate",
          joinedAt: row.started_at ?? row.created_at
        };
      })
      .filter((member): member is GuildRosterMember => member !== null)
      .sort((a, b) => {
        const roleDelta = rankRole(a.role) - rankRole(b.role);
        if (roleDelta !== 0) {
          return roleDelta;
        }

        return a.displayName.localeCompare(b.displayName);
      });

    return rosterMembers;
  }

  async getMembershipPlan(gymId: string, membershipPlanId: string): Promise<GymMembershipPlan | null> {
    const { data, error } = await this.supabase
      .from("gym_membership_plans")
      .select("*")
      .eq("gym_id", gymId)
      .eq("id", membershipPlanId)
      .maybeSingle();

    throwIfError(error, "GYM_MEMBERSHIP_PLAN_READ_FAILED", "Unable to load membership plan.");

    return data ? mapPlan(data as GymMembershipPlanRow) : null;
  }

  async listUpcomingClassesForMember(gymId: string, userId: string, limit = 20): Promise<GymClass[]> {
    const { data: bookingData, error: bookingError } = await this.supabase
      .from("class_bookings")
      .select("class_id,status,booked_at")
      .eq("user_id", userId)
      .in("status", ["booked", "waitlisted"])
      .order("booked_at", { ascending: false })
      .limit(Math.max(limit * 4, 40));

    throwIfError(bookingError, "GUILD_MEMBER_BOOKINGS_FAILED", "Unable to load class bookings.");

    const bookingRows = ((bookingData as Array<{ class_id: string }>) ?? []).filter(
      (row) => typeof row.class_id === "string" && row.class_id.length > 0
    );
    if (bookingRows.length === 0) {
      return [];
    }

    const classIds = Array.from(new Set(bookingRows.map((row) => row.class_id)));
    const { data: classData, error: classError } = await this.supabase
      .from("gym_classes")
      .select("*")
      .eq("gym_id", gymId)
      .in("id", classIds)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(Math.max(limit, 20));

    throwIfError(classError, "GUILD_MEMBER_CLASSES_FAILED", "Unable to load upcoming classes.");

    return ((classData as GymClassRow[]) ?? []).map(mapClass).slice(0, limit);
  }

  async listWaitlistEntriesForMember(gymId: string, userId: string, limit = 20): Promise<ClassWaitlistEntry[]> {
    const { data: waitlistData, error: waitlistError } = await this.supabase
      .from("class_waitlist")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "promoted"])
      .order("created_at", { ascending: false })
      .limit(Math.max(limit * 4, 40));

    throwIfError(waitlistError, "GUILD_MEMBER_WAITLIST_FAILED", "Unable to load waitlist status.");

    const waitlistRows = (waitlistData as ClassWaitlistRow[]) ?? [];
    if (waitlistRows.length === 0) {
      return [];
    }

    const classIds = Array.from(new Set(waitlistRows.map((row) => row.class_id)));
    const { data: classData, error: classError } = await this.supabase
      .from("gym_classes")
      .select("id,gym_id,status,starts_at")
      .eq("gym_id", gymId)
      .in("id", classIds)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString());

    throwIfError(classError, "GUILD_MEMBER_WAITLIST_CLASS_FAILED", "Unable to resolve waitlist classes.");

    const allowedClassIds = new Set(
      ((classData as Array<{ id: string }>) ?? []).map((row) => row.id).filter(Boolean)
    );

    return waitlistRows
      .filter((row) => allowedClassIds.has(row.class_id))
      .sort((left, right) => {
        if (left.position !== right.position) {
          return left.position - right.position;
        }
        return left.created_at.localeCompare(right.created_at);
      })
      .map(mapWaitlist)
      .slice(0, limit);
  }

  async listRecentCheckinsForMember(gymId: string, userId: string, limit = 20): Promise<GymCheckin[]> {
    const { data, error } = await this.supabase
      .from("gym_checkins")
      .select("*")
      .eq("gym_id", gymId)
      .eq("user_id", userId)
      .order("checked_in_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "GUILD_MEMBER_CHECKINS_FAILED", "Unable to load recent check-ins.");

    return ((data as GymCheckinRow[]) ?? []).map(mapCheckin);
  }

  async listRecentCheckins(gymId: string, limit = 150): Promise<GymCheckin[]> {
    const { data, error } = await this.supabase
      .from("gym_checkins")
      .select("*")
      .eq("gym_id", gymId)
      .order("checked_in_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "GUILD_STAFF_CHECKINS_FAILED", "Unable to load gym check-ins.");

    return ((data as GymCheckinRow[]) ?? []).map(mapCheckin);
  }

  async listActiveWaivers(gymId: string): Promise<Waiver[]> {
    const { data, error } = await this.supabase
      .from("waivers")
      .select("*")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("effective_at", { ascending: false });

    throwIfError(error, "GUILD_WAIVERS_READ_FAILED", "Unable to load waivers.");

    return ((data as WaiverRow[]) ?? []).map(mapWaiver);
  }

  async listActiveContracts(gymId: string): Promise<Contract[]> {
    const { data, error } = await this.supabase
      .from("contracts")
      .select("*")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("effective_at", { ascending: false });

    throwIfError(error, "GUILD_CONTRACTS_READ_FAILED", "Unable to load contracts.");

    return ((data as ContractRow[]) ?? []).map(mapContract);
  }

  async listMyWaiverAcceptances(userId: string, waiverIds: string[], limit = 200): Promise<WaiverAcceptance[]> {
    if (waiverIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("waiver_acceptances")
      .select("*")
      .eq("user_id", userId)
      .in("waiver_id", waiverIds)
      .order("accepted_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "GUILD_WAIVER_ACCEPTANCES_READ_FAILED", "Unable to load waiver acceptances.");

    return ((data as WaiverAcceptanceRow[]) ?? []).map(mapWaiverAcceptance);
  }

  async listMyContractAcceptances(userId: string, contractIds: string[], limit = 200): Promise<ContractAcceptance[]> {
    if (contractIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("contract_acceptances")
      .select("*")
      .eq("user_id", userId)
      .in("contract_id", contractIds)
      .order("accepted_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "GUILD_CONTRACT_ACCEPTANCES_READ_FAILED", "Unable to load contract acceptances.");

    return ((data as ContractAcceptanceRow[]) ?? []).map(mapContractAcceptance);
  }

  async listTodayClasses(gymId: string, date = new Date(), limit = 120): Promise<GymClass[]> {
    const bounds = utcDayBounds(date);

    const { data, error } = await this.supabase
      .from("gym_classes")
      .select("*")
      .eq("gym_id", gymId)
      .eq("status", "scheduled")
      .gte("starts_at", bounds.start)
      .lt("starts_at", bounds.end)
      .order("starts_at", { ascending: true })
      .limit(limit);

    throwIfError(error, "GUILD_STAFF_CLASSES_FAILED", "Unable to load today's classes.");

    return ((data as GymClassRow[]) ?? []).map(mapClass);
  }

  async listClassBookings(gymId: string, classId: string, limit = 300): Promise<ClassBooking[]> {
    const { data: gymClass, error: classError } = await this.supabase
      .from("gym_classes")
      .select("id,gym_id")
      .eq("id", classId)
      .maybeSingle();

    throwIfError(classError, "GUILD_STAFF_CLASS_LOOKUP_FAILED", "Unable to resolve class.");

    if (!gymClass || (gymClass as { gym_id: string }).gym_id !== gymId) {
      throw new KruxtAppError("GUILD_STAFF_CLASS_NOT_FOUND", "Class not found for this gym.");
    }

    const { data, error } = await this.supabase
      .from("class_bookings")
      .select("*")
      .eq("class_id", classId)
      .order("booked_at", { ascending: true })
      .limit(limit);

    throwIfError(error, "GUILD_STAFF_BOOKINGS_FAILED", "Unable to load class bookings.");

    return ((data as ClassBookingRow[]) ?? []).map(mapBooking);
  }

  async listClassWaitlist(gymId: string, classId: string, limit = 300): Promise<ClassWaitlistEntry[]> {
    const { data: gymClass, error: classError } = await this.supabase
      .from("gym_classes")
      .select("id,gym_id")
      .eq("id", classId)
      .maybeSingle();

    throwIfError(classError, "GUILD_STAFF_CLASS_LOOKUP_FAILED", "Unable to resolve class.");

    if (!gymClass || (gymClass as { gym_id: string }).gym_id !== gymId) {
      throw new KruxtAppError("GUILD_STAFF_CLASS_NOT_FOUND", "Class not found for this gym.");
    }

    const { data, error } = await this.supabase
      .from("class_waitlist")
      .select("*")
      .eq("class_id", classId)
      .order("position", { ascending: true })
      .limit(limit);

    throwIfError(error, "GUILD_STAFF_WAITLIST_FAILED", "Unable to load class waitlist.");

    return ((data as ClassWaitlistRow[]) ?? []).map(mapWaitlist);
  }

  async listRecentAccessLogs(gymId: string, limit = 150): Promise<AccessLog[]> {
    const { data, error } = await this.supabase
      .from("access_logs")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "GUILD_STAFF_ACCESS_LOGS_FAILED", "Unable to load access logs.");

    return ((data as AccessLogRow[]) ?? []).map(mapAccessLog);
  }

  async countPendingMembershipApprovals(gymId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("gym_memberships")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("membership_status", "pending");

    throwIfError(error, "GUILD_STAFF_PENDING_APPROVALS_FAILED", "Unable to load pending approvals.");

    return count ?? 0;
  }

  async getComplianceTaskCounts(gymId: string): Promise<GymComplianceTaskCounts> {
    const [activeWaivers, activeContracts] = await Promise.all([
      this.listActiveWaivers(gymId),
      this.listActiveContracts(gymId)
    ]);

    const { data: activeMemberships, error: membershipsError } = await this.supabase
      .from("gym_memberships")
      .select("user_id,membership_status")
      .eq("gym_id", gymId)
      .in("membership_status", ["active", "trial"]);

    throwIfError(
      membershipsError,
      "GUILD_STAFF_COMPLIANCE_MEMBERSHIPS_FAILED",
      "Unable to load active members for compliance checks."
    );

    const activeMemberIds = Array.from(
      new Set(
        ((activeMemberships as Array<{ user_id: string }>) ?? [])
          .map((row) => row.user_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const waiverIds = activeWaivers.map((waiver) => waiver.id);
    const contractIds = activeContracts.map((contract) => contract.id);

    const [waiverAcceptances, contractAcceptances] = await Promise.all([
      waiverIds.length > 0 && activeMemberIds.length > 0
        ? this.supabase
            .from("waiver_acceptances")
            .select("waiver_id,user_id")
            .in("waiver_id", waiverIds)
            .in("user_id", activeMemberIds)
        : Promise.resolve({ data: [], error: null }),
      contractIds.length > 0 && activeMemberIds.length > 0
        ? this.supabase
            .from("contract_acceptances")
            .select("contract_id,user_id")
            .in("contract_id", contractIds)
            .in("user_id", activeMemberIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    throwIfError(
      waiverAcceptances.error,
      "GUILD_STAFF_WAIVER_ACCEPTANCES_FAILED",
      "Unable to load waiver acceptance coverage."
    );
    throwIfError(
      contractAcceptances.error,
      "GUILD_STAFF_CONTRACT_ACCEPTANCES_FAILED",
      "Unable to load contract acceptance coverage."
    );

    const waiverAcceptanceKeys = new Set(
      (((waiverAcceptances.data as Array<{ waiver_id: string; user_id: string }>) ?? []).map(
        (row) => `${row.user_id}:${row.waiver_id}`
      ))
    );
    const contractAcceptanceKeys = new Set(
      (((contractAcceptances.data as Array<{ contract_id: string; user_id: string }>) ?? []).map(
        (row) => `${row.user_id}:${row.contract_id}`
      ))
    );

    let unresolvedWaiverTasks = 0;
    for (const userId of activeMemberIds) {
      for (const waiverId of waiverIds) {
        if (!waiverAcceptanceKeys.has(`${userId}:${waiverId}`)) {
          unresolvedWaiverTasks += 1;
        }
      }
    }

    let unresolvedContractTasks = 0;
    for (const userId of activeMemberIds) {
      for (const contractId of contractIds) {
        if (!contractAcceptanceKeys.has(`${userId}:${contractId}`)) {
          unresolvedContractTasks += 1;
        }
      }
    }

    return {
      activeMembers: activeMemberIds.length,
      activeWaivers: waiverIds.length,
      activeContracts: contractIds.length,
      unresolvedWaiverTasks,
      unresolvedContractTasks
    };
  }

  async assertStaffAccess(gymId: string, userId: string): Promise<GymMembership> {
    const membership = await this.getMembershipForGymUser(gymId, userId);
    if (!membership) {
      throw new KruxtAppError("GUILD_MEMBERSHIP_REQUIRED", "Gym membership is required.");
    }

    if (!isStaffRole(membership.role)) {
      throw new KruxtAppError("GUILD_STAFF_REQUIRED", "Staff role is required for this action.");
    }

    if (!isActiveMembership(membership.membershipStatus)) {
      throw new KruxtAppError("GUILD_STAFF_INACTIVE", "Staff membership must be active.");
    }

    return membership;
  }

  async loadStaffOpsSnapshot(
    gymId: string,
    staffUserId: string,
    preferredClassId?: string
  ): Promise<GymStaffOpsSnapshot> {
    await this.assertStaffAccess(gymId, staffUserId);

    const classes = await this.listTodayClasses(gymId);
    const selectedClassId =
      preferredClassId && classes.some((gymClass) => gymClass.id === preferredClassId)
        ? preferredClassId
        : classes[0]?.id;

    const [selectedClassBookings, selectedClassWaitlist, recentCheckins, recentAccessLogs, pendingApprovals, complianceTasks] =
      await Promise.all([
        selectedClassId ? this.listClassBookings(gymId, selectedClassId) : Promise.resolve([]),
        selectedClassId ? this.listClassWaitlist(gymId, selectedClassId) : Promise.resolve([]),
        this.listRecentCheckins(gymId, 150),
        this.listRecentAccessLogs(gymId, 150),
        this.countPendingMembershipApprovals(gymId),
        this.getComplianceTaskCounts(gymId)
      ]);

    return {
      classes,
      selectedClassId,
      selectedClassBookings,
      selectedClassWaitlist,
      recentCheckins,
      recentAccessLogs,
      pendingApprovals,
      complianceTasks
    };
  }
}
