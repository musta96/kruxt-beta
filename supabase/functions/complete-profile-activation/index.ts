import { z } from "npm:zod@3";
import { parseJsonOr } from "../_shared/http.ts";
import { isAuthResult, requireAuth } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const PayloadSchema = z.object({
  inviteId: z.string().uuid(),
  attempt: z.number().int().positive(),
  acceptedOwnerTerms: z.boolean().default(false),
});

type ServiceClient = ReturnType<typeof serviceClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

async function writeAuditLog(
  supabase: ServiceClient,
  request: Request,
  input: {
    actorUserId: string;
    action: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }
) {
  const row = {
    actor_user_id: input.actorUserId,
    actor_role: "invited_profile",
    action: input.action,
    target_table: "gym_profile_invitations",
    target_id: input.targetId,
    reason: null,
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent"),
    metadata: input.metadata ?? {},
  };

  const { error } = await supabase.from("audit_logs").insert(row);
  if (!error) return;

  await supabase.from("audit_logs").insert({
    ...row,
    actor_user_id: null,
    metadata: { ...(input.metadata ?? {}), audit_actor_user_id: input.actorUserId },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await requireAuth(request);
  if (!isAuthResult(auth)) {
    return new Response(await auth.text(), { status: auth.status, headers });
  }

  try {
    const parsed = PayloadSchema.safeParse(await parseJsonOr<unknown>(request, {}));
    if (!parsed.success) {
      return json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }

    const supabase = serviceClient();
    const payload = parsed.data;

    const { data: invite, error: inviteError } = await supabase
      .from("gym_profile_invitations")
      .select("*")
      .eq("id", payload.inviteId)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) return json({ error: "Invite not found." }, 404);

    if (invite.invited_user_id !== auth.userId) {
      return json({ error: "Invite does not belong to this account." }, 403);
    }

    if (invite.status === "disabled") {
      return json({ error: "Invite has been disabled." }, 409);
    }

    if (invite.status === "active") {
      return json({ ok: true, gymId: invite.gym_id, role: invite.gym_role, status: "active" });
    }

    if (Number(invite.invite_attempt) !== payload.attempt) {
      return json({ error: "This activation link has been replaced. Use the latest invite email." }, 409);
    }

    const expiresAt = new Date(invite.expires_at);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("gym_profile_invitations")
        .update({
          status: "invite_expired",
          metadata: {
            ...(invite.metadata ?? {}),
            expired_at: nowIso,
          },
        })
        .eq("id", invite.id);

      await writeAuditLog(supabase, request, {
        actorUserId: auth.userId,
        action: "gym.profile_invite.expired",
        targetId: invite.id,
        metadata: {
          gym_id: invite.gym_id,
          invited_user_id: auth.userId,
          invite_attempt: invite.invite_attempt,
        },
      });

      return json({ error: "Invite has expired." }, 410);
    }

    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(auth.userId);
    if (authUserError || !authUser.user?.email) {
      return json({ error: "Unable to validate activated account email." }, 400);
    }

    if (authUser.user.email.trim().toLowerCase() !== String(invite.email).trim().toLowerCase()) {
      return json({ error: "Invite email does not match this account." }, 403);
    }

    if (invite.requested_role === "owner" && !payload.acceptedOwnerTerms) {
      return json({ error: "Owner terms and DPA acceptance is required before activation." }, 400);
    }

    const nowIso = new Date().toISOString();

    const [{ error: profileError }, { error: membershipError }] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          activation_status: "active",
          activation_status_updated_at: nowIso,
          activated_at: nowIso,
        })
        .eq("id", auth.userId),
      supabase.from("gym_memberships").upsert(
        {
          gym_id: invite.gym_id,
          user_id: auth.userId,
          role: invite.gym_role,
          membership_status: "active",
          membership_plan_id: invite.membership_plan_id ?? null,
          coach_user_id: invite.coach_user_id ?? null,
          started_at: nowIso,
        },
        { onConflict: "gym_id,user_id" }
      ),
    ]);
    if (profileError) throw profileError;
    if (membershipError) throw membershipError;

    if (invite.requested_role === "owner") {
      const { error: ownerUpdateError } = await supabase
        .from("gyms")
        .update({ owner_user_id: auth.userId })
        .eq("id", invite.gym_id);
      if (ownerUpdateError) throw ownerUpdateError;
    }

    const activationMetadata = {
      ...(invite.metadata ?? {}),
      activated_by: auth.userId,
      owner_terms_accepted_at: invite.requested_role === "owner" ? nowIso : null,
      owner_dpa_accepted_at: invite.requested_role === "owner" ? nowIso : null,
    };

    const { error: inviteUpdateError } = await supabase
      .from("gym_profile_invitations")
      .update({
        status: "active",
        activated_at: nowIso,
        metadata: activationMetadata,
      })
      .eq("id", invite.id);
    if (inviteUpdateError) throw inviteUpdateError;

    await writeAuditLog(supabase, request, {
      actorUserId: auth.userId,
      action: "gym.profile_invite.activated",
      targetId: invite.id,
      metadata: {
        gym_id: invite.gym_id,
        invited_user_id: auth.userId,
        requested_role: invite.requested_role,
        gym_role: invite.gym_role,
        owner_terms_accepted: invite.requested_role === "owner" ? payload.acceptedOwnerTerms : false,
      },
    });

    return json({
      ok: true,
      gymId: invite.gym_id,
      role: invite.gym_role,
      requestedRole: invite.requested_role,
      status: "active",
    });
  } catch (error) {
    const response = safeErrorResponse(error, "complete_profile_activation");
    return new Response(await response.text(), { status: response.status, headers });
  }
});
