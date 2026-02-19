import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateGymInput,
  GuildHallSnapshot,
  GuildRole,
  GuildRosterMember,
  Gym,
  GymMembership,
  GymRole,
  JoinGymInput,
  MembershipStatus,
  RankTier
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

    const memberships = (membershipData as GymMembershipRow[]).sort((a, b) => {
      const statusRank = rankMembershipStatus(a.membership_status) - rankMembershipStatus(b.membership_status);
      if (statusRank !== 0) {
        return statusRank;
      }

      return rankRole(a.role) - rankRole(b.role);
    });

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

    return memberships
      .map((row) => {
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
          avatarUrl: profile.avatar_url,
          level: profile.level,
          rankTier: profile.rank_tier ?? "initiate",
          joinedAt: row.started_at ?? row.created_at
        } satisfies GuildRosterMember;
      })
      .filter((member): member is GuildRosterMember => member !== null)
      .sort((a, b) => {
        const roleDelta = rankRole(a.role) - rankRole(b.role);
        if (roleDelta !== 0) {
          return roleDelta;
        }

        return a.displayName.localeCompare(b.displayName);
      });
  }
}
