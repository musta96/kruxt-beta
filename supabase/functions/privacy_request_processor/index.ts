import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface PrivacyQueuePayload {
  triageLimit?: number;
  overdueLimit?: number;
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value as number), min), max);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = serviceClient();
    const payload = await parseJsonOr<PrivacyQueuePayload>(request, {});
    const triageLimit = clamp(payload.triageLimit, 1, 200, 25);
    const overdueLimit = clamp(payload.overdueLimit, 1, 500, 100);

    const { data, error } = await supabase.rpc("process_privacy_request_queue", {
      p_triage_limit: triageLimit,
      p_overdue_limit: overdueLimit
    });

    if (error) {
      throw error;
    }

    const result = (data ?? {}) as {
      triagedCount?: number;
      overdueMarkedCount?: number;
      triagedRequestIds?: string[];
      overdueRequestIds?: string[];
    };

    return jsonResponse({
      triagedCount: result.triagedCount ?? 0,
      overdueMarkedCount: result.overdueMarkedCount ?? 0,
      triagedRequestIds: result.triagedRequestIds ?? [],
      overdueRequestIds: result.overdueRequestIds ?? []
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
