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
  action: z.enum(["send", "resend", "revoke"]).default("send"),
  gymId: z.string().uuid(),
  inviteId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(["leader", "officer", "coach", "member"]).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addDaysIso(days: number): string {
  const next = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function assertCanManageGym(supabase: ReturnType<typeof serviceClient>, gymId: string, userId: string) {
  const [{ data: staffMembership }, { data: founderRole }] = await Promise.all([
    supabase
      .from("gym_memberships")
      .select("id")
      .eq("gym_id", gymId)
      .eq("user_id", userId)
      .in("membership_status", ["trial", "active"])
      .in("role", ["leader", "officer", "coach"])
      .maybeSingle(),
    supabase
      .from("platform_operator_accounts")
      .select("role,is_active")
      .eq("user_id", userId)
      .eq("role", "founder")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!staffMembership && !founderRole) {
    return false;
  }

  return true;
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

    const payload = parsed.data;
    const supabase = serviceClient();

    const canManage = await assertCanManageGym(supabase, payload.gymId, auth.userId);
    if (!canManage) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }

    if (payload.action === "revoke") {
      if (!payload.inviteId) {
        return new Response(JSON.stringify({ error: "inviteId is required for revoke." }), {
          status: 400,
          headers,
        });
      }

      const { data, error } = await supabase
        .from("gym_staff_invites")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.inviteId)
        .eq("gym_id", payload.gymId)
        .select(
          "id,gym_id,email,role,status,expires_at,created_at,updated_at,invited_by,accepted_by,accepted_at,revoked_at"
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return new Response(JSON.stringify({ error: "Invite not found." }), { status: 404, headers });
      }

      return new Response(JSON.stringify({ ok: true, invite: data }), { status: 200, headers });
    }

    const expiresInDays = payload.expiresInDays ?? 7;
    const expiresAt = addDaysIso(expiresInDays);
    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const tokenHash = await sha256Hex(token);
    const inviteUrlBase =
      Deno.env.get("APP_PUBLIC_URL") ||
      Deno.env.get("SITE_URL") ||
      "http://localhost:5173";
    const inviteUrl = `${inviteUrlBase.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;

    if (payload.action === "resend") {
      if (!payload.inviteId) {
        return new Response(JSON.stringify({ error: "inviteId is required for resend." }), {
          status: 400,
          headers,
        });
      }

      const updatePayload: Record<string, unknown> = {
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: "pending",
        revoked_at: null,
        accepted_at: null,
        accepted_by: null,
        updated_at: new Date().toISOString(),
      };

      if (payload.role) {
        updatePayload.role = payload.role;
      }

      const { data, error } = await supabase
        .from("gym_staff_invites")
        .update(updatePayload)
        .eq("id", payload.inviteId)
        .eq("gym_id", payload.gymId)
        .select(
          "id,gym_id,email,role,status,expires_at,created_at,updated_at,invited_by,accepted_by,accepted_at,revoked_at"
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return new Response(JSON.stringify({ error: "Invite not found." }), { status: 404, headers });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          invite: data,
          inviteUrl,
          token,
          mode: "resend",
        }),
        { status: 200, headers }
      );
    }

    if (!payload.email) {
      return new Response(JSON.stringify({ error: "email is required for send." }), {
        status: 400,
        headers,
      });
    }

    const normalizedEmail = normalizeEmail(payload.email);
    const role = payload.role ?? "member";
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("gym_staff_invites")
      .select("id")
      .eq("gym_id", payload.gymId)
      .eq("status", "pending")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let invite;
    if (existing?.id) {
      const { data, error } = await supabase
        .from("gym_staff_invites")
        .update({
          role,
          token_hash: tokenHash,
          expires_at: expiresAt,
          invited_by: auth.userId,
          updated_at: now,
          revoked_at: null,
          accepted_at: null,
          accepted_by: null,
        })
        .eq("id", existing.id)
        .select(
          "id,gym_id,email,role,status,expires_at,created_at,updated_at,invited_by,accepted_by,accepted_at,revoked_at"
        )
        .single();

      if (error) {
        throw error;
      }
      invite = data;
    } else {
      const { data, error } = await supabase
        .from("gym_staff_invites")
        .insert({
          gym_id: payload.gymId,
          email: normalizedEmail,
          role,
          token_hash: tokenHash,
          invited_by: auth.userId,
          expires_at: expiresAt,
          status: "pending",
          metadata: {},
        })
        .select(
          "id,gym_id,email,role,status,expires_at,created_at,updated_at,invited_by,accepted_by,accepted_at,revoked_at"
        )
        .single();

      if (error) {
        throw error;
      }
      invite = data;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        invite,
        inviteUrl,
        token,
        mode: "send",
      }),
      { status: 200, headers }
    );
  } catch (error) {
    const response = safeErrorResponse(error, "send_invite");
    return new Response(await response.text(), {
      status: response.status,
      headers,
    });
  }
});
