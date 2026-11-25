export function authenticationErrorMessage(error: unknown, intent: "authentication" | "recovery" = "authentication"): string {
  const value = error && typeof error === "object" ? error as { message?: unknown; code?: unknown; status?: unknown } : {};
  const message = typeof value.message === "string" ? value.message.toLowerCase() : "";
  const code = typeof value.code === "string" ? value.code : "";
  if (intent !== "recovery" && code === "invalid_credentials") {
    return "Email or password is incorrect.";
  }
  if (intent !== "recovery" && code === "email_not_confirmed") {
    return "Confirm your email before signing in.";
  }
  if (["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"].includes(code)) {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  if (intent !== "recovery" && code === "weak_password") return "Choose a stronger password and try again.";
  if (["captcha_failed", "captcha_required", "captcha_expired"].includes(code)) {
    return "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
  }
  if (value.status === 429) return "Too many attempts. Wait a few minutes, then try again.";

  // Older callers may retain only the message. Never display provider text.
  if (!code) {
    if (/^captcha(?: verification)?(?: process)? (?:is )?(?:required|failed|expired)(?:[.:].*)?$/.test(message)
      || message === "captcha token has expired") {
      return "Security verification could not be completed. Refresh the page and try again. If it continues, contact support.";
    }
    if (/^(?:(?:email|sms|request) rate limit (?:exceeded|reached)|too many requests)[.!]?$/.test(message)) {
      return "Too many attempts. Wait a few minutes, then try again.";
    }
    if (/failed to fetch|fetch failed|network request failed|networkerror|load failed/.test(message)) {
      return "Cannot reach the sign-in service. Check your connection and try again. If it continues, contact support.";
    }
    if (intent !== "recovery" && message === "invalid login credentials") return "Email or password is incorrect.";
    if (intent !== "recovery" && message === "email not confirmed") return "Confirm your email before signing in.";
  }
  return "Authentication could not be completed. Try again or contact support.";
}
