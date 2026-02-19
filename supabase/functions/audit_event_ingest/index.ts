import { parseJson, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface AuditInput {
  action: string;
  targetTable?: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
  actorRole?: string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseJson<AuditInput>(request);
    const supabase = serviceClient();

    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        actor_user_id: body.actorUserId ?? null,
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
    return jsonResponse({ inserted: false, error: String(error) }, 500);
  }
});
