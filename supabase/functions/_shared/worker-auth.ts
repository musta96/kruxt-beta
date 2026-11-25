import { jsonResponse } from "./http.ts";

// Global workers are machine endpoints, not authenticated member endpoints.
export async function requireWorkerAuth(request: Request): Promise<Response | null> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return jsonResponse({ error: "Worker authentication unavailable" }, 503);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const token = authorization.slice(7);
  if (!token || token.length !== secret.length) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret))
  ]);
  const actualBytes = new Uint8Array(actual);
  const expectedBytes = new Uint8Array(expected);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index++) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0 ? null : jsonResponse({ error: "Forbidden" }, 403);
}
