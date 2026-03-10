import type { SupabaseClient } from "@supabase/supabase-js";

import { getMobileSupabaseConfig } from "./supabase-client";

interface FunctionValidationIssue {
  field?: string;
  message?: string;
}

interface FunctionErrorPayload {
  error?: string;
  message?: string;
  detail?: string;
  issues?: FunctionValidationIssue[];
}

function buildFunctionError(
  name: string,
  status: number,
  payload: FunctionErrorPayload | null,
  fallbackText: string
): Error {
  if (Array.isArray(payload?.issues) && payload.issues.length > 0) {
    const details = payload.issues
      .map((issue) => {
        const field = issue.field?.trim();
        const message = issue.message?.trim();
        if (field && message) return `${field}: ${message}`;
        return message || field || null;
      })
      .filter(Boolean)
      .join("; ");

    if (details) {
      return new Error(details);
    }
  }

  const candidate =
    payload?.error?.trim() ||
    payload?.message?.trim() ||
    payload?.detail?.trim() ||
    fallbackText.trim();

  return new Error(candidate || `${name} failed with status ${status}.`);
}

export async function invokeMobileSupabaseFunction<TResponse>(
  client: SupabaseClient,
  name: string,
  body: Record<string, unknown>
): Promise<TResponse> {
  const { url, anonKey } = getMobileSupabaseConfig();
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("Authentication required.");
  }

  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const rawText = await response.text();
  let payload: FunctionErrorPayload | TResponse | null = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as FunctionErrorPayload | TResponse;
    } catch {
      if (!response.ok) {
        throw new Error(rawText.trim() || `${name} failed with status ${response.status}.`);
      }

      throw new Error(`${name} returned an invalid JSON payload.`);
    }
  }

  if (!response.ok) {
    throw buildFunctionError(
      name,
      response.status,
      (payload as FunctionErrorPayload | null) ?? null,
      rawText || `${name} failed with status ${response.status}.`
    );
  }

  return (payload as TResponse) ?? ({} as TResponse);
}
