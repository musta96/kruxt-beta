import type { GymRole, MembershipStatus, SubscriptionStatus } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GymRecord {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  timezone: string;
  ownerUserId: string;
  ownerLabel: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionProvider: string;
  createdAt: string;
}

export interface MembershipRecord {
  id: string;
  gymId: string;
  userId: string;
  role: GymRole;
  membershipStatus: MembershipStatus;
  startedAt: string;
  profileLabel: string;
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface InviteRecord {
  id: string;
  gymId: string;
  email: string;
  role: GymRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
}

export interface ProfileSearchResult {
  userId: string;
  label: string;
}

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

function profileLabel(profile?: ProfileRow): string {
  if (!profile) return "Unknown";
  if (profile.display_name) return profile.display_name;
  if (profile.username) return `@${profile.username}`;
  return `${profile.id.slice(0, 8)}...`;
}

export async function listGyms(client: SupabaseClient, allowedGymIds?: string[] | null): Promise<GymRecord[]> {
  if (Array.isArray(allowedGymIds) && allowedGymIds.length === 0) {
    return [];
  }

  let gymsQuery = client
    .from("gyms")
    .select("id,slug,name,city,country_code,timezone,owner_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (Array.isArray(allowedGymIds)) {
    gymsQuery = gymsQuery.in("id", allowedGymIds);
  }

  const { data: gymsData, error: gymsError } = await gymsQuery;
  if (gymsError) throw new Error(gymsError.message || "Unable to load gyms.");

  const gyms =
    (gymsData as Array<{
      id: string;
      slug: string;
      name: string;
      city: string | null;
      country_code: string | null;
      timezone: string;
      owner_user_id: string;
      created_at: string;
    }> | null) ?? [];

  if (gyms.length === 0) return [];

  const ownerIds = Array.from(new Set(gyms.map((gym) => gym.owner_user_id)));
  const gymIds = gyms.map((gym) => gym.id);

  const profileMap = new Map<string, ProfileRow>();
  if (ownerIds.length > 0) {
    const { data: profilesData } = await client
      .from("profiles")
      .select("id,display_name,username")
      .in("id", ownerIds);

    for (const profile of (profilesData as ProfileRow[] | null) ?? []) {
      profileMap.set(profile.id, profile);
    }
  }

  const subscriptionsMap = new Map<string, { status: SubscriptionStatus; provider: string }>();
  if (gymIds.length > 0) {
    const { data: subscriptionsData } = await client
      .from("gym_platform_subscriptions")
      .select("gym_id,status,provider,updated_at")
      .in("gym_id", gymIds)
      .order("updated_at", { ascending: false });

    for (const row of
      ((subscriptionsData as Array<{ gym_id: string; status: SubscriptionStatus; provider: string }> | null) ?? [])) {
      if (!subscriptionsMap.has(row.gym_id)) {
        subscriptionsMap.set(row.gym_id, { status: row.status, provider: row.provider });
      }
    }
  }

  return gyms.map((gym) => {
    const owner = profileMap.get(gym.owner_user_id);
    const subscription = subscriptionsMap.get(gym.id);

    return {
      id: gym.id,
      slug: gym.slug,
      name: gym.name,
      city: gym.city,
      countryCode: gym.country_code,
      timezone: gym.timezone,
      ownerUserId: gym.owner_user_id,
      ownerLabel: profileLabel(owner),
      subscriptionStatus: subscription?.status ?? "incomplete",
      subscriptionProvider: subscription?.provider ?? "manual",
      createdAt: gym.created_at
    };
  });
}

export async function createGym(
  client: SupabaseClient,
  input: {
    name: string;
    slug: string;
    city?: string;
    countryCode?: string;
    timezone?: string;
    ownerUserId?: string;
    subscriptionStatus?: SubscriptionStatus;
  }
): Promise<void> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Authentication required.");
  }

  const ownerUserId = input.ownerUserId?.trim() || authData.user.id;
  const { data: gymData, error: gymError } = await client
    .from("gyms")
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      city: input.city?.trim() || null,
      country_code: input.countryCode?.trim().toUpperCase() || null,
      timezone: input.timezone?.trim() || "Europe/Rome",
      is_public: true,
      owner_user_id: ownerUserId
    })
    .select("id")
    .single();

  if (gymError || !gymData) {
    throw new Error(gymError?.message || "Unable to create gym.");
  }

  const gymId = (gymData as { id: string }).id;

  const { error: membershipError } = await client
    .from("gym_memberships")
    .upsert(
      {
        gym_id: gymId,
        user_id: ownerUserId,
        role: "leader",
        membership_status: "active",
        started_at: new Date().toISOString()
      },
      { onConflict: "gym_id,user_id" }
    );

  if (membershipError) {
    throw new Error(membershipError.message || "Gym created, but owner membership failed.");
  }

  const { error: subscriptionError } = await client
    .from("gym_platform_subscriptions")
    .upsert(
      {
        gym_id: gymId,
        provider: "manual",
        status: input.subscriptionStatus ?? "trialing"
      },
      { onConflict: "gym_id,provider" }
    );

  if (subscriptionError) {
    throw new Error(subscriptionError.message || "Gym created, but subscription setup failed.");
  }
}

