import { jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = serviceClient();

    const { data: requests, error: fetchError } = await supabase
      .from("privacy_requests")
      .select("id,status")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(25);

    if (fetchError) {
      throw fetchError;
    }

    const touched: string[] = [];

    for (const req of requests ?? []) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("privacy_requests")
        .update({
          status: "in_review",
          notes: "Queued by privacy_request_processor",
          updated_at: now
        })
        .eq("id", req.id)
        .eq("status", "submitted");

      if (!error) {
        touched.push(req.id);
      }
    }

    return jsonResponse({ queuedCount: touched.length, requestIds: touched });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
