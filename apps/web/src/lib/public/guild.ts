import type { GuildRole, GymRole, MembershipStatus, RankTier } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type MembershipRow = {
  id: string;
  gym_id: string;
  user_id: string;
  role: GymRole;
  membership_status: MembershipStatus;
  started_at: string | null;
  created_at: string;
};

type ProfileSummaryRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: number | null;
  rank_tier: RankTier | null;
  xp_total: number | null;
  chain_days: number | null;
};

type GymRow = {
  id: string;
  slug: string;
  name: string;
};

type ClassRow = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
};

export interface GuildOverview {
  userId: string;
  gymId: string | null;
  gymName: string | null;
  gymSlug: string | null;
  role: GymRole | null;
  guildRole: GuildRole | null;
  membershipStatus: MembershipStatus | null;
  isStaff: boolean;
  rosterCount: number;
  pendingApprovals: number;
  upcomingClasses: number;
  rankTier: RankTier;
  level: number;
  xpTotal: number;
  chainDays: number;
  upcomingClassItems: Array<{
    id: string;
    title: string;
    startsAt: string;
  }>;
}

export interface GuildRosterItem {
  membershipId: string;
  userId: string;
  role: GymRole;
  guildRole: GuildRole;
  membershipStatus: MembershipStatus;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  rankTier: RankTier;
  joinedAt: string | null;
}

