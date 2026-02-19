export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function usernameFromEmail(email: string): string {
  const base = email.split("@")[0] ?? "athlete";
  const normalized = base.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return (normalized || "athlete").slice(0, 24);
}

export function displayNameFromEmail(email: string): string {
  const left = email.split("@")[0] ?? "Athlete";
  return left
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 48);
}
