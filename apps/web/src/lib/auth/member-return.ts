const MEMBER_ROUTES = new Set([
  "/plan", "/feed", "/log", "/gyms", "/profile", "/privacy", "/support",
  "/integrations", "/library", "/guild", "/rank"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNSAFE_TEXT = /[\\\u0000-\u0020\u007f-\u009f]/;
const DAY_ID = /^[A-Za-z0-9_-]{1,200}$/;

/** Only member navigation references belong in sign-in URLs, never workout data. */
export function normalizeMemberReturn(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || UNSAFE_TEXT.test(value) || value.includes("#")) {
    return null;
  }

  const queryStart = value.indexOf("?");
  const path = queryStart < 0 ? value : value.slice(0, queryStart);
  // Match the raw path before URL parsing can normalize encoded or dot segments.
  const canonicalPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const gymRoute = /^\/gyms\/([^/]+)\/classes$/.exec(canonicalPath);
  let destination = canonicalPath;
  if (!MEMBER_ROUTES.has(canonicalPath)) {
    if (!gymRoute || !UUID.test(gymRoute[1])) return null;
    destination = `/gyms/${gymRoute[1].toLowerCase()}/classes`;
  }

  const query = queryStart < 0 ? "" : value.slice(queryStart + 1);
  // URLSearchParams is deliberately forgiving; validate escapes and UTF-8 first.
  try {
    if (UNSAFE_TEXT.test(decodeURIComponent(query))) return null;
  } catch {
    return null;
  }
  if (destination !== "/log") return destination;

  const params = new URLSearchParams(query);
  const canonical = new URLSearchParams();
  const templateIds = params.getAll("templateId");
  const planIds = params.getAll("planId");
  const dayIds = params.getAll("dayId");
  if (templateIds.length > 1 || planIds.length > 1 || dayIds.length > 1 || (templateIds.length && planIds.length)) {
    return null;
  }
  for (const key of ["templateId", "planId"] as const) {
    const id = params.get(key);
    if (id !== null) {
      if (!UUID.test(id)) return null;
      canonical.set(key, id.toLowerCase());
    }
  }
  const dayId = params.get("dayId");
  if (dayId !== null) {
    if (!DAY_ID.test(dayId)) return null;
    canonical.set("dayId", dayId);
  }
  const search = canonical.toString();
  return search ? `${destination}?${search}` : destination;
}

export function memberSignInPath(value: unknown): string {
  const destination = normalizeMemberReturn(value);
  return destination === null
    ? "/#member-login"
    : `/?returnTo=${encodeURIComponent(destination)}#member-login`;
}
