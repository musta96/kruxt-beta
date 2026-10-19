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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

type ActivationResult = {
  ok: boolean;
  status: string;
  error?: string;
  gymId?: string;
  role?: string;
  requestedRole?: string;
  membershipId?: string;
};

const ERROR_STATUS_BY_RESULT: Record<string, number> = {
  disabled: 409,
  expired: 410,
  forbidden: 403,
  invalid_account: 400,
  not_found: 404,
  owner_consent_required: 400,
  stale_attempt: 409,
};

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

    const payload = parsed.data;
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("complete_profile_activation_atomic", {
      p_invite_id: payload.inviteId,
      p_user_id: auth.userId,
      p_attempt: payload.attempt,
      p_accepted_owner_terms: payload.acceptedOwnerTerms,
      p_ip_address: request.headers.get("x-forwarded-for"),
      p_user_agent: request.headers.get("user-agent"),
    });
    if (error) throw error;

    const result = data as ActivationResult | null;
    if (!result) throw new Error("Activation contract returned no result.");
    if (!result.ok) {
      return json({ error: result.error ?? "Unable to activate profile." }, ERROR_STATUS_BY_RESULT[result.status] ?? 400);
    }

    return json(result);
  } catch (error) {
    const response = safeErrorResponse(error, "complete_profile_activation");
    return new Response(await response.text(), { status: response.status, headers });
  }
});