export async function updateGym(
  client: SupabaseClient,
  gymId: string,
  input: {
    name: string;
    slug: string;
    city?: string;
    countryCode?: string;
    timezone?: string;
    ownerUserId?: string;
    subscriptionStatus?: SubscriptionStatus;
  }
): Promise<void> {
  const updatePayload: Record<string, string | null> = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    city: input.city?.trim() || null,
    country_code: input.countryCode?.trim().toUpperCase() || null,
    timezone: input.timezone?.trim() || "Europe/Rome",
    updated_at: new Date().toISOString()
  };

  if (input.ownerUserId?.trim()) {
    updatePayload.owner_user_id = input.ownerUserId.trim();
  }

  const { error: gymError } = await client
    .from("gyms")
    .update(updatePayload)
    .eq("id", gymId);

  if (gymError) {
    throw new Error(gymError.message || "Unable to update gym.");
  }

  if (input.subscriptionStatus) {
    const { error: subscriptionError } = await client
      .from("gym_platform_subscriptions")
      .upsert(
        {
          gym_id: gymId,
          provider: "manual",
          status: input.subscriptionStatus
        },
        { onConflict: "gym_id,provider" }
      );

    if (subscriptionError) {
      throw new Error(subscriptionError.message || "Gym updated, but subscription update failed.");
    }
  }
}

export async function verifyCurrentUserPassword(client: SupabaseClient, password: string): Promise<void> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) {
    throw new Error("Authentication required.");
  }

  const { error: signInError } = await client.auth.signInWithPassword({
    email: data.user.email,
    password
  });

  if (signInError) {
    throw new Error("Password confirmation failed.");
  }
}

export async function deleteGym(client: SupabaseClient, gymId: string): Promise<void> {
  const { error } = await client.from("gyms").delete().eq("id", gymId);
  if (error) {
    throw new Error(
      error.message ||
        "Unable to delete gym. Remove dependent records first (memberships/classes/billing links)."
    );
  }
}

export async function searchProfiles(
  client: SupabaseClient,
  query: string
): Promise<ProfileSearchResult[]> {
  const needle = query.trim();
  if (!needle) return [];

  const { data, error } = await client
    .from("profiles")
    .select("id,display_name,username")
    .or(`display_name.ilike.%${needle}%,username.ilike.%${needle}%`)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message || "Unable to search users.");
  }

  return ((data as ProfileRow[] | null) ?? []).map((profile) => ({
    userId: profile.id,
    label: profileLabel(profile)
  }));
}

