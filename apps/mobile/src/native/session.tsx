import type { PropsWithChildren } from "react";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createNativeSupabaseClient, getPublicWebAppUrl } from "./supabase";

type PlatformOperatorRole =
  | "founder"
  | "ops_admin"
  | "support_admin"
  | "compliance_admin"
  | "analyst"
  | "read_only";

type GymMembershipRole = "leader" | "officer" | "coach" | "member";
type GymMembershipStatus = "trial" | "active" | "paused" | "canceled";

export interface NativeMembership {
  gymId: string;
  gymName: string | null;
  role: GymMembershipRole;
  membershipStatus: GymMembershipStatus;
}

export interface NativeProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  bio: string | null;
  isPublic: boolean;
  memberships: NativeMembership[];
}

export interface NativeAccessState {
  isAuthenticated: boolean;
  user: User | null;
  platformRole: PlatformOperatorRole | null;
  staffGymIds: string[];
}

interface SessionState {
  status: "loading" | "ready";
  access: NativeAccessState;
  profile: NativeProfile | null;
}

interface SessionContextValue {
  supabase: SupabaseClient;
  webAppUrl: string;
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string; username: string }) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (input: { displayName: string; username: string; bio: string; isPublic: boolean }) => Promise<void>;
  uploadAvatar: (input: { uri: string; mimeType?: string | null; fileName?: string | null }) => Promise<void>;
  removeAvatar: () => Promise<void>;
  refresh: () => Promise<void>;
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean | null;
};

type GymMembershipRow = {
  gym_id: string;
  role: GymMembershipRole;
  membership_status: GymMembershipStatus;
  gyms: { name: string | null } | Array<{ name: string | null }> | null;
};

const EMPTY_ACCESS: NativeAccessState = {
  isAuthenticated: false,
  user: null,
  platformRole: null,
  staffGymIds: []
};

const SessionContext = createContext<SessionContextValue | null>(null);
const PROFILE_AVATAR_BUCKET = "profile-avatars";

function normalizeAvatarStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(https?:|data:)/i.test(value)) return null;
  return value.replace(/^profile-avatars\//, "");
}

async function resolveAvatarDisplayUrl(client: SupabaseClient, avatarValue: string | null | undefined): Promise<string | null> {
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

function extractGymName(value: GymMembershipRow["gyms"]): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value.name ?? null;
}

async function resolveNativeAccess(client: SupabaseClient): Promise<NativeAccessState> {
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError || !authData.user) {
    return EMPTY_ACCESS;
  }

  const user = authData.user;
  const [{ data: founderData }, { data: membershipsData }] = await Promise.all([
    client
      .from("platform_operator_accounts")
      .select("role,is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    client
      .from("gym_memberships")
      .select("gym_id")
      .eq("user_id", user.id)
      .in("membership_status", ["trial", "active"])
      .in("role", ["leader", "officer", "coach"])
  ]);

  return {
    isAuthenticated: true,
    user,
    platformRole: (founderData?.role as PlatformOperatorRole | null | undefined) ?? null,
    staffGymIds: (membershipsData ?? []).map((row) => row.gym_id)
  };
}

async function ensureProfileForUser(
  client: SupabaseClient,
  input: { userId: string; email: string; displayName?: string; username?: string }
): Promise<void> {
  const baseUsername =
    (input.username?.trim().toLowerCase() || input.email.split("@")[0] || "member").replace(/[^a-z0-9_]/g, "_");
  const baseDisplayName = input.displayName?.trim() || input.email.split("@")[0] || "KRUXT Member";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = `${baseUsername}${attempt === 0 ? "" : attempt + 1}`.slice(0, 24);
    const { error } = await client
      .from("profiles")
      .upsert(
        {
          id: input.userId,
          username,
          display_name: baseDisplayName
        },
        { onConflict: "id" }
      );

    if (!error) return;
    if (!String(error.message).toLowerCase().includes("username")) {
      throw new Error(error.message || "Unable to create profile.");
    }
  }

  throw new Error("Unable to allocate a unique username for this account.");
}

async function loadProfile(client: SupabaseClient, user: User): Promise<NativeProfile> {
  let { data: profileData, error: profileError } = await client
    .from("profiles")
    .select("id,username,display_name,avatar_url,bio,is_public")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Unable to read profile.");
  }

  if (!profileData) {
    await ensureProfileForUser(client, {
      userId: user.id,
      email: user.email ?? "",
      displayName: user.user_metadata?.display_name as string | undefined,
      username: user.user_metadata?.username as string | undefined
    });

    const retry = await client
      .from("profiles")
      .select("id,username,display_name,avatar_url,bio,is_public")
      .eq("id", user.id)
      .single();

    profileData = retry.data;
    profileError = retry.error;
    if (profileError || !profileData) {
      throw new Error(profileError?.message || "Unable to reload profile.");
    }
  }

  const { data: membershipData, error: membershipError } = await client
    .from("gym_memberships")
    .select("gym_id,role,membership_status,gyms(name)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  if (membershipError) {
    throw new Error(membershipError.message || "Unable to load memberships.");
  }

  return {
    id: profileData.id as string,
    username: (profileData.username as string) ?? "member",
    displayName: (profileData.display_name as string | null | undefined) ?? user.email ?? "KRUXT Member",
    avatarPath: (profileData.avatar_url as string | null | undefined) ?? null,
    avatarUrl: await resolveAvatarDisplayUrl(client, (profileData.avatar_url as string | null | undefined) ?? null),
    bio: (profileData.bio as string | null | undefined) ?? null,
    isPublic: (profileData.is_public as boolean | null | undefined) ?? true,
    memberships: ((membershipData as GymMembershipRow[] | null) ?? []).map((membership) => ({
      gymId: membership.gym_id,
      gymName: extractGymName(membership.gyms),
      role: membership.role,
      membershipStatus: membership.membership_status
    }))
  };
}

