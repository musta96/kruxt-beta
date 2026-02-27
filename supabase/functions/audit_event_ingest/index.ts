import { parseJson, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { requireAuth, isAuthResult } from "../_shared/auth.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { z } from "npm:zod@3";

const AuditInputSchema = z.object({
  action: z.string().min(1).max(200),
  targetTable: z.string().min(1).max(100).optional(),
  targetId: z.string().uuid().optional(),
  reason: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
  actorUserId: z.string().uuid().optional(),
  actorRole: z.string().min(1).max(50).optional(),
});

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireAuth(request);
  if (!isAuthResult(auth)) return auth;

  try {
    const raw = await parseJson<unknown>(request);
    const parsed = AuditInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      }, 400);
    }

    const body = parsed.data;
    const supabase = serviceClient();

    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        actor_user_id: body.actorUserId ?? auth.userId,
        actor_role: body.actorRole ?? "service",
        action: body.action,
        target_table: body.targetTable ?? null,
        target_id: body.targetId ?? null,
        reason: body.reason ?? null,
        metadata: body.metadata ?? {}
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return jsonResponse({ inserted: true, id: data.id });
  } catch (error) {
    return safeErrorResponse(error, "audit_event_ingest");
  }
});
