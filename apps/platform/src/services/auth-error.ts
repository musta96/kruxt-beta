type AuthIntent = "signin" | "recovery";

export function platformAuthErrorMessage(error: unknown, intent: AuthIntent = "signin"): string {
  const value = error && typeof error === "object" ? error as { code?: unknown; message?: unknown; status?: unknown } : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message.toLowerCase() : "";
  if (["captcha_failed", "captcha_required", "captcha_expired"].includes(code)) {
    return "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
  }
  if (["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"].includes(code) || value.status === 429) {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  if (intent === "signin" && (code === "invalid_credentials" || !code && message === "invalid login credentials")) {
    return "Email or password isn't correct. Check your details and try again.";
  }
  if (intent === "signin" && (code === "email_not_confirmed" || !code && message === "email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (!code && (/^captcha(?: verification)?(?: process)? (?:is )?(?:required|failed|expired)(?:[.:].*)?$/.test(message)
      || message === "captcha token has expired")) {
    return "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
  }
  if (!code && /^(?:(?:email|sms|request) rate limit (?:exceeded|reached)|too many requests)[.!]?$/.test(message)) {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  if (!code && /failed to fetch|fetch failed|network request failed|networkerror|load failed/.test(message)) {
    return "Cannot reach the authentication service. Check your connection and try again.";
  }
  return intent === "recovery"
    ? "We couldn't request a reset link. Check your connection and try again in a few minutes."
    : "We couldn't sign you in. Check your connection and account confirmation, then try again.";
}