export async function listMemberships(client: SupabaseClient, gymId: string): Promise<MembershipRecord[]> {
  const { data: membershipsData, error: membershipsError } = await client
    .from("gym_memberships")
    .select("id,gym_id,user_id,role,membership_status,started_at")
    .eq("gym_id", gymId)
    .order("started_at", { ascending: false })
    .limit(500);

  if (membershipsError) {
    throw new Error(membershipsError.message || "Unable to load memberships.");
  }

  const memberships =
    (membershipsData as Array<{
      id: string;
      gym_id: string;
      user_id: string;
      role: GymRole;
      membership_status: MembershipStatus;
      started_at: string;
    }> | null) ?? [];

  const userIds = Array.from(new Set(memberships.map((item) => item.user_id)));
  const profileMap = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const { data: profilesData } = await client
      .from("profiles")
      .select("id,display_name,username")
      .in("id", userIds);

    for (const profile of (profilesData as ProfileRow[] | null) ?? []) {
      profileMap.set(profile.id, profile);
    }
  }

  return memberships.map((item) => ({
    id: item.id,
    gymId: item.gym_id,
    userId: item.user_id,
    role: item.role,
    membershipStatus: item.membership_status,
    startedAt: item.started_at,
    profileLabel: profileLabel(profileMap.get(item.user_id))
  }));
}

export async function updateMembership(
  client: SupabaseClient,
  input: { membershipId: string; role: GymRole; membershipStatus: MembershipStatus }
): Promise<void> {
  const { error } = await client
    .from("gym_memberships")
    .update({ role: input.role, membership_status: input.membershipStatus })
    .eq("id", input.membershipId);

  if (error) throw new Error(error.message || "Unable to update membership.");
}

export async function addMembership(
  client: SupabaseClient,
  input: { gymId: string; userId: string; role: GymRole; membershipStatus: MembershipStatus }
): Promise<void> {
  const { error } = await client
    .from("gym_memberships")
    .upsert(
      {
        gym_id: input.gymId,
        user_id: input.userId.trim(),
        role: input.role,
        membership_status: input.membershipStatus,
        started_at: new Date().toISOString()
      },
      { onConflict: "gym_id,user_id" }
    );

  if (error) throw new Error(error.message || "Unable to add membership.");
}

export async function listInvites(client: SupabaseClient, gymId: string): Promise<InviteRecord[]> {
  const { data, error } = await client
    .from("gym_staff_invites")
    .select("id,gym_id,email,role,status,created_at,expires_at,invited_by")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message || "Unable to load invites.");

  const invites =
    (data as Array<{
      id: string;
      gym_id: string;
      email: string;
      role: GymRole;
      status: InviteStatus;
      created_at: string;
      expires_at: string;
      invited_by: string;
    }> | null) ?? [];

  return invites.map((row) => ({
    id: row.id,
    gymId: row.gym_id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    invitedBy: row.invited_by
  }));
}

export async function sendInvite(
  client: SupabaseClient,
  input: { gymId: string; email: string; role: GymRole; expiresInDays?: number }
): Promise<string | undefined> {
  const { data, error } = await client.functions.invoke("send-invite", {
    body: {
      action: "send",
      gymId: input.gymId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      expiresInDays: input.expiresInDays ?? 7
    }
  });

  if (error) throw new Error(error.message || "Unable to send invite.");
  if (!data?.ok) throw new Error(data?.error ?? "Unable to send invite.");

  return typeof data.inviteUrl === "string" ? data.inviteUrl : undefined;
}

export async function resendInvite(client: SupabaseClient, input: { gymId: string; inviteId: string }): Promise<string | undefined> {
  const { data, error } = await client.functions.invoke("send-invite", {
    body: {
      action: "resend",
      gymId: input.gymId,
      inviteId: input.inviteId
    }
  });

  if (error) throw new Error(error.message || "Unable to resend invite.");
  if (!data?.ok) throw new Error(data?.error ?? "Unable to resend invite.");

  return typeof data.inviteUrl === "string" ? data.inviteUrl : undefined;
}

export async function revokeInvite(client: SupabaseClient, input: { gymId: string; inviteId: string }): Promise<void> {
  const { data, error } = await client.functions.invoke("send-invite", {
    body: {
      action: "revoke",
      gymId: input.gymId,
      inviteId: input.inviteId
    }
  });

  if (error) throw new Error(error.message || "Unable to revoke invite.");
  if (!data?.ok) throw new Error(data?.error ?? "Unable to revoke invite.");
}
