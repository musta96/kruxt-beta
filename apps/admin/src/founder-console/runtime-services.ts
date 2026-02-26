import type { SubscriptionStatus } from "@kruxt/types";

import { createAdminSupabaseClient } from "../services";

export interface FounderGymRecord {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  timezone: string;
  isPublic: boolean;
  ownerUserId: string;
  ownerLabel: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionProvider: string;
  createdAt: string;
}

export interface FounderOwnerOption {
  userId: string;
  label: string;
}

export interface CreateFounderGymInput {
  slug: string;
  name: string;
  city?: string;
  countryCode?: string;
  timezone?: string;
  isPublic?: boolean;
  ownerUserId?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionProvider?: string;
  billingContactEmail?: string;
}

export interface FounderMutationResult {
  ok: boolean;
  gym?: FounderGymRecord;
  error?: { message: string };
}

export interface FounderConsoleServices {
  listGyms(): Promise<FounderGymRecord[]>;
  listOwnerOptions(search?: string): Promise<FounderOwnerOption[]>;
  createGym(input: CreateFounderGymInput): Promise<FounderMutationResult>;
  assignGymOwner(gymId: string, ownerUserId: string): Promise<FounderMutationResult>;
  upsertGymSubscription(
    gymId: string,
    input: {
      status: SubscriptionStatus;
      provider?: string;
      billingContactEmail?: string;
    }
  ): Promise<FounderMutationResult>;
}

type GymRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  timezone: string;
  is_public: boolean;
  owner_user_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

type SubscriptionRow = {
  gym_id: string;
  status: SubscriptionStatus;
  provider: string;
  updated_at: string;
};

function ownerLabelFromProfile(profile?: ProfileRow): string {
  if (!profile) return "Unknown owner";
  if (profile.display_name) return profile.display_name;
  if (profile.username) return `@${profile.username}`;
  return `${profile.id.slice(0, 8)}...`;
}

function mutationError(message: string): FounderMutationResult {
  return { ok: false, error: { message } };
}

function buildPreviewOwnerOptions(gyms: FounderGymRecord[]): FounderOwnerOption[] {
  const byUser = new Map<string, FounderOwnerOption>();
  for (const gym of gyms) {
    if (!byUser.has(gym.ownerUserId)) {
      byUser.set(gym.ownerUserId, {
        userId: gym.ownerUserId,
        label: gym.ownerLabel
      });
    }
  }
  return Array.from(byUser.values()).sort((a, b) => a.label.localeCompare(b.label));
}

