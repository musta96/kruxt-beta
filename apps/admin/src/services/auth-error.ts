export function authenticationErrorMessage(error: unknown): string {
  const value = error && typeof error === "object" ? error as { message?: unknown; code?: unknown } : {};
  const message = typeof value.message === "string" ? value.message.toLowerCase() : "";
  const code = typeof value.code === "string" ? value.code : "";
  if (/failed to fetch|fetch failed|network request failed|networkerror|load failed/.test(message)) {
    return "Cannot reach the sign-in service. Check your connection and try again. If it continues, contact support.";
  }
  if (code === "invalid_credentials" || message === "invalid login credentials") {
    return "Email or password is incorrect.";
  }
  if (code === "email_not_confirmed" || message === "email not confirmed") {
    return "Confirm your email before signing in.";
  }
  if (["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"].includes(code)) {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  if (code === "weak_password") return "Choose a stronger password and try again.";
  return "Authentication could not be completed. Try again or contact support.";
}
