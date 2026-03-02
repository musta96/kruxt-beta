import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createMobileSupabaseClient } from "@mobile/services/supabase-client";

type InviteState = "checking" | "auth_required" | "accepting" | "accepted" | "error";

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useMemo(() => createMobileSupabaseClient(), []);
  const token = useMemo(() => new URLSearchParams(location.search).get("token")?.trim() ?? "", [location.search]);

  const [status, setStatus] = useState<InviteState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [acceptedGymId, setAcceptedGymId] = useState<string | null>(null);
  const [acceptedRole, setAcceptedRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const acceptInvite = async () => {
      if (!token) {
        if (!active) return;
        setStatus("error");
        setError("Invite token missing.");
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!active) return;

        if (authError || !authData.user) {
          setStatus("auth_required");
          return;
        }

        setStatus("accepting");
        const { data, error: invokeError } = await supabase.functions.invoke("accept-invite", {
          body: { token }
        });

        if (!active) return;

        if (invokeError) {
          setStatus("error");
          setError(invokeError.message || "Unable to accept invite.");
          return;
        }

        if (!data?.ok) {
          setStatus("error");
          setError(typeof data?.error === "string" ? data.error : "Unable to accept invite.");
          return;
        }

        setAcceptedGymId(typeof data.gymId === "string" ? data.gymId : null);
        setAcceptedRole(typeof data.role === "string" ? data.role : null);
        setStatus("accepted");
      } catch (inviteError) {
        if (!active) return;
        setStatus("error");
        setError(inviteError instanceof Error ? inviteError.message : "Unable to accept invite.");
      }
    };

    void acceptInvite();
    return () => {
      active = false;
    };
  }, [supabase, token]);

  const redirectTarget = useMemo(
    () => `/?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`,
    [token]
  );

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="panel p-6 space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">Accept Invite</h1>
          <p className="text-sm text-muted-foreground">
            Join the organization, activate your staff access, and continue to the admin workspace.
          </p>
        </div>

        {status === "checking" && (
          <div className="panel p-5">
            <p className="text-sm text-muted-foreground">Checking your session...</p>
          </div>
        )}

        {status === "auth_required" && (
          <div className="panel border-warning/40 bg-warning/10 p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Sign in or create your account first, then the invite will be accepted automatically.
            </p>
            <button
              type="button"
              className="btn-primary w-auto"
              onClick={() => navigate(redirectTarget)}
            >
              Continue to Sign In
            </button>
          </div>
        )}

        {status === "accepting" && (
          <div className="panel p-5">
            <p className="text-sm text-muted-foreground">Activating your staff access...</p>
          </div>
        )}

        {status === "accepted" && (
          <div className="panel border-success/40 bg-success/10 p-5 space-y-3">
            <p className="text-sm font-semibold text-success">
              Invite accepted. Your organization access is now active.
            </p>
            <p className="text-xs text-muted-foreground">
              {acceptedRole ? `Assigned role: ${acceptedRole}. ` : ""}
              {acceptedGymId ? `Gym id: ${acceptedGymId}.` : ""}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary w-auto" onClick={() => navigate("/admin")}>
                Open Admin
              </button>
              <button type="button" className="btn-compact" onClick={() => navigate("/feed")}>
                Go to Feed
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="panel border-destructive/40 bg-destructive/10 p-5 space-y-3">
            <p className="text-sm font-semibold text-destructive">{error ?? "Unable to accept invite."}</p>
            <button type="button" className="btn-compact" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
