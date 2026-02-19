import { parseJson, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface WebhookPayload {
  provider: "apple_health" | "garmin" | "fitbit" | "huawei_health" | "suunto" | "oura" | "whoop";
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash: string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseJson<WebhookPayload>(request);
    const supabase = serviceClient();

    const { error } = await supabase
      .from("integration_webhook_events")
      .insert({
        provider: body.provider,
        provider_event_id: body.providerEventId,
        event_type: body.eventType,
        payload_hash: body.payloadHash,
        payload_json: body.payload,
        processing_status: "pending"
      });

    if (error && !error.message.includes("duplicate")) {
      throw error;
    }

    return jsonResponse({ accepted: true });
  } catch (error) {
    return jsonResponse({ accepted: false, error: String(error) }, 500);
  }
});
