import type { ClassStatus, GymRole, MembershipStatus, SubscriptionStatus } from "@kruxt/types";
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

export interface CoachOption {
  userId: string;
  label: string;
  role: GymRole;
}

export interface GymClassRecord {
  id: string;
  gymId: string;
  title: string;
  location: string | null;
  notes: string | null;
  coachUserId: string | null;
  coachLabel: string;
  capacity: number;
  status: ClassStatus;
  startsAt: string;
  endsAt: string;
  bookingOpensAt: string | null;
  bookingClosesAt: string | null;
  createdAt: string;
}

export interface CreateGymClassInput {
  gymId: string;
  title: string;
  location?: string;
  notes?: string;
  coachUserId?: string;
  capacity: number;
  startsAt: string;
  endsAt: string;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
}

export interface GymLocationCatalogRecord {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
}

export interface ClassTemplateCatalogRecord {
  id: string;
  name: string;
  description: string | null;
  locationIds: string[];
  eligibleCoachUserIds: string[];
  defaultCapacity: number;
  defaultDurationMinutes: number;
  active: boolean;
}

export interface GymClassCatalog {
  locations: GymLocationCatalogRecord[];
  templates: ClassTemplateCatalogRecord[];
}

const CLASS_META_PREFIX = "__KRUXT_META__";
const CLASS_CATALOG_FEATURE_KEY = "class_scheduling_catalog";

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

function createCatalogId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCatalogString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCatalogId(value: unknown, prefix: string): string {
  const normalized = normalizeCatalogString(value);
  return normalized ?? createCatalogId(prefix);
}

function normalizeCatalogStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeCatalogString(entry))
        .filter((entry): entry is string => Boolean(entry))
    )
  );
}

function normalizeGymClassCatalog(config: unknown): GymClassCatalog {
  const source =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as {
          locations?: unknown;
          templates?: unknown;
        })
      : {};

  const locations = (Array.isArray(source.locations) ? source.locations : [])
    .map((item) => {
      const value =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as { id?: unknown; name?: unknown; address?: unknown; active?: unknown })
          : null;
      if (!value) return null;
      const name = normalizeCatalogString(value.name);
      if (!name) return null;
      return {
        id: normalizeCatalogId(value.id, "location"),
        name,
        address: normalizeCatalogString(value.address),
        active: value.active !== false
      } satisfies GymLocationCatalogRecord;
    })
    .filter((item): item is GymLocationCatalogRecord => Boolean(item));

  const validLocationIds = new Set(locations.map((location) => location.id));

  const templates = (Array.isArray(source.templates) ? source.templates : [])
    .map((item) => {
      const value =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as {
              id?: unknown;
              name?: unknown;
              description?: unknown;
              locationIds?: unknown;
              eligibleCoachUserIds?: unknown;
              defaultCapacity?: unknown;
              defaultDurationMinutes?: unknown;
              active?: unknown;
            })
          : null;
      if (!value) return null;
      const name = normalizeCatalogString(value.name);
      if (!name) return null;
      return {
        id: normalizeCatalogId(value.id, "template"),
        name,
        description: normalizeCatalogString(value.description),
        locationIds: normalizeCatalogStringArray(value.locationIds).filter((id) => validLocationIds.has(id)),
        eligibleCoachUserIds: normalizeCatalogStringArray(value.eligibleCoachUserIds),
        defaultCapacity: Math.max(
          1,
          Math.min(200, Number.isFinite(Number(value.defaultCapacity)) ? Math.floor(Number(value.defaultCapacity)) : 20)
        ),
        defaultDurationMinutes: Math.max(
          15,
          Math.min(
            300,
            Number.isFinite(Number(value.defaultDurationMinutes))
              ? Math.floor(Number(value.defaultDurationMinutes))
              : 60
          )
        ),
        active: value.active !== false
      } satisfies ClassTemplateCatalogRecord;
    })
    .filter((item): item is ClassTemplateCatalogRecord => Boolean(item));

  return {
    locations,
    templates
  };
}

function serializeClassDescription(input: { location?: string; notes?: string }): string | null {
  const location = input.location?.trim() || "";
  const notes = input.notes?.trim() || "";
  if (!location && !notes) return null;
  return `${CLASS_META_PREFIX}${JSON.stringify({ location: location || null, notes: notes || null })}`;
}