export function NativeSessionProvider({ children }: PropsWithChildren) {
  const supabase = useMemo(() => createNativeSupabaseClient(), []);
  const webAppUrl = useMemo(() => getPublicWebAppUrl(), []);
  const [state, setState] = useState<SessionState>({
    status: "loading",
    access: EMPTY_ACCESS,
    profile: null
  });

  async function refresh() {
    setState((current) => ({ ...current, status: "loading" }));
    const access = await resolveNativeAccess(supabase);

    if (!access.user) {
      setState({
        status: "ready",
        access,
        profile: null
      });
      return;
    }

    const profile = await loadProfile(supabase, access.user);
    setState({
      status: "ready",
      access,
      profile
    });
  }

  useEffect(() => {
    const authSubscription = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, _session: Session | null) => {
      void refresh();
    });

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void supabase.auth.startAutoRefresh();
        void refresh();
        return;
      }

      void supabase.auth.stopAutoRefresh();
    });

    void refresh();

    return () => {
      authSubscription.data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [supabase]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      throw new Error(error.message || "Unable to sign in.");
    }

    await refresh();
  }

  async function signUp(input: { email: string; password: string; displayName: string; username: string }) {
    const email = input.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password
    });

    if (error) {
      throw new Error(error.message || "Unable to create account.");
    }

    if (data.user) {
      await ensureProfileForUser(supabase, {
        userId: data.user.id,
        email,
        displayName: input.displayName,
        username: input.username
      });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: input.password
    });

    if (signInError) {
      if (signInError.message.includes("Email not confirmed")) {
        throw new Error("Account created. Confirm the email first, then sign in.");
      }

      throw new Error(signInError.message || "Unable to sign in after account creation.");
    }

    await refresh();
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message || "Unable to sign out.");
    }

    await refresh();
  }

  async function saveProfile(input: { displayName: string; username: string; bio: string; isPublic: boolean }) {
    const user = state.access.user;
    if (!user) {
      throw new Error("Authentication required.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: input.displayName.trim(),
        username: input.username.trim().toLowerCase(),
        bio: input.bio.trim() || null,
        is_public: input.isPublic
      })
      .eq("id", user.id);

    if (error) {
      throw new Error(error.message || "Unable to save profile.");
    }

    await refresh();
  }

  async function uploadAvatar(input: { uri: string; mimeType?: string | null; fileName?: string | null }) {
    const user = state.access.user;
    if (!user) {
      throw new Error("Authentication required.");
    }

    const response = await fetch(input.uri);
    const arrayBuffer = await response.arrayBuffer();
    const extensionFromName = input.fileName?.split(".").pop()?.toLowerCase();
    const extension =
      extensionFromName && /^[a-z0-9]+$/.test(extensionFromName)
        ? extensionFromName
        : input.mimeType === "image/png"
          ? "png"
          : input.mimeType === "image/webp"
            ? "webp"
            : "jpg";

    const objectPath = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(objectPath, arrayBuffer, {
      upsert: true,
      contentType: input.mimeType ?? "image/jpeg",
      cacheControl: "3600"
    });

    if (uploadError) {
      throw new Error(uploadError.message || "Unable to upload avatar.");
    }

    const previousObjectPath = normalizeAvatarStoragePath(state.profile?.avatarPath);
    if (previousObjectPath && previousObjectPath !== objectPath) {
      await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([previousObjectPath]);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: objectPath })
      .eq("id", user.id);

    if (profileError) {
      throw new Error(profileError.message || "Unable to save avatar.");
    }

    await refresh();
  }

  async function removeAvatar() {
    const user = state.access.user;
    if (!user) {
      throw new Error("Authentication required.");
    }

    const previousObjectPath = normalizeAvatarStoragePath(state.profile?.avatarPath);
    if (previousObjectPath) {
      await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([previousObjectPath]);
    }

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (error) {
      throw new Error(error.message || "Unable to remove avatar.");
    }

    await refresh();
  }

  const value: SessionContextValue = {
    supabase,
    webAppUrl,
    state,
    signIn,
    signUp,
    signOut,
    saveProfile,
    uploadAvatar,
    removeAvatar,
    refresh
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useNativeSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useNativeSession must be used inside NativeSessionProvider.");
  }

  return context;
}
