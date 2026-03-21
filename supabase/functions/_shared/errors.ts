import { jsonResponse } from "./http.ts";

/**
 * Returns a safe error response that does not leak internal details.
 * Logs the full error server-side for debugging.
 */
export function safeErrorResponse(error: unknown, context: string): Response {
  console.error(`[${context}]`, error);
  return jsonResponse({ error: "An internal error occurred." }, 500);
}

/**
 * Returns a 400 response for validation errors, using zod-style messages.
 */
export function validationErrorResponse(issues: Array<{ path: string; message: string }>): Response {
  return jsonResponse(
    {
      error: "Validation failed",
      issues: issues.map((i) => ({ field: i.path, message: i.message })),
    },
    400
  );
}