function toGuildRole(role: GymRole): GuildRole {
  if (role === "leader") return "leader";
  if (role === "officer") return "officer";
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

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

export async function loadGuildOverview(client: SupabaseClient): Promise<GuildOverview> {
  const userId = await requireUser(client);

  const [{ data: profileData, error: profileError }, { data: membershipData, error: membershipError }] =
    await Promise.all([
      client
        .from("profiles")
        .select("id,username,display_name,avatar_url,level,rank_tier,xp_total,chain_days")
        .eq("id", userId)
        .maybeSingle(),
      client
        .from("gym_memberships")
        .select("id,gym_id,user_id,role,membership_status,started_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    ]);

  if (profileError) {
    throw new Error(profileError.message || "Unable to load guild profile.");
  }
  if (membershipError) {
    throw new Error(membershipError.message || "Unable to load guild memberships.");
  }

  const memberships = (((membershipData ?? []) as MembershipRow[]) ?? []).sort((left, right) => {
    const statusDelta = rankMembershipStatus(left.membership_status) - rankMembershipStatus(right.membership_status);
    if (statusDelta !== 0) return statusDelta;
    return rankRole(left.role) - rankRole(right.role);
  });

  const primary = memberships[0] ?? null;
  const profile = (profileData as ProfileSummaryRow | null) ?? null;

  if (!primary) {
    return {
      userId,
      gymId: null,
      gymName: null,
      gymSlug: null,
      role: null,
      guildRole: null,
      membershipStatus: null,
      isStaff: false,
      rosterCount: 0,
      pendingApprovals: 0,
      upcomingClasses: 0,
      rankTier: profile?.rank_tier ?? "initiate",
      level: profile?.level ?? 1,
      xpTotal: profile?.xp_total ?? 0,
      chainDays: profile?.chain_days ?? 0,
      upcomingClassItems: []
    };
  }

  const nowIso = new Date().toISOString();
  const [gymResponse, rosterCountResponse, pendingResponse, upcomingCountResponse, upcomingClassesResponse] =
    await Promise.all([
      client.from("gyms").select("id,slug,name").eq("id", primary.gym_id).maybeSingle(),
      client
        .from("gym_memberships")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", primary.gym_id)
        .in("membership_status", ["pending", "trial", "active"]),
      isStaffRole(primary.role)
        ? client
            .from("gym_memberships")
            .select("id", { count: "exact", head: true })
            .eq("gym_id", primary.gym_id)
            .eq("membership_status", "pending")
        : Promise.resolve({ count: 0, error: null }),
      client
        .from("gym_classes")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", primary.gym_id)
        .eq("status", "scheduled")
        .gte("starts_at", nowIso),
      client
        .from("gym_classes")
        .select("id,title,starts_at,status")
        .eq("gym_id", primary.gym_id)
        .eq("status", "scheduled")
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(5)
    ]);

  if (gymResponse.error) {
    throw new Error(gymResponse.error.message || "Unable to load guild gym.");
  }
  if (rosterCountResponse.error) {
    throw new Error(rosterCountResponse.error.message || "Unable to load guild roster.");
  }
  if (pendingResponse.error) {
    throw new Error(pendingResponse.error.message || "Unable to load pending approvals.");
  }
  if (upcomingCountResponse.error) {
    throw new Error(upcomingCountResponse.error.message || "Unable to load upcoming class count.");
  }
  if (upcomingClassesResponse.error) {
    throw new Error(upcomingClassesResponse.error.message || "Unable to load upcoming classes.");
  }

  const gym = (gymResponse.data as GymRow | null) ?? null;
  const upcomingClassItems = (((upcomingClassesResponse.data ?? []) as ClassRow[]) ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    startsAt: item.starts_at
  }));

  return {
    userId,
    gymId: primary.gym_id,
    gymName: gym?.name ?? null,
    gymSlug: gym?.slug ?? null,
    role: primary.role,
    guildRole: toGuildRole(primary.role),
    membershipStatus: primary.membership_status,
    isStaff: isStaffRole(primary.role),
    rosterCount: rosterCountResponse.count ?? 0,
    pendingApprovals: pendingResponse.count ?? 0,
    upcomingClasses: upcomingCountResponse.count ?? 0,
    rankTier: profile?.rank_tier ?? "initiate",
    level: profile?.level ?? 1,
    xpTotal: profile?.xp_total ?? 0,
    chainDays: profile?.chain_days ?? 0,
    upcomingClassItems
  };
}

export async function loadGuildRoster(client: SupabaseClient, gymId: string, limit = 24): Promise<GuildRosterItem[]> {
  const { data: membershipData, error: membershipError } = await client
    .from("gym_memberships")
    .select("id,gym_id,user_id,role,membership_status,started_at,created_at")
    .eq("gym_id", gymId)
    .in("membership_status", ["pending", "trial", "active"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (membershipError) {
    throw new Error(membershipError.message || "Unable to load guild roster.");
  }

  const memberships = ((membershipData ?? []) as MembershipRow[]) ?? [];
  if (memberships.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(memberships.map((item) => item.user_id)));
  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select("id,username,display_name,avatar_url,level,rank_tier")
    .in("id", userIds);

  if (profileError) {
    throw new Error(profileError.message || "Unable to load guild member profiles.");
  }

  const profileMap = new Map<string, ProfileSummaryRow>(
    ((((profileData ?? []) as ProfileSummaryRow[]) ?? []).map((profile) => [profile.id, profile]))
  );

  return memberships
    .map((membership): GuildRosterItem | null => {
      const profile = profileMap.get(membership.user_id);
      if (!profile) return null;

      return {
        membershipId: membership.id,
        userId: membership.user_id,
        role: membership.role,
        guildRole: toGuildRole(membership.role),
        membershipStatus: membership.membership_status,
        displayName: profile.display_name || profile.username || "KRUXT Athlete",
        username: profile.username || "member",
        avatarUrl: profile.avatar_url ?? null,
        level: profile.level ?? 1,
        rankTier: profile.rank_tier ?? "initiate",
        joinedAt: membership.started_at ?? membership.created_at
      };
    })
    .filter((item): item is GuildRosterItem => item !== null)
    .sort((left, right) => {
      const roleDelta = rankRole(left.role) - rankRole(right.role);
      if (roleDelta !== 0) return roleDelta;
      return left.displayName.localeCompare(right.displayName);
    });
}
