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
  motto: string | null;
  description: string | null;
  bannerUrl: string | null;
  sigilUrl: string | null;
  ownerUserId: string;
  ownerLabel: string;
  paymentProvider: string | null;
  providerAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionProvider: string;
  complianceProfile: FounderComplianceProfile | null;
  createdAt: string;
}

export interface FounderComplianceProfile {
  countryCode: string;
  legalEntityName: string;
  defaultCurrency: string;
  locale: string;
  invoiceScheme: string;
  vatNumber?: string;
  taxCode?: string;
  taxRegime?: string;
  registrationNumber?: string;
  pecEmail?: string;
  sdiDestinationCode?: string;
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

export interface UpdateFounderGymInput {
  slug?: string;
  name?: string;
  city?: string;
  countryCode?: string;
  timezone?: string;
  isPublic?: boolean;
  motto?: string;
  description?: string;
  bannerUrl?: string;
  sigilUrl?: string;
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
  updateGym(gymId: string, input: UpdateFounderGymInput): Promise<FounderMutationResult>;
  assignGymOwner(gymId: string, ownerUserId: string): Promise<FounderMutationResult>;
  upsertGymSubscription(
    gymId: string,
    input: {
      status: SubscriptionStatus;
      provider?: string;
      billingContactEmail?: string;
    }
  ): Promise<FounderMutationResult>;
  upsertComplianceProfile(gymId: string, input: FounderComplianceProfile): Promise<FounderMutationResult>;
}

type GymRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  timezone: string;
  is_public: boolean;
  motto: string | null;
  description: string | null;
  banner_url: string | null;
  sigil_url: string | null;
  owner_user_id: string;
  payment_provider: string | null;
  provider_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
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

type ComplianceRow = {
  gym_id: string;
  country_code: string;
  legal_entity_name: string;
  default_currency: string;
  locale: string;
  invoice_scheme: string;
  vat_number: string | null;
  tax_code: string | null;
  tax_regime: string | null;
  registration_number: string | null;
  pec_email: string | null;
  sdi_destination_code: string | null;
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
    .select(
      "id,slug,name,city,country_code,timezone,is_public,motto,description,banner_url,sigil_url,owner_user_id,payment_provider,provider_account_id,charges_enabled,payouts_enabled,created_at"
    )
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

  const complianceMap = new Map<string, ComplianceRow>();
  if (gymIds.length > 0) {
    const { data: complianceData, error: complianceError } = await supabase
      .from("invoice_compliance_profiles")
      .select(
        "gym_id,country_code,legal_entity_name,default_currency,locale,invoice_scheme,vat_number,tax_code,tax_regime,registration_number,pec_email,sdi_destination_code"
      )
      .in("gym_id", gymIds);

    if (!complianceError) {
      for (const row of (complianceData ?? []) as ComplianceRow[]) {
        complianceMap.set(row.gym_id, row);
      }
    }
  }

  return gyms.map((gym) => {
    const ownerProfile = profileMap.get(gym.owner_user_id);
    const subscription = subscriptionMap.get(gym.id);
    const compliance = complianceMap.get(gym.id);

    return {
      id: gym.id,
      slug: gym.slug,
      name: gym.name,
      city: gym.city,
      countryCode: gym.country_code,
      timezone: gym.timezone,
      isPublic: gym.is_public,
      motto: gym.motto,
      description: gym.description,
      bannerUrl: gym.banner_url,
      sigilUrl: gym.sigil_url,
      ownerUserId: gym.owner_user_id,
      ownerLabel: ownerLabelFromProfile(ownerProfile),
      paymentProvider: gym.payment_provider,
      providerAccountId: gym.provider_account_id,
      chargesEnabled: gym.charges_enabled,
      payoutsEnabled: gym.payouts_enabled,
      subscriptionStatus: subscription?.status ?? "incomplete",
      subscriptionProvider: subscription?.provider ?? "manual",
      complianceProfile: compliance
        ? {
            countryCode: compliance.country_code,
            legalEntityName: compliance.legal_entity_name,
            defaultCurrency: compliance.default_currency,
            locale: compliance.locale,
            invoiceScheme: compliance.invoice_scheme,
            vatNumber: compliance.vat_number ?? undefined,
            taxCode: compliance.tax_code ?? undefined,
            taxRegime: compliance.tax_regime ?? undefined,
            registrationNumber: compliance.registration_number ?? undefined,
            pecEmail: compliance.pec_email ?? undefined,
            sdiDestinationCode: compliance.sdi_destination_code ?? undefined
          }
        : null,
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
      motto: "No log, no legend.",
      description: "Preview gym profile for founder console.",
      bannerUrl: null,
      sigilUrl: null,
      ownerUserId: "preview-owner",
      ownerLabel: "Founder",
      paymentProvider: "manual",
      providerAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      subscriptionStatus: "trialing",
      subscriptionProvider: "manual",
      complianceProfile: null,
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
          motto: null,
          description: null,
          bannerUrl: null,
          sigilUrl: null,
          ownerUserId,
          ownerLabel: ownerUserId === "preview-owner" ? "Founder" : `${ownerUserId.slice(0, 8)}...`,
          paymentProvider: "manual",
          providerAccountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          subscriptionStatus: input.subscriptionStatus ?? "trialing",
          subscriptionProvider: input.subscriptionProvider ?? "manual",
          complianceProfile: null,
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
          .select(
            "id,slug,name,city,country_code,timezone,is_public,motto,description,banner_url,sigil_url,owner_user_id,payment_provider,provider_account_id,charges_enabled,payouts_enabled,created_at"
          )
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

    updateGym: async (gymId, input) => {
      const client = getSupabase();
      const normalize = (value?: string) => {
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      if (!client) {
        const index = previewGyms.findIndex((item) => item.id === gymId);
        if (index === -1) return mutationError("Gym not found in preview state.");

        const current = previewGyms[index];
        const updated: FounderGymRecord = {
          ...current,
          ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.city !== undefined ? { city: normalize(input.city) } : {}),
          ...(input.countryCode !== undefined ? { countryCode: normalize(input.countryCode)?.toUpperCase() ?? null } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone.trim() || "Europe/Rome" } : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          ...(input.motto !== undefined ? { motto: normalize(input.motto) } : {}),
          ...(input.description !== undefined ? { description: normalize(input.description) } : {}),
          ...(input.bannerUrl !== undefined ? { bannerUrl: normalize(input.bannerUrl) } : {}),
          ...(input.sigilUrl !== undefined ? { sigilUrl: normalize(input.sigilUrl) } : {})
        };

        previewGyms = previewGyms.map((item) => (item.id === gymId ? updated : item));
        return { ok: true, gym: updated };
      }

      try {
        const payload: Record<string, unknown> = {};
        if (input.slug !== undefined) payload.slug = input.slug.trim();
        if (input.name !== undefined) payload.name = input.name.trim();
        if (input.city !== undefined) payload.city = normalize(input.city);
        if (input.countryCode !== undefined) payload.country_code = normalize(input.countryCode)?.toUpperCase() ?? null;
        if (input.timezone !== undefined) payload.timezone = input.timezone.trim() || "Europe/Rome";
        if (input.isPublic !== undefined) payload.is_public = input.isPublic;
        if (input.motto !== undefined) payload.motto = normalize(input.motto);
        if (input.description !== undefined) payload.description = normalize(input.description);
        if (input.bannerUrl !== undefined) payload.banner_url = normalize(input.bannerUrl);
        if (input.sigilUrl !== undefined) payload.sigil_url = normalize(input.sigilUrl);

        if (Object.keys(payload).length === 0) {
          return mutationError("No gym profile changes provided.");
        }

        const { error } = await client.from("gyms").update(payload).eq("id", gymId);
        if (error) {
          return mutationError(error.message || "Unable to update gym profile.");
        }

        const gyms = await mapLiveGyms(client);
        const updatedGym = gyms.find((item) => item.id === gymId);
        return updatedGym ? { ok: true, gym: updatedGym } : { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update gym profile.";
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
    },

    upsertComplianceProfile: async (gymId, input) => {
      const normalizeOptional = (value?: string) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : null;
      };
      const normalizeRequired = (value: string, fallback: string) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
      };

      const client = getSupabase();
      if (!client) {
        const index = previewGyms.findIndex((item) => item.id === gymId);
        if (index === -1) return mutationError("Gym not found in preview state.");

        const updated: FounderGymRecord = {
          ...previewGyms[index],
          complianceProfile: {
            countryCode: normalizeRequired(input.countryCode, "IT").toUpperCase(),
            legalEntityName: normalizeRequired(input.legalEntityName, previewGyms[index].name),
            defaultCurrency: normalizeRequired(input.defaultCurrency, "EUR").toUpperCase(),
            locale: normalizeRequired(input.locale, "it-IT"),
            invoiceScheme: normalizeRequired(input.invoiceScheme, "standard"),
            vatNumber: input.vatNumber?.trim() || undefined,
            taxCode: input.taxCode?.trim() || undefined,
            taxRegime: input.taxRegime?.trim() || undefined,
            registrationNumber: input.registrationNumber?.trim() || undefined,
            pecEmail: input.pecEmail?.trim() || undefined,
            sdiDestinationCode: input.sdiDestinationCode?.trim() || undefined
          }
        };
        previewGyms = previewGyms.map((item) => (item.id === gymId ? updated : item));
        return { ok: true, gym: updated };
      }

      try {
        const payload = {
          gym_id: gymId,
          country_code: normalizeRequired(input.countryCode, "IT").toUpperCase(),
          legal_entity_name: normalizeRequired(input.legalEntityName, "Unknown Legal Entity"),
          default_currency: normalizeRequired(input.defaultCurrency, "EUR").toUpperCase(),
          locale: normalizeRequired(input.locale, "it-IT"),
          invoice_scheme: normalizeRequired(input.invoiceScheme, "standard"),
          vat_number: normalizeOptional(input.vatNumber),
          tax_code: normalizeOptional(input.taxCode),
          tax_regime: normalizeOptional(input.taxRegime),
          registration_number: normalizeOptional(input.registrationNumber),
          pec_email: normalizeOptional(input.pecEmail),
          sdi_destination_code: normalizeOptional(input.sdiDestinationCode)
        };

        const { error } = await client
          .from("invoice_compliance_profiles")
          .upsert(payload, { onConflict: "gym_id" });

        if (error) {
          return mutationError(error.message || "Unable to save compliance profile.");
        }

        const gyms = await mapLiveGyms(client);
        const updatedGym = gyms.find((item) => item.id === gymId);
        return updatedGym ? { ok: true, gym: updatedGym } : { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save compliance profile.";
        return mutationError(message);
      }
    }
  };
}
