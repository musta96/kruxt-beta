import type { SupabaseClient, User } from "@supabase/supabase-js";

type SupportGrantRow = {
  id: string;
  gym_id: string;
  operator_user_id: string;
  status: string;
  ends_at: string | null;
};

type SupportSessionRow = {
  id: string;
  grant_id: string;
  gym_id: string;
  operator_user_id: string;
  session_status: string;
};

interface EnsureOperatorSessionInput {
  supabase: SupabaseClient;
  user: User;
  gymId: string;
  targetPath: string;
  mode: "manage" | "preview";
}

interface EnsureOperatorSessionResult {
  grantId: string;
  sessionId: string;
}

const SESSION_HOURS = 4;

function addHours(date: Date, hours: number): string {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export async function ensureOperatorGymSession({
  supabase,
  user,
  gymId,
  targetPath,
  mode,
}: EnsureOperatorSessionInput): Promise<EnsureOperatorSessionResult> {
  const now = new Date();

  const { data: grantsData, error: grantsError } = await supabase
    .from("gym_support_access_grants")
    .select("id,gym_id,operator_user_id,status,ends_at")
    .eq("gym_id", gymId)
    .eq("operator_user_id", user.id)
    .eq("status", "approved")
    .or(`ends_at.is.null,ends_at.gte.${now.toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (grantsError) {
    throw new Error(grantsError.message || "Unable to load platform access grant.");
  }

  let grant = (((grantsData ?? []) as SupportGrantRow[]) ?? [])[0];

  if (!grant) {
    const { data: grantData, error: grantError } = await supabase
      .from("gym_support_access_grants")
      .insert({
        gym_id: gymId,
        operator_user_id: user.id,
        requested_by_user_id: user.id,
        approved_by_user_id: user.id,
        status: "approved",
        permission_scope: ["workspace.manage", "workspace.preview", "read_only"],
        reason: "KRUXT platform operator opened a client gym workspace.",
        note: "Auto-approved for platform operator workspace switching.",
        starts_at: now.toISOString(),
        ends_at: addHours(now, SESSION_HOURS),
        metadata: {
          source: "platform_tenants",
          mode,
          targetPath,
        },
      })
      .select("id,gym_id,operator_user_id,status,ends_at")
      .single();

    if (grantError) {
      throw new Error(grantError.message || "Unable to create platform access grant.");
    }
    grant = grantData as SupportGrantRow;
  }

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("gym_support_access_sessions")
    .select("id,grant_id,gym_id,operator_user_id,session_status")
    .eq("grant_id", grant.id)
    .eq("gym_id", gymId)
    .eq("operator_user_id", user.id)
    .eq("session_status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  if (sessionsError) {
    throw new Error(sessionsError.message || "Unable to load platform access session.");
  }

  const existingSession = (((sessionsData ?? []) as SupportSessionRow[]) ?? [])[0];
  if (existingSession) {
    return { grantId: existingSession.grant_id, sessionId: existingSession.id };
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("gym_support_access_sessions")
    .insert({
      grant_id: grant.id,
      gym_id: gymId,
      operator_user_id: user.id,
      session_status: "active",
      justification: `Open ${mode === "preview" ? "member preview" : "gym admin"} from KRUXT Platform.`,
      actions_summary: [
        {
          action: "workspace_opened",
          mode,
          targetPath,
          at: now.toISOString(),
        },
      ],
      metadata: {
        source: "platform_tenants",
        mode,
        targetPath,
      },
    })
    .select("id,grant_id,gym_id,operator_user_id,session_status")
    .single();

  if (sessionError) {
    throw new Error(sessionError.message || "Unable to create platform access session.");
  }

  const session = sessionData as SupportSessionRow;
  return { grantId: session.grant_id, sessionId: session.id };
}
