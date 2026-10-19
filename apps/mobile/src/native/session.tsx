import type { PropsWithChildren } from "react";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { createNativeSupabaseClient, getPublicWebAppUrl } from "./supabase";

type PlatformOperatorRole =
  | "founder"
  | "ops_admin"
  | "support_admin"
  | "compliance_admin"
  | "analyst"
  | "read_only";

type GymMembershipRole = "leader" | "officer" | "coach" | "member";
type GymMembershipStatus = "pending" | "trial" | "active" | "paused" | "cancelled";

export interface NativeMembership {
  gymId: string;
  gymName: string | null;
  role: GymMembershipRole;
  membershipStatus: GymMembershipStatus;
}

export interface NativeWorkoutPlan {
  id: string;
  gymId: string;
  gymName: string | null;
  title: string;
  goal: string | null;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  updatedAt: string;
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
  workoutPlans: NativeWorkoutPlan[];
}

export interface NativeAccessState {
  isAuthenticated: boolean;
  user: User | null;
  platformRole: PlatformOperatorRole | null;
  staffGymIds: string[];
}

export interface NativeOnboardingState {
  status: "incomplete" | "complete" | "error";
  completedAt: string | null;
  profileComplete: boolean;
  requiredConsentsComplete: boolean;
  marketingEmailOptIn: boolean;
  pushNotificationsOptIn: boolean;
  errorMessage: string | null;
}