function parseClassDescription(description: string | null): { location: string | null; notes: string | null } {
  if (!description) return { location: null, notes: null };
  if (!description.startsWith(CLASS_META_PREFIX)) {
    return { location: null, notes: description };
  }
  try {
    const payload = JSON.parse(description.slice(CLASS_META_PREFIX.length)) as {
      location?: string | null;
      notes?: string | null;
    };
    return {
      location: payload.location ?? null,
      notes: payload.notes ?? null
    };
  } catch {
    return { location: null, notes: description };
  }
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

export async function listGymCoaches(client: SupabaseClient, gymId: string): Promise<CoachOption[]> {
  const { data, error } = await client
    .from("gym_memberships")
    .select("user_id,role,membership_status")
    .eq("gym_id", gymId)
    .in("role", ["leader", "officer", "coach"])
    .in("membership_status", ["trial", "active"]);

  if (error) {
    throw new Error(error.message || "Unable to load coaches.");
  }

  const rows =
    (data as Array<{ user_id: string; role: GymRole; membership_status: MembershipStatus }> | null) ?? [];
  if (rows.length === 0) return [];

  const uniqueIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: profilesData } = await client
    .from("profiles")
    .select("id,display_name,username")
    .in("id", uniqueIds);

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profilesData as ProfileRow[] | null) ?? []) {
    profileMap.set(profile.id, profile);
  }

  return rows
    .map((row) => ({
      userId: row.user_id,
      role: row.role,
      label: profileLabel(profileMap.get(row.user_id))
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function listGymClassCatalog(
  client: SupabaseClient,
  gymId: string
): Promise<GymClassCatalog> {
  const { data, error } = await client
    .from("gym_feature_settings")
    .select("config")
    .eq("gym_id", gymId)
    .eq("feature_key", CLASS_CATALOG_FEATURE_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load class catalog.");
  }

  return normalizeGymClassCatalog((data as { config?: unknown } | null)?.config);
}

export async function saveGymClassCatalog(
  client: SupabaseClient,
  gymId: string,
  catalog: GymClassCatalog
): Promise<GymClassCatalog> {
  const normalized = normalizeGymClassCatalog(catalog);
  const { error } = await client.from("gym_feature_settings").upsert(
    {
      gym_id: gymId,
      feature_key: CLASS_CATALOG_FEATURE_KEY,
      enabled: true,
      config: normalized,
      note: "Class scheduling catalog"
    },
    { onConflict: "gym_id,feature_key" }
  );

  if (error) {
    throw new Error(error.message || "Unable to save class catalog.");
  }

  return normalized;
}

export async function listGymClasses(client: SupabaseClient, gymId: string): Promise<GymClassRecord[]> {
  const { data, error } = await client
    .from("gym_classes")
    .select(
      "id,gym_id,coach_user_id,title,description,capacity,status,starts_at,ends_at,booking_opens_at,booking_closes_at,created_at"
    )
    .eq("gym_id", gymId)
    .order("starts_at", { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error(error.message || "Unable to load classes.");
  }

  const rows =
    (data as Array<{
      id: string;
      gym_id: string;
      coach_user_id: string | null;
      title: string;
      description: string | null;
      capacity: number;
      status: ClassStatus;
      starts_at: string;
      ends_at: string;
      booking_opens_at: string | null;
      booking_closes_at: string | null;
      created_at: string;
    }> | null) ?? [];

  const coachIds = Array.from(
    new Set(
      rows
        .map((row) => row.coach_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );
  const profileMap = new Map<string, ProfileRow>();
  if (coachIds.length > 0) {
    const { data: profilesData } = await client
      .from("profiles")
      .select("id,display_name,username")
      .in("id", coachIds);
    for (const profile of (profilesData as ProfileRow[] | null) ?? []) {
      profileMap.set(profile.id, profile);
    }
  }

  return rows.map((row) => {
    const parsed = parseClassDescription(row.description);
    return {
      id: row.id,
      gymId: row.gym_id,
      title: row.title,
      location: parsed.location,
      notes: parsed.notes,
      coachUserId: row.coach_user_id,
      coachLabel: row.coach_user_id ? profileLabel(profileMap.get(row.coach_user_id)) : "Unassigned",
      capacity: row.capacity,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      bookingOpensAt: row.booking_opens_at,
      bookingClosesAt: row.booking_closes_at,
      createdAt: row.created_at
    };
  });
}

export async function createGymClasses(
  client: SupabaseClient,
  input: CreateGymClassInput[]
): Promise<void> {
  if (input.length === 0) return;
  const payload = input.map((item) => ({
    gym_id: item.gymId,
    coach_user_id: item.coachUserId?.trim() || null,
    title: item.title.trim(),
    description: serializeClassDescription({ location: item.location, notes: item.notes }),
    capacity: Math.max(1, Math.floor(item.capacity)),
    status: "scheduled" as const,
    starts_at: item.startsAt,
    ends_at: item.endsAt,
    booking_opens_at: item.bookingOpensAt || null,
    booking_closes_at: item.bookingClosesAt || null
  }));

  const { error } = await client.from("gym_classes").insert(payload);
  if (error) {
    throw new Error(error.message || "Unable to create classes.");
  }
}

export async function updateGymClass(
  client: SupabaseClient,
  classId: string,
  input: {
    title?: string;
    location?: string;
    notes?: string;
    coachUserId?: string;
    capacity?: number;
    startsAt?: string;
    endsAt?: string;
    bookingOpensAt?: string;
    bookingClosesAt?: string;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};

  if (input.title !== undefined) updatePayload.title = input.title.trim();
  if (input.coachUserId !== undefined) updatePayload.coach_user_id = input.coachUserId.trim() || null;
  if (input.capacity !== undefined) updatePayload.capacity = Math.max(1, Math.floor(input.capacity));
  if (input.startsAt !== undefined) updatePayload.starts_at = input.startsAt;
  if (input.endsAt !== undefined) updatePayload.ends_at = input.endsAt;
  if (input.bookingOpensAt !== undefined) updatePayload.booking_opens_at = input.bookingOpensAt || null;
  if (input.bookingClosesAt !== undefined) updatePayload.booking_closes_at = input.bookingClosesAt || null;

  if (input.location !== undefined || input.notes !== undefined) {
    updatePayload.description = serializeClassDescription({
      location: input.location,
      notes: input.notes
    });
  }

  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await client.from("gym_classes").update(updatePayload).eq("id", classId);
  if (error) {
    throw new Error(error.message || "Unable to update class.");
  }
}

export async function setGymClassStatus(
  client: SupabaseClient,
  classId: string,
  status: ClassStatus
): Promise<void> {
  const { error } = await client.from("gym_classes").update({ status }).eq("id", classId);
  if (error) {
    throw new Error(error.message || "Unable to update class status.");
  }
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
