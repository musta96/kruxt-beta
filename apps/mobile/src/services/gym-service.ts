import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateGymInput,
  Gym,
  GymMembership,
  JoinGymInput,
  MembershipStatus
} from "@kruxt/types";

import { throwIfError } from "./errors";
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
  role: GymMembership["role"];
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
  started_at: string | null;
  ends_at: string | null;
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

  async createGymWithLeaderMembership(userId: string, input: CreateGymInput): Promise<{ gym: Gym; membership: GymMembership }> {
    const slug = slugify(input.slug || input.name);

    const { data: gymData, error: gymError } = await this.supabase
      .from("gyms")
      .insert({
        slug,
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

    throwIfError(gymError, "GYM_CREATE_FAILED", "Unable to create gym.");

    const { data: membershipData, error: membershipError } = await this.supabase
      .from("gym_memberships")
      .upsert(
        {
          gym_id: gymData.id,
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
      gym: mapGym(gymData as GymRow),
      membership: mapMembership(membershipData as GymMembershipRow)
    };
  }

  async joinGym(userId: string, input: JoinGymInput): Promise<GymMembership> {
    const { data, error } = await this.supabase
      .from("gym_memberships")
      .upsert(
        {
          gym_id: input.gymId,
          user_id: userId,
          role: "member",
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
}