async function mapLiveGyms(
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<FounderGymRecord[]> {
  const { data: gymsData, error: gymsError } = await supabase
    .from("gyms")
    .select("id,slug,name,city,country_code,timezone,is_public,owner_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (gymsError) {
    throw new Error(gymsError.message || "Unable to load gyms.");
  }

  const gyms = (gymsData ?? []) as GymRow[];
  if (gyms.length === 0) return [];

  const ownerIds = Array.from(new Set(gyms.map((gym) => gym.owner_user_id)));
  const gymIds = gyms.map((gym) => gym.id);

  const profileMap = new Map<string, ProfileRow>();
  if (ownerIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .in("id", ownerIds);

    if (!profilesError) {
      for (const profile of (profilesData ?? []) as ProfileRow[]) {
        profileMap.set(profile.id, profile);
      }
    }
  }

  const subscriptionMap = new Map<string, SubscriptionRow>();
  if (gymIds.length > 0) {
    const { data: subscriptionsData, error: subscriptionsError } = await supabase
      .from("gym_platform_subscriptions")
      .select("gym_id,status,provider,updated_at")
      .in("gym_id", gymIds)
      .order("updated_at", { ascending: false });

    if (!subscriptionsError) {
      for (const row of (subscriptionsData ?? []) as SubscriptionRow[]) {
        if (!subscriptionMap.has(row.gym_id)) {
          subscriptionMap.set(row.gym_id, row);
        }
      }
    }
  }

  return gyms.map((gym) => {
    const ownerProfile = profileMap.get(gym.owner_user_id);
    const subscription = subscriptionMap.get(gym.id);

    return {
      id: gym.id,
      slug: gym.slug,
      name: gym.name,
      city: gym.city,
      countryCode: gym.country_code,
      timezone: gym.timezone,
      isPublic: gym.is_public,
      ownerUserId: gym.owner_user_id,
      ownerLabel: ownerLabelFromProfile(ownerProfile),
      subscriptionStatus: subscription?.status ?? "incomplete",
      subscriptionProvider: subscription?.provider ?? "manual",
      createdAt: gym.created_at
    } satisfies FounderGymRecord;
  });
}

export function createFounderConsoleRuntimeServices(): FounderConsoleServices {
  let supabase: ReturnType<typeof createAdminSupabaseClient> | null = null;
  let unavailable = false;

  const defaultGymId =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DEFAULT_GYM_ID ||
    "3306f501-3f50-4a30-8552-b47bf9cce199";

  let previewGyms: FounderGymRecord[] = [
    {
      id: defaultGymId,
      slug: "bzone-pavia",
      name: "BZone Pavia",
      city: "Pavia",
      countryCode: "IT",
      timezone: "Europe/Rome",
      isPublic: true,
      ownerUserId: "preview-owner",
      ownerLabel: "Founder",
      subscriptionStatus: "trialing",
      subscriptionProvider: "manual",
      createdAt: new Date().toISOString()
    }
  ];

  const getSupabase = () => {
    if (supabase) return supabase;
    if (unavailable) return null;

    try {
      supabase = createAdminSupabaseClient();
      return supabase;
    } catch (error) {
      unavailable = true;
      console.warn("[founder-console-runtime] Falling back to preview services:", error);
      return null;
    }
  };

  const loadLiveGyms = async () => {
    const client = getSupabase();
    if (!client) return null;
    try {
      return await mapLiveGyms(client);
    } catch (error) {
      console.warn("[founder-console-runtime] listGyms failed:", error);
      return null;
    }
  };

  const resolveOwnerId = async (
    client: ReturnType<typeof createAdminSupabaseClient>,
    ownerUserId?: string
  ): Promise<string> => {
    const explicit = ownerUserId?.trim();
    if (explicit) return explicit;

    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.id) {
      throw new Error("Owner UUID is required. Provide owner user id in the form.");
    }

    return data.user.id;
  };

  return {
    listGyms: async () => {
      const live = await loadLiveGyms();
      if (live) return live;
      return [...previewGyms].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    listOwnerOptions: async (search = "") => {
      const client = getSupabase();
      if (!client) {
        const needle = search.trim().toLowerCase();
        return buildPreviewOwnerOptions(previewGyms).filter((option) =>
          needle.length === 0 ? true : option.label.toLowerCase().includes(needle)
        );
      }

      try {
        const needle = search.trim();
        let query = client
          .from("profiles")
          .select("id,display_name,username")
          .order("updated_at", { ascending: false })
          .limit(50);

        if (needle.length > 0) {
          query = query.or(`display_name.ilike.%${needle}%,username.ilike.%${needle}%`);
        }

        const { data, error } = await query;
        if (error) {
          throw new Error(error.message || "Unable to load owner options.");
        }

        return ((data ?? []) as ProfileRow[]).map((profile) => ({
          userId: profile.id,
          label: ownerLabelFromProfile(profile)
        }));
      } catch (error) {
        console.warn("[founder-console-runtime] listOwnerOptions failed:", error);
        return buildPreviewOwnerOptions(previewGyms);
      }
    },

    createGym: async (input) => {
      const client = getSupabase();
      if (!client) {
        const slug = input.slug.trim();
        if (!slug) return mutationError("Gym slug is required.");
        if (!input.name.trim()) return mutationError("Gym name is required.");
        if (previewGyms.some((gym) => gym.slug.toLowerCase() === slug.toLowerCase())) {
          return mutationError("Slug already exists in preview data.");
        }

        const ownerUserId = input.ownerUserId?.trim() || "preview-owner";
        const gym: FounderGymRecord = {
          id: `preview-gym-${Math.random().toString(36).slice(2, 10)}`,
          slug,
          name: input.name.trim(),
          city: input.city?.trim() || null,
          countryCode: input.countryCode?.trim() || null,
          timezone: input.timezone?.trim() || "Europe/Rome",
          isPublic: input.isPublic ?? true,
          ownerUserId,
          ownerLabel: ownerUserId === "preview-owner" ? "Founder" : `${ownerUserId.slice(0, 8)}...`,
          subscriptionStatus: input.subscriptionStatus ?? "trialing",
          subscriptionProvider: input.subscriptionProvider ?? "manual",
          createdAt: new Date().toISOString()
        };

        previewGyms = [gym, ...previewGyms];
        return { ok: true, gym };
      }

      try {
        const ownerUserId = await resolveOwnerId(client, input.ownerUserId);

        const { data: gymData, error: gymError } = await client
          .from("gyms")
          .insert({
            slug: input.slug.trim(),
            name: input.name.trim(),
            city: input.city?.trim() || null,
            country_code: input.countryCode?.trim() || null,
            timezone: input.timezone?.trim() || "Europe/Rome",
            is_public: input.isPublic ?? true,
            owner_user_id: ownerUserId
          })
          .select("id,slug,name,city,country_code,timezone,is_public,owner_user_id,created_at")
          .single();

        if (gymError || !gymData) {
          return mutationError(gymError?.message || "Unable to create gym.");
        }

        const gym = gymData as GymRow;

        const { error: membershipError } = await client
          .from("gym_memberships")
          .upsert(
            {
              gym_id: gym.id,
              user_id: ownerUserId,
              role: "leader",
              membership_status: "active",
              started_at: new Date().toISOString()
            },
            { onConflict: "gym_id,user_id" }
          );

        if (membershipError) {
          return mutationError(
            "Gym created, but leader membership failed. Ensure owner has a profile row first."
          );
        }

        const subscriptionProvider = (input.subscriptionProvider || "manual").trim() || "manual";
        const subscriptionStatus = input.subscriptionStatus ?? "trialing";

        const { error: subscriptionError } = await client
          .from("gym_platform_subscriptions")
          .upsert(
            {
              gym_id: gym.id,
              provider: subscriptionProvider,
              status: subscriptionStatus,
              billing_contact_email: input.billingContactEmail?.trim() || null
            },
            { onConflict: "gym_id,provider" }
          );

        if (subscriptionError) {
          return mutationError("Gym created, but platform subscription setup failed.");
        }

        const gyms = await mapLiveGyms(client);
        const createdGym = gyms.find((item) => item.id === gym.id);
        return createdGym ? { ok: true, gym: createdGym } : { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create gym.";
        return mutationError(message);
      }
    },

    assignGymOwner: async (gymId, ownerUserId) => {
      const owner = ownerUserId.trim();
      if (!owner) return mutationError("Owner UUID is required.");

      const client = getSupabase();
      if (!client) {
        const index = previewGyms.findIndex((item) => item.id === gymId);
        if (index === -1) return mutationError("Gym not found in preview state.");

        const updated = {
          ...previewGyms[index],
          ownerUserId: owner,
          ownerLabel: `${owner.slice(0, 8)}...`
        };
        previewGyms = previewGyms.map((item) => (item.id === gymId ? updated : item));
        return { ok: true, gym: updated };
      }

      try {
        const { data: profileData, error: profileError } = await client
          .from("profiles")
          .select("id")
          .eq("id", owner)
          .maybeSingle();

        if (profileError) {
          return mutationError(profileError.message || "Unable to validate owner profile.");
        }

        if (!profileData) {
          return mutationError("Owner must sign up and have a profile before assignment.");
        }

        const { error: gymError } = await client
          .from("gyms")
          .update({ owner_user_id: owner })
          .eq("id", gymId);

        if (gymError) {
          return mutationError(gymError.message || "Unable to update gym owner.");
        }

        const { error: membershipError } = await client
          .from("gym_memberships")
          .upsert(
            {
              gym_id: gymId,
              user_id: owner,
              role: "leader",
              membership_status: "active",
              started_at: new Date().toISOString()
            },
            { onConflict: "gym_id,user_id" }
          );

        if (membershipError) {
          return mutationError(membershipError.message || "Owner updated, but leader membership failed.");
        }

        const gyms = await mapLiveGyms(client);
        const updatedGym = gyms.find((item) => item.id === gymId);
        return updatedGym ? { ok: true, gym: updatedGym } : { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to assign gym owner.";
        return mutationError(message);
      }
    },

    upsertGymSubscription: async (gymId, input) => {
      const provider = (input.provider || "manual").trim() || "manual";
      const client = getSupabase();
      if (!client) {
        const index = previewGyms.findIndex((item) => item.id === gymId);
        if (index === -1) return mutationError("Gym not found in preview state.");

        const updated = {
          ...previewGyms[index],
          subscriptionStatus: input.status,
          subscriptionProvider: provider
        };
        previewGyms = previewGyms.map((item) => (item.id === gymId ? updated : item));
        return { ok: true, gym: updated };
      }

      try {
        const { error } = await client
          .from("gym_platform_subscriptions")
          .upsert(
            {
              gym_id: gymId,
              provider,
              status: input.status,
              billing_contact_email: input.billingContactEmail?.trim() || null
            },
            { onConflict: "gym_id,provider" }
          );

        if (error) {
          return mutationError(error.message || "Unable to update platform subscription.");
        }

        const gyms = await mapLiveGyms(client);
        const updatedGym = gyms.find((item) => item.id === gymId);
        return updatedGym ? { ok: true, gym: updatedGym } : { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update platform subscription.";
        return mutationError(message);
      }
    }
  };
}
