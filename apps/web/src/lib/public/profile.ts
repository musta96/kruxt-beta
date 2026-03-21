import type { MembershipStatus, GymRole } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROFILE_AVATAR_BUCKET = "profile-avatars";

export interface MemberProfileMembership {
  gymId: string;
  gymName: string;
  role: GymRole;
  membershipStatus: MembershipStatus;
  startedAt: string | null;
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

  const { data: membershipsData, error: membershipsError } = await client
    .from("gym_memberships")
    .select("gym_id,role,membership_status,started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (membershipsError) {
    throw new Error(membershipsError.message || "Unable to load gym memberships.");
  }

  const memberships =
    (membershipsData as Array<{
      gym_id: string;
      role: GymRole;
      membership_status: MembershipStatus;
      started_at: string | null;
    }> | null) ?? [];

  const gymIds = Array.from(new Set(memberships.map((item) => item.gym_id)));
  const gymNameMap = new Map<string, string>();

  if (gymIds.length > 0) {
    const { data: gymsData, error: gymsError } = await client
      .from("gyms")
      .select("id,name")
      .in("id", gymIds);

    if (gymsError) {
      throw new Error(gymsError.message || "Unable to load gyms.");
    }

    for (const gym of ((gymsData as Array<{ id: string; name: string }> | null) ?? [])) {
      gymNameMap.set(gym.id, gym.name);
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
    }))
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
