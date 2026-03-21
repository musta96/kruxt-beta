import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

export interface AuthResult {
  userId: string;
  claims: Record<string, unknown>;
}

/**
 * Validates the Authorization header JWT and returns the authenticated user ID.
 * Returns null if auth fails — caller should return the 401 response.
 */
export async function requireAuth(request: Request): Promise<AuthResult | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    console.error("[AUTH] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return {
    userId: data.claims.sub as string,
    claims: data.claims as Record<string, unknown>,
  };
}

export function isAuthResult(result: AuthResult | Response): result is AuthResult {
  return "userId" in result;
}
