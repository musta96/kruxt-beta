type PrivacyAccessState = {
  status: string;
  user: { id: string } | null;
  error: string | null;
  access: {
    status: string;
    isAuthenticated: boolean;
    user: { id: string } | null;
    activationStatus: string | null;
    error: string | null;
  } | null;
};

// This permits only the privacy center, never training or a ready member session.
export function canManagePrivacy(state: PrivacyAccessState): boolean {
  return Boolean(
    state.user?.id && state.access?.user?.id === state.user.id &&
    state.access.isAuthenticated && state.access.activationStatus === "active" &&
    !state.error && !state.access.error &&
    ((state.status === "ready" && state.access.status === "ready") ||
      (state.status === "consent_required" && state.access.status === "consent_required"))
  );
}
