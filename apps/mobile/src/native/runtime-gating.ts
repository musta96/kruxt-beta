import type { NativeOnboardingState } from "./session";

export type NativeRootSurface =
  | "loading"
  | "session-error"
  | "auth"
  | "invite"
  | "onboarding"
  | "onboarding-error"
  | "tabs";

export function resolveNativeRootSurface(input: {
  sessionStatus: "loading" | "ready" | "error";
  hasAuthenticatedUser: boolean;
  hasInviteToken: boolean;
  onboardingStatus: NativeOnboardingState["status"];
}): NativeRootSurface {
  if (input.sessionStatus === "loading") return "loading";
  if (input.sessionStatus === "error") return "session-error";
  if (!input.hasAuthenticatedUser) return "auth";
  if (input.hasInviteToken) return "invite";
  if (input.onboardingStatus === "error") return "onboarding-error";
  if (input.onboardingStatus !== "complete") return "onboarding";
  return "tabs";
}
