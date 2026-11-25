import { normalizeMemberReturn } from "./member-return";

const KEY = "kruxt:pending-member-return:v1";
const MAX_AGE_MS = 15 * 60 * 1000;
type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Only canonical route/identifier references survive the external sign-in trip.
export function savePendingMemberReturn(storage: TabStorage, value: unknown, now = Date.now()): void {
  try {
    storage.removeItem(KEY);
    const path = normalizeMemberReturn(value);
    if (path && Number.isFinite(now)) storage.setItem(KEY, JSON.stringify({ path, createdAt: now }));
  } catch { /* Navigation can fall back safely when tab storage is unavailable. */ }
}

export function takePendingMemberReturn(storage: TabStorage, now = Date.now()): string | null {
  try {
    const raw = storage.getItem(KEY);
    storage.removeItem(KEY);
    if (!raw || raw.length > 4096 || !Number.isFinite(now)) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("createdAt" in value) || !("path" in value) ||
      typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) ||
      now < value.createdAt || now - value.createdAt > MAX_AGE_MS) return null;
    return normalizeMemberReturn(value.path);
  } catch { return null; }
}