interface SessionState {
  status: "loading" | "ready" | "error";
  access: NativeAccessState;
  profile: NativeProfile | null;
  onboarding: NativeOnboardingState;
  errorMessage: string | null;
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
  completeOnboarding: () => Promise<void>;
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

type WorkoutPlanRow = {
  id: string;
  gym_id: string;
  title: string;
  goal: string | null;
  status: NativeWorkoutPlan["status"];
  starts_at: string | null;
  ends_at: string | null;
  plan_json: Record<string, unknown> | null;
  updated_at: string;
  gyms: { name: string | null } | Array<{ name: string | null }> | null;
};

const EMPTY_ACCESS: NativeAccessState = {
  isAuthenticated: false,
  user: null,
  platformRole: null,
  staffGymIds: []
};

const INCOMPLETE_ONBOARDING: NativeOnboardingState = {
  status: "incomplete",
  completedAt: null,
  profileComplete: false,
  requiredConsentsComplete: false,
  marketingEmailOptIn: false,
  pushNotificationsOptIn: false,
  errorMessage: null
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

function extractPlanNotes(value: Record<string, unknown> | null): string | null {
  const notes = value?.notes;
  return typeof notes === "string" && notes.trim() ? notes.trim() : null;
}

async function resolveNativeAccess(client: SupabaseClient): Promise<NativeAccessState> {
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    if (authError.name === "AuthSessionMissingError") {
      return EMPTY_ACCESS;
    }
    throw new Error(authError.message || "Unable to validate the current session.");
  }

  if (!authData.user) {
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

async function loadNativeOnboardingState(
  client: SupabaseClient,
  userId: string
): Promise<NativeOnboardingState> {
  const { data, error } = await client.rpc("get_mobile_onboarding_state", {
    p_user_id: userId
  });

  if (error) {
    throw new Error(error.message || "Unable to load onboarding status.");
  }

  const payload = data as {
    status?: unknown;
    completedAt?: unknown;
    profileComplete?: unknown;
    requiredConsentsComplete?: unknown;
    marketingEmailOptIn?: unknown;
    pushNotificationsOptIn?: unknown;
  } | null;

  if (
    !payload ||
    (payload.status !== "complete" && payload.status !== "incomplete") ||
    typeof payload.profileComplete !== "boolean" ||
    typeof payload.requiredConsentsComplete !== "boolean" ||
    typeof payload.marketingEmailOptIn !== "boolean" ||
    typeof payload.pushNotificationsOptIn !== "boolean" ||
    (payload.completedAt !== null && typeof payload.completedAt !== "string")
  ) {
    throw new Error("The onboarding status response was invalid.");
  }

  return {
    status: payload.status,
    completedAt: payload.completedAt,
    profileComplete: payload.profileComplete,
    requiredConsentsComplete: payload.requiredConsentsComplete,
    marketingEmailOptIn: payload.marketingEmailOptIn,
    pushNotificationsOptIn: payload.pushNotificationsOptIn,
    errorMessage: null
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

  const [membershipResponse, workoutPlansResponse] = await Promise.all([
    client
      .from("gym_memberships")
      .select("gym_id,role,membership_status,gyms(name)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false }),
    client
      .from("gym_member_workout_plans")
      .select("id,gym_id,title,goal,status,starts_at,ends_at,plan_json,updated_at,gyms(name)")
      .eq("member_user_id", user.id)
      .in("status", ["draft", "active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(10)
  ]);

  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message || "Unable to load memberships.");
  }
  if (workoutPlansResponse.error) {
    throw new Error(workoutPlansResponse.error.message || "Unable to load workout plans.");
  }

  return {
    id: profileData.id as string,
    username: (profileData.username as string) ?? "member",
    displayName: (profileData.display_name as string | null | undefined) ?? user.email ?? "KRUXT Member",
    avatarPath: (profileData.avatar_url as string | null | undefined) ?? null,
    avatarUrl: await resolveAvatarDisplayUrl(client, (profileData.avatar_url as string | null | undefined) ?? null),
    bio: (profileData.bio as string | null | undefined) ?? null,
    isPublic: (profileData.is_public as boolean | null | undefined) ?? true,
    memberships: ((membershipResponse.data as GymMembershipRow[] | null) ?? []).map((membership) => ({
      gymId: membership.gym_id,
      gymName: extractGymName(membership.gyms),
      role: membership.role,
      membershipStatus: membership.membership_status
    })),
    workoutPlans: ((workoutPlansResponse.data as WorkoutPlanRow[] | null) ?? []).map((plan) => ({
      id: plan.id,
      gymId: plan.gym_id,
      gymName: extractGymName(plan.gyms),
      title: plan.title,
      goal: plan.goal,
      status: plan.status,
      startsAt: plan.starts_at,
      endsAt: plan.ends_at,
      notes: extractPlanNotes(plan.plan_json),
      updatedAt: plan.updated_at
    }))
  };
}

export function NativeSessionProvider({ children }: PropsWithChildren) {
  const supabase = useMemo(() => createNativeSupabaseClient(), []);
  const webAppUrl = useMemo(() => getPublicWebAppUrl(), []);
  const refreshSequence = useRef(0);
  const [state, setState] = useState<SessionState>({
    status: "loading",
    access: EMPTY_ACCESS,
    profile: null,
    onboarding: INCOMPLETE_ONBOARDING,
    errorMessage: null
  });

  async function refresh(background = false) {
    const requestId = ++refreshSequence.current;
    setState((current) => ({
      ...current,
      status: background && current.status === "ready" ? "ready" : "loading",
      errorMessage: null
    }));

    let access: NativeAccessState;
    try {
      access = await resolveNativeAccess(supabase);
    } catch (error) {
      if (requestId !== refreshSequence.current) return;
      setState({
        status: "error",
        access: EMPTY_ACCESS,
        profile: null,
        onboarding: {
          ...INCOMPLETE_ONBOARDING,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unable to validate the current session."
        },
        errorMessage: error instanceof Error ? error.message : "Unable to validate the current session."
      });
      return;
    }

    if (!access.user) {
      if (requestId !== refreshSequence.current) return;
      setState({
        status: "ready",
        access,
        profile: null,
        onboarding: INCOMPLETE_ONBOARDING,
        errorMessage: null
      });
      return;
    }

    try {
      const profile = await loadProfile(supabase, access.user);

      try {
        const onboarding = await loadNativeOnboardingState(supabase, access.user.id);
        if (requestId !== refreshSequence.current) return;
        setState({ status: "ready", access, profile, onboarding, errorMessage: null });
      } catch (error) {
        if (requestId !== refreshSequence.current) return;
        setState({
          status: "ready",
          access,
          profile,
          onboarding: {
            ...INCOMPLETE_ONBOARDING,
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Unable to load onboarding status."
          },
          errorMessage: null
        });
      }
    } catch (error) {
      if (requestId !== refreshSequence.current) return;
      setState({
        status: "ready",
        access,
        profile: null,
        onboarding: {
          ...INCOMPLETE_ONBOARDING,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unable to load your profile."
        },
        errorMessage: null
      });
    }
  }

  useEffect(() => {
    const authSubscription = supabase.auth.onAuthStateChange((event: AuthChangeEvent, _session: Session | null) => {
      void refresh(event === "TOKEN_REFRESHED");
    });

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void supabase.auth.startAutoRefresh();
        void refresh(true);
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
      password: input.password,
      options: {
        data: {
          display_name: input.displayName.trim(),
          username: input.username.trim().toLowerCase()
        }
      }
    });

    if (error) {
      throw new Error(error.message || "Unable to create account.");
    }

    if (data.user && data.session) {
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

  async function completeOnboarding() {
    const user = state.access.user;
    if (!user) {
      throw new Error("Authentication required.");
    }

    const { data, error } = await supabase.rpc("complete_mobile_onboarding", {
      p_user_id: user.id
    });
    if (error) {
      throw new Error(error.message || "Unable to complete onboarding.");
    }

    const payload = data as { status?: unknown } | null;
    if (payload?.status !== "complete") {
      throw new Error("The server did not confirm onboarding completion.");
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
    completeOnboarding,
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
