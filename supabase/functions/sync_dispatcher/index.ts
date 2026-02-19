import { jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = serviceClient();

    const { data: jobs, error: fetchError } = await supabase
      .from("device_sync_jobs")
      .select("id,connection_id,user_id,provider")
      .in("status", ["queued", "retry_scheduled"])
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchError) {
      throw fetchError;
    }

    const processed: string[] = [];

    for (const job of jobs ?? []) {
      const { error: updateError } = await supabase
        .from("device_sync_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.id)
        .in("status", ["queued", "retry_scheduled"]);

      if (updateError) {
        continue;
      }

      await supabase.from("event_outbox").insert({
        event_type: "integration.sync_dispatch",
        aggregate_type: "device_sync_job",
        aggregate_id: job.id,
        payload: {
          connection_id: job.connection_id,
          user_id: job.user_id,
          provider: job.provider
        }
      });

      processed.push(job.id);
    }

    return jsonResponse({ processedCount: processed.length, processedJobIds: processed });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
