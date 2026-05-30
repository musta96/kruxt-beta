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
  action: z.enum(["create", "resend", "disable"]).default("create"),
  gymId: z.string().uuid(),
  inviteId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(["owner", "admin", "staff", "pt", "member"]).optional(),
  membershipPlanId: z.string().uuid().nullable().optional(),
  coachUserId: z.string().uuid().nullable().optional(),
  expiresInHours: z.number().int().min(24).max(72).optional(),
});

type ServiceClient = ReturnType<typeof serviceClient>;
type RequestedRole = "owner" | "admin" | "staff" | "pt" | "member";
type GymRole = "leader" | "officer" | "coach" | "member";
type InviteContext = "platform" | "gym_owner" | "gym_staff";

type EmailDeliveryResult = {
  status: "sent" | "link_only" | "failed";
  provider: "resend" | "none";
  error?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function roleToGymRole(role: RequestedRole): GymRole {
  if (role === "owner") return "leader";
  if (role === "admin" || role === "staff") return "officer";
  if (role === "pt") return "coach";
  return "member";
}

function makeUsername(email: string, userId: string): string {
  const localPart = email.split("@")[0] ?? "user";
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 16) || "user";
  return `${normalized}_${userId.slice(0, 6)}`.slice(0, 24);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function appBaseUrl(): string {
  return (
    Deno.env.get("KRUXT_WEB_URL")?.trim() ||
    Deno.env.get("APP_PUBLIC_URL")?.trim() ||
    Deno.env.get("SITE_URL")?.trim() ||
    "http://localhost:3200"
  ).replace(/\/$/, "");
}

function activationRedirect(inviteId: string, attempt: number): string {
  const url = new URL("/activate-invite", appBaseUrl());
  url.searchParams.set("inviteId", inviteId);
  url.searchParams.set("attempt", String(attempt));
  return url.toString();
}

async function sendActivationEmail(args: {
  email: string;
  inviteUrl: string;
  displayName: string;
  requestedRole: RequestedRole;
  gymName?: string | null;
  expiresAt: string;
}): Promise<EmailDeliveryResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("INVITE_EMAIL_FROM")?.trim() || Deno.env.get("RESEND_FROM_EMAIL")?.trim();

  if (!apiKey || !from) {
    return { status: "link_only", provider: "none" };
  }

  const replyTo = Deno.env.get("INVITE_EMAIL_REPLY_TO")?.trim();
  const gymName = args.gymName?.trim() || "your gym";
  const roleLabel = args.requestedRole === "pt" ? "PT" : `${args.requestedRole.slice(0, 1).toUpperCase()}${args.requestedRole.slice(1)}`;
  const subject = `${gymName} invited you to activate KRUXT`;
  const expires = new Date(args.expiresAt).toLocaleString("en-GB", { timeZone: "UTC", hour12: false });
  const safeName = escapeHtml(args.displayName);
  const safeGym = escapeHtml(gymName);
  const safeRole = escapeHtml(roleLabel);
  const safeUrl = escapeHtml(args.inviteUrl);
  const safeExpires = escapeHtml(`${expires} UTC`);

  const text = [
    `Hi ${args.displayName},`,
    "",
    `${gymName} created a KRUXT profile for you as ${roleLabel}.`,
    "Use this one-time link to verify your email and set your own password:",
    args.inviteUrl,
    "",
    `This link expires at ${expires} UTC.`,
  ].join("\n");

  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">',
    `<p>Hi ${safeName},</p>`,
    `<p><strong>${safeGym}</strong> created a KRUXT profile for you as <strong>${safeRole}</strong>.</p>`,
    `<p><a href="${safeUrl}" style="display:inline-block;background:#22d3ee;color:#06121b;border-radius:10px;padding:10px 16px;text-decoration:none;font-weight:700">Activate your profile</a></p>`,
    `<p>This one-time link expires at ${safeExpires}. You will set your own password after opening it.</p>`,
    `<p>If the button does not work, copy and paste this URL into your browser:<br />${safeUrl}</p>`,
    "</div>",
  ].join("");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.email],
        subject,
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: "failed",
        provider: "resend",
        error: `Resend returned ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    return { status: "sent", provider: "resend" };
  } catch (error) {
    return {
      status: "failed",
      provider: "resend",
      error: error instanceof Error ? error.message : "Unknown email delivery failure.",
    };
  }
}

async function writeAuditLog(
  supabase: ServiceClient,
  request: Request,
  input: {
    actorUserId: string;
    actorRole: string;
    action: string;
    targetId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const row = {
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    action: input.action,
    target_table: "gym_profile_invitations",
    target_id: input.targetId ?? null,
    reason: input.reason ?? null,
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

async function platformInviteContext(supabase: ServiceClient, actorUserId: string): Promise<{ allowed: boolean; role?: string }> {
  const { data: operator, error: operatorError } = await supabase
    .from("platform_operator_accounts")
    .select("role,is_active")
    .eq("user_id", actorUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (operatorError || !operator) return { allowed: false };
  if (operator.role === "founder") return { allowed: true, role: operator.role };

  const [{ data: override }, { data: rolePermission }] = await Promise.all([
    supabase
      .from("platform_operator_permission_overrides")
      .select("is_allowed")
      .eq("user_id", actorUserId)
      .eq("permission_key", "platform.tenants.create_staff_invite")
      .maybeSingle(),
    supabase
      .from("platform_role_permissions")
      .select("is_allowed")
      .eq("role", operator.role)
      .eq("permission_key", "platform.tenants.create_staff_invite")
      .maybeSingle(),
  ]);

  return { allowed: override?.is_allowed ?? rolePermission?.is_allowed ?? false, role: operator.role };
}

async function assertCanInvite(
  supabase: ServiceClient,
  gymId: string,
  actorUserId: string,
  requestedRole: RequestedRole
): Promise<{ context: InviteContext; actorRole: string } | Response> {
  const platform = await platformInviteContext(supabase, actorUserId);
  if (platform.allowed) {
    return { context: "platform", actorRole: platform.role ?? "platform_operator" };
  }

  const [{ data: gym }, { data: membership }] = await Promise.all([
    supabase.from("gyms").select("owner_user_id").eq("id", gymId).maybeSingle(),
    supabase
      .from("gym_memberships")
      .select("role,membership_status")
      .eq("gym_id", gymId)
      .eq("user_id", actorUserId)
      .in("membership_status", ["trial", "active"])
      .eq("role", "leader")
      .maybeSingle(),
  ]);

  const isOwner = gym?.owner_user_id === actorUserId || Boolean(membership);
  if (!isOwner) {
    return json({ error: "Forbidden" }, 403);
  }

  if (requestedRole === "owner") {
    return json({ error: "Only KRUXT platform operators can create owner invites." }, 403);
  }

  return { context: gym?.owner_user_id === actorUserId ? "gym_owner" : "gym_staff", actorRole: "gym_owner" };
}

async function validateAssignments(
  supabase: ServiceClient,
  gymId: string,
  input: { membershipPlanId?: string | null; coachUserId?: string | null }
): Promise<Response | null> {
  if (input.membershipPlanId) {
    const { data: plan, error } = await supabase
      .from("gym_membership_plans")
      .select("id")
      .eq("id", input.membershipPlanId)
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!plan) return json({ error: "Membership plan must belong to this gym." }, 400);
  }

  if (input.coachUserId) {
    const { data: coach, error } = await supabase
      .from("gym_memberships")
      .select("user_id")
      .eq("gym_id", gymId)
      .eq("user_id", input.coachUserId)
      .in("membership_status", ["trial", "active"])
      .in("role", ["leader", "officer", "coach"])
      .maybeSingle();

    if (error) throw error;
    if (!coach) return json({ error: "Assigned PT must be active staff in this gym." }, 400);
  }

  return null;
}

async function generateAuthLink(args: {
  supabase: ServiceClient;
  type: "invite" | "magiclink";
  email: string;
  redirectTo: string;
  metadata: Record<string, unknown>;
}) {
  const primary = await args.supabase.auth.admin.generateLink({
    type: args.type,
    email: args.email,
    options: {
      data: args.metadata,
      redirectTo: args.redirectTo,
    },
  });

  if (!primary.error) return primary;

  const fallback = await args.supabase.auth.admin.generateLink({
    type: args.type,
    email: args.email,
    options: {
      data: args.metadata,
    },
  });

  return fallback.error ? primary : fallback;
}

async function createInvite(
  request: Request,
  supabase: ServiceClient,
  actorUserId: string,
  payload: z.infer<typeof PayloadSchema>
) {
  if (!payload.fullName || !payload.email || !payload.role) {
    return json({ error: "fullName, email, and role are required." }, 400);
  }

  const fullName = payload.fullName.trim();
  const email = normalizeEmail(payload.email);
  const requestedRole = payload.role;
  const permission = await assertCanInvite(supabase, payload.gymId, actorUserId, requestedRole);
  if (permission instanceof Response) return permission;

  const assignmentError = await validateAssignments(supabase, payload.gymId, payload);
  if (assignmentError) return assignmentError;

  const { data: gymRow } = await supabase.from("gyms").select("name").eq("id", payload.gymId).maybeSingle();
  const gymName = typeof gymRow?.name === "string" ? gymRow.name : null;
  const expiresInHours = payload.expiresInHours ?? 48;
  const expiresAt = addHoursIso(expiresInHours);
  const nowIso = new Date().toISOString();
  const inviteId = crypto.randomUUID();
  const gymRole = roleToGymRole(requestedRole);

  const { data: invite, error: inviteError } = await supabase
    .from("gym_profile_invitations")
    .insert({
      id: inviteId,
      gym_id: payload.gymId,
      email,
      display_name: fullName,
      requested_role: requestedRole,
      gym_role: gymRole,
      membership_plan_id: payload.membershipPlanId ?? null,
      coach_user_id: payload.coachUserId ?? null,
      status: "pending_activation",
      invite_attempt: 1,
      invited_by: actorUserId,
      invited_by_context: permission.context,
      expires_at: expiresAt,
      metadata: { created_by_feature: "operator_profile_magic_link" },
    })
    .select("*")
    .single();

  if (inviteError) {
    if (inviteError.code === "23505") {
      return json({ error: "A pending activation invite already exists for this email." }, 409);
    }
    throw inviteError;
  }

  const redirectTo = activationRedirect(inviteId, 1);
  const link = await generateAuthLink({
    supabase,
    type: "invite",
    email,
    redirectTo,
    metadata: {
      display_name: fullName,
      kruxt_profile_invite_id: inviteId,
      kruxt_invite_attempt: 1,
    },
  });

  if (link.error || !link.data?.user?.id || !link.data?.properties?.action_link) {
    await supabase
      .from("gym_profile_invitations")
      .update({
        status: "disabled",
        disabled_at: nowIso,
        last_email_status: "auth_link_failed",
        last_email_provider: "supabase_auth",
        metadata: {
          created_by_feature: "operator_profile_magic_link",
          auth_link_error: link.error?.message ?? "Unable to generate activation link.",
        },
      })
      .eq("id", inviteId);

    return json({ error: link.error?.message ?? "Unable to generate activation link." }, 409);
  }

  const userId = link.data.user.id;
  const username = makeUsername(email, userId);
  const actionLink = link.data.properties.action_link;

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id,activation_status")
    .eq("id", userId)
    .maybeSingle();
  if (existingProfileError) throw existingProfileError;
  if (existingProfile) {
    await supabase
      .from("gym_profile_invitations")
      .update({
        status: "disabled",
        disabled_at: nowIso,
        last_email_status: "email_already_in_use",
        last_email_provider: "supabase_auth",
      })
      .eq("id", inviteId);
    return json({ error: "Email is already in use." }, 409);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      username,
      display_name: fullName,
      home_gym_id: payload.gymId,
      activation_status: "pending_activation",
      activation_status_updated_at: nowIso,
      activated_at: null,
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  const { error: membershipError } = await supabase.from("gym_memberships").upsert(
    {
      gym_id: payload.gymId,
      user_id: userId,
      role: gymRole,
      membership_status: "pending",
      membership_plan_id: payload.membershipPlanId ?? null,
      coach_user_id: payload.coachUserId ?? null,
      started_at: null,
    },
    { onConflict: "gym_id,user_id" }
  );
  if (membershipError) throw membershipError;

  const emailDelivery = await sendActivationEmail({
    email,
    inviteUrl: actionLink,
    displayName: fullName,
    requestedRole,
    gymName,
    expiresAt,
  });

  const { data: updatedInvite, error: updateError } = await supabase
    .from("gym_profile_invitations")
    .update({
      invited_user_id: userId,
      sent_at: nowIso,
      last_email_status: emailDelivery.status,
      last_email_provider: emailDelivery.provider,
      metadata: {
        created_by_feature: "operator_profile_magic_link",
        activation_redirect: redirectTo,
        email_error: emailDelivery.error ?? null,
      },
    })
    .eq("id", inviteId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  await writeAuditLog(supabase, request, {
    actorUserId,
    actorRole: permission.actorRole,
    action: "gym.profile_invite.created",
    targetId: inviteId,
    metadata: {
      gym_id: payload.gymId,
      invited_user_id: userId,
      requested_role: requestedRole,
      gym_role: gymRole,
      invited_by_context: permission.context,
      email_delivery: emailDelivery.status,
    },
  });

  return json({
    ok: true,
    invite: updatedInvite ?? invite,
    inviteUrl: actionLink,
    mode: "create",
    emailDelivery: emailDelivery.status,
    emailProvider: emailDelivery.provider,
    ...(emailDelivery.error ? { emailError: emailDelivery.error } : {}),
  });
}

async function resendInvite(
  request: Request,
  supabase: ServiceClient,
  actorUserId: string,
  payload: z.infer<typeof PayloadSchema>
) {
  if (!payload.inviteId) return json({ error: "inviteId is required for resend." }, 400);

  const { data: invite, error: inviteError } = await supabase
    .from("gym_profile_invitations")
    .select("*")
    .eq("id", payload.inviteId)
    .eq("gym_id", payload.gymId)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) return json({ error: "Invite not found." }, 404);
  if (invite.status === "active" || invite.status === "disabled") {
    return json({ error: "This invite cannot be resent." }, 409);
  }
  if (!invite.invited_user_id) {
    return json({ error: "Invite does not have an activation profile yet." }, 409);
  }

  const permission = await assertCanInvite(supabase, payload.gymId, actorUserId, invite.requested_role as RequestedRole);
  if (permission instanceof Response) return permission;

  const { data: gymRow } = await supabase.from("gyms").select("name").eq("id", payload.gymId).maybeSingle();
  const nextAttempt = Number(invite.invite_attempt ?? 1) + 1;
  const expiresAt = addHoursIso(payload.expiresInHours ?? 48);
  const redirectTo = activationRedirect(invite.id, nextAttempt);
  const link = await generateAuthLink({
    supabase,
    type: "magiclink",
    email: invite.email,
    redirectTo,
    metadata: {
      display_name: invite.display_name,
      kruxt_profile_invite_id: invite.id,
      kruxt_invite_attempt: nextAttempt,
    },
  });

  if (link.error || !link.data?.properties?.action_link) {
    return json({ error: link.error?.message ?? "Unable to generate activation link." }, 409);
  }

  const actionLink = link.data.properties.action_link;
  const emailDelivery = await sendActivationEmail({
    email: invite.email,
    inviteUrl: actionLink,
    displayName: invite.display_name,
    requestedRole: invite.requested_role as RequestedRole,
    gymName: typeof gymRow?.name === "string" ? gymRow.name : null,
    expiresAt,
  });

  const { data: updatedInvite, error: updateError } = await supabase
    .from("gym_profile_invitations")
    .update({
      status: "pending_activation",
      invite_attempt: nextAttempt,
      expires_at: expiresAt,
      sent_at: new Date().toISOString(),
      last_email_status: emailDelivery.status,
      last_email_provider: emailDelivery.provider,
      metadata: {
        ...(invite.metadata ?? {}),
        activation_redirect: redirectTo,
        email_error: emailDelivery.error ?? null,
      },
    })
    .eq("id", invite.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  await writeAuditLog(supabase, request, {
    actorUserId,
    actorRole: permission.actorRole,
    action: "gym.profile_invite.resent",
    targetId: invite.id,
    metadata: {
      gym_id: payload.gymId,
      invited_user_id: invite.invited_user_id,
      requested_role: invite.requested_role,
      invite_attempt: nextAttempt,
      email_delivery: emailDelivery.status,
    },
  });

  return json({
    ok: true,
    invite: updatedInvite,
    inviteUrl: actionLink,
    mode: "resend",
    emailDelivery: emailDelivery.status,
    emailProvider: emailDelivery.provider,
    ...(emailDelivery.error ? { emailError: emailDelivery.error } : {}),
  });
}

async function disableInvite(
  request: Request,
  supabase: ServiceClient,
  actorUserId: string,
  payload: z.infer<typeof PayloadSchema>
) {
  if (!payload.inviteId) return json({ error: "inviteId is required for disable." }, 400);

  const { data: invite, error: inviteError } = await supabase
    .from("gym_profile_invitations")
    .select("*")
    .eq("id", payload.inviteId)
    .eq("gym_id", payload.gymId)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) return json({ error: "Invite not found." }, 404);
  if (invite.status === "active") {
    return json({ error: "Activated profiles are disabled from the member detail workflow." }, 409);
  }

  const permission = await assertCanInvite(supabase, payload.gymId, actorUserId, invite.requested_role as RequestedRole);
  if (permission instanceof Response) return permission;

  const nowIso = new Date().toISOString();
  const { data: updatedInvite, error: updateError } = await supabase
    .from("gym_profile_invitations")
    .update({
      status: "disabled",
      disabled_at: nowIso,
      metadata: {
        ...(invite.metadata ?? {}),
        disabled_by: actorUserId,
      },
    })
    .eq("id", invite.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  if (invite.invited_user_id) {
    await Promise.all([
      supabase
        .from("profiles")
        .update({ activation_status: "disabled", activation_status_updated_at: nowIso })
        .eq("id", invite.invited_user_id)
        .eq("activation_status", "pending_activation"),
      supabase
        .from("gym_memberships")
        .update({ membership_status: "cancelled", ends_at: nowIso })
        .eq("gym_id", payload.gymId)
        .eq("user_id", invite.invited_user_id)
        .eq("membership_status", "pending"),
    ]);
  }

  await writeAuditLog(supabase, request, {
    actorUserId,
    actorRole: permission.actorRole,
    action: "gym.profile_invite.disabled",
    targetId: invite.id,
    metadata: {
      gym_id: payload.gymId,
      invited_user_id: invite.invited_user_id,
      requested_role: invite.requested_role,
    },
  });

  return json({ ok: true, invite: updatedInvite, mode: "disable" });
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

    if (payload.action === "resend") {
      return await resendInvite(request, supabase, auth.userId, payload);
    }
    if (payload.action === "disable") {
      return await disableInvite(request, supabase, auth.userId, payload);
    }
    return await createInvite(request, supabase, auth.userId, payload);
  } catch (error) {
    const response = safeErrorResponse(error, "create_profile_invite");
    return new Response(await response.text(), { status: response.status, headers });
  }
});
