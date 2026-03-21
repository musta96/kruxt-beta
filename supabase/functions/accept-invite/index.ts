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
  token: z.string().min(16),
});

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeUsername(email: string, userId: string): string {
  const localPart = email.split("@")[0] ?? "user";
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 18) || "user";
  return `${normalized}_${userId.slice(0, 6)}`;
}

function makeDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? "Member";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Member";
  return cleaned.slice(0, 64);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  const auth = await requireAuth(request);
  if (!isAuthResult(auth)) {
    return new Response(await auth.text(), {
      status: auth.status,
      headers,
    });
  }

  try {
    const parsed = PayloadSchema.safeParse(await parseJsonOr<unknown>(request, {}));
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        }),
        { status: 400, headers }
      );
    }

    const supabase = serviceClient();
    const tokenHash = await sha256Hex(parsed.data.token);

    const { data: invite, error: inviteError } = await supabase
      .from("gym_staff_invites")
      .select("id,gym_id,email,role,status,expires_at,revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    if (!invite) {
      return new Response(JSON.stringify({ error: "Invite not found." }), { status: 404, headers });
    }

    if (invite.status !== "pending") {
      return new Response(JSON.stringify({ error: "Invite is no longer pending." }), {
        status: 409,
        headers,
      });
    }

    if (invite.revoked_at) {
      return new Response(JSON.stringify({ error: "Invite has been revoked." }), { status: 409, headers });
    }

    const expiresAt = new Date(invite.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      await supabase
        .from("gym_staff_invites")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id);
      return new Response(JSON.stringify({ error: "Invite has expired." }), { status: 410, headers });
    }

    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(auth.userId);
    if (authUserError || !authUser.user?.email) {
      return new Response(JSON.stringify({ error: "Unable to resolve authenticated email." }), {
        status: 400,
        headers,
      });
    }

    const currentEmail = authUser.user.email.trim().toLowerCase();
    if (invite.email.trim().toLowerCase() !== currentEmail) {
      return new Response(JSON.stringify({ error: "Invite email does not match this account." }), {
        status: 403,
        headers,
      });
    }

    const { data: profileRow, error: profileReadError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profileReadError) {
      throw profileReadError;
    }

    if (!profileRow) {
      const username = makeUsername(currentEmail, auth.userId);
      const displayName = makeDisplayName(currentEmail);
      const { error: profileCreateError } = await supabase.from("profiles").insert({
        id: auth.userId,
        username,
        display_name: displayName,
      });
      if (profileCreateError) {
        throw profileCreateError;
      }
    }

    const nowIso = new Date().toISOString();
    const { error: membershipError } = await supabase
      .from("gym_memberships")
      .upsert(
        {
          gym_id: invite.gym_id,
          user_id: auth.userId,
          role: invite.role,
          membership_status: "active",
          started_at: nowIso,
        },
        { onConflict: "gym_id,user_id" }
      );

    if (membershipError) {
      throw membershipError;
    }

    const { error: inviteUpdateError } = await supabase
      .from("gym_staff_invites")
      .update({
        status: "accepted",
        accepted_by: auth.userId,
        accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", invite.id);
    if (inviteUpdateError) {
      throw inviteUpdateError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        gymId: invite.gym_id,
        role: invite.role,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    const response = safeErrorResponse(error, "accept_invite");
    return new Response(await response.text(), {
      status: response.status,
      headers,
    });
  }
});
