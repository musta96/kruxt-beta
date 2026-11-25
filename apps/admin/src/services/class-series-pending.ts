import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassSeriesDraft } from "./class-series";
import type { ClassAnnouncementInput } from "./class-series-publishing";

export const PENDING_TTL = 24 * 60 * 60 * 1000;
export const PENDING_NOTICE = "The complete request, including private descriptions or announcement text, will be stored unencrypted in this tab's session storage until confirmed or explicitly discarded. Content expires after 24 hours and is removed by periodic cleanup while the app is active, or when the app resumes. An identifier-only recovery record remains after expiry. Browsers may restore tab storage after closing a tab; closing it does not guarantee erasure. Continue?";
type Kind = "publication" | "announcement";
export type PublicationPayload = { draft: ClassSeriesDraft; capacity: number; description: string };
export type PendingRequest = {
  version: 1; kind: Kind; viewerId: string; gymId: string; requestId: string; createdAt: number;
  payload: PublicationPayload | ClassAnnouncementInput | null;
};
export type PendingScope = { viewerId: string; gymId: string; kind: Kind };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type CleanupStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem">;
type Context = { client: SupabaseClient; scope: PendingScope; current: () => boolean; storage?: StorageLike; now?: () => number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 100000;
const KEY_PREFIX = "kruxt:class-series-pending:v1:";
const byteLength = (value: string) => new TextEncoder().encode(value).length;
function fail(): never { throw new Error("Pending recovery is blocked. Verify the request with an operator before explicitly discarding its recovery record."); }
function key(scope: PendingScope) {
  if (!UUID.test(scope.viewerId) || !UUID.test(scope.gymId) || !["publication", "announcement"].includes(scope.kind)) fail();
  return `kruxt:class-series-pending:v1:${scope.viewerId}:${scope.gymId}:${scope.kind}`;
}
async function verify(ctx: Context) {
  key(ctx.scope);
  if (!ctx.current()) fail();
  const { data, error } = await ctx.client.auth.getUser();
  if (!ctx.current() || error || data.user?.id !== ctx.scope.viewerId) throw new Error("Your account changed. Pending recovery remains blocked; return to the original account.");
}
function storage(ctx: Context): StorageLike { return ctx.storage ?? window.sessionStorage; }
function tombstone(entry: PendingRequest): PendingRequest {
  return { version: 1, kind: entry.kind, viewerId: entry.viewerId, gymId: entry.gymId, requestId: entry.requestId, createdAt: entry.createdAt, payload: null };
}

// Redaction only: no auth, payload return, deletion, or dispatch across account scopes.
export function redactExpiredPending(getStorage: () => CleanupStorage = () => window.sessionStorage, now = Date.now()): void {
  try {
    if (!Number.isSafeInteger(now) || now < 0) return;
    const target = getStorage();
    const keys = Array.from({ length: target.length }, (_, index) => target.key(index));
    for (const name of keys) {
      if (!name?.startsWith(KEY_PREFIX)) continue;
      try {
        const parts = name.slice(KEY_PREFIX.length).split(":");
        if (parts.length !== 3) continue;
        const [viewerId, gymId, kind] = parts;
        if (!UUID.test(viewerId) || !UUID.test(gymId) || !["publication", "announcement"].includes(kind)) continue;
        const raw = target.getItem(name);
        if (raw === null || raw.length > MAX_BYTES || byteLength(raw) > MAX_BYTES) continue;
        const entry: PendingRequest = JSON.parse(raw);
        if (!entry || entry.version !== 1 || entry.viewerId !== viewerId || entry.gymId !== gymId || entry.kind !== kind ||
          !UUID.test(entry.requestId) || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0 ||
          now - entry.createdAt < PENDING_TTL || entry.payload === null) continue;
        if (target.getItem(name) === raw) target.setItem(name, JSON.stringify(tombstone(entry)));
      } catch { /* Keep unreadable records blocked; continue redacting other scopes. */ }
    }
  } catch { /* Storage can be unavailable; retry on the next lifecycle event. */ }
}

export function startPendingCleanup(options: {
  window: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">;
  document: Pick<Document, "addEventListener" | "removeEventListener">;
  storage?: () => CleanupStorage;
  now?: () => number;
}): () => void {
  let active = true;
  const cleanup = () => { if (active) redactExpiredPending(options.storage, (options.now ?? Date.now)()); };
  cleanup();
  const timer = options.window.setInterval(cleanup, 60000);
  options.window.addEventListener("pageshow", cleanup);
  options.document.addEventListener("visibilitychange", cleanup);
  return () => {
    active = false;
    options.window.clearInterval(timer);
    options.window.removeEventListener("pageshow", cleanup);
    options.document.removeEventListener("visibilitychange", cleanup);
  };
}
function boundedPayload(entry: PendingRequest) {
  const p = entry.payload;
  if (p === null) return;
  if (!p || typeof p !== "object") fail();
  if (entry.kind === "publication") {
    const { draft: d, capacity, description } = p as PublicationPayload;
    if (!d || d.version !== 1 || d.id !== entry.requestId || typeof d.title !== "string" || !d.title.trim() || d.title.length > 120 ||
      typeof d.timeZone !== "string" || d.timeZone.length > 100 || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000 ||
      typeof description !== "string" || description.length > 2000 || !Array.isArray(d.slots) || d.slots.length < 1 || d.slots.length > 28 ||
      !Array.isArray(d.excludedDates) || d.excludedDates.length > 366 || byteLength(JSON.stringify(d)) > 65536) fail();
    const date = (v: string) => typeof v === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
    if (!date(d.startDate) || !date(d.endDate) || d.endDate < d.startDate || Date.parse(d.endDate) - Date.parse(d.startDate) > 365 * 86400000 ||
      d.excludedDates.some(v => !date(v) || v < d.startDate || v > d.endDate) ||
      d.slots.some(s => !s || typeof s.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(s.id) || !Number.isInteger(s.weekday) || s.weekday < 1 || s.weekday > 7 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.endTime) || s.endTime <= s.startTime)) fail();
  } else {
    const a = p as ClassAnnouncementInput;
    if (a.requestId !== entry.requestId || !UUID.test(a.seriesId) || typeof a.body !== "string" || !a.body.trim() || a.body.length > 2000 ||
      typeof a.cancelOccurrence !== "boolean" || !["series_subscribers", "occurrence_attendees"].includes(a.audience) ||
      (a.audience === "series_subscribers" ? a.classId !== null || a.cancelOccurrence : !UUID.test(a.classId ?? ""))) fail();
  }
}
function read(ctx: Context): PendingRequest | null {
  const raw = storage(ctx).getItem(key(ctx.scope));
  if (raw === null) return null;
  if (raw.length > MAX_BYTES || byteLength(raw) > MAX_BYTES) fail();
  let entry: PendingRequest;
  try { entry = JSON.parse(raw); } catch { return fail(); }
  const now = (ctx.now ?? Date.now)();
  if (!entry || entry.version !== 1 || entry.kind !== ctx.scope.kind || entry.viewerId !== ctx.scope.viewerId || entry.gymId !== ctx.scope.gymId ||
    !UUID.test(entry.requestId) || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0 || entry.createdAt > now + 60000) fail();
  // Expire content before parsing its schema; never expire the uncertainty marker.
  if (entry.payload !== null && now - entry.createdAt >= PENDING_TTL) {
    entry = tombstone(entry);
    storage(ctx).setItem(key(ctx.scope), JSON.stringify(entry));
  }
  boundedPayload(entry);
  return entry;
}
export async function loadPending(ctx: Context) { await verify(ctx); return read(ctx); }
export async function savePending(ctx: Context, payload: PublicationPayload | ClassAnnouncementInput): Promise<PendingRequest> {
  await verify(ctx);
  if (read(ctx)) throw new Error("Resolve the existing pending request before creating another.");
  const requestId = ctx.scope.kind === "publication" ? (payload as PublicationPayload).draft.id : (payload as ClassAnnouncementInput).requestId;
  const entry: PendingRequest = { version: 1, ...ctx.scope, requestId, createdAt: (ctx.now ?? Date.now)(), payload };
  if (!UUID.test(requestId)) fail();
  boundedPayload(entry);
  const raw = JSON.stringify(entry);
  if (byteLength(raw) > MAX_BYTES) fail();
  storage(ctx).setItem(key(ctx.scope), raw);
  if (storage(ctx).getItem(key(ctx.scope)) !== raw) throw new Error("Could not durably save this request. Nothing was dispatched.");
  return JSON.parse(raw) as PendingRequest;
}
export async function clearPending(ctx: Context, expected: PendingRequest) {
  await verify(ctx);
  const entry = read(ctx);
  if (!entry || entry.requestId !== expected.requestId || entry.createdAt !== expected.createdAt) fail();
  storage(ctx).removeItem(key(ctx.scope));
  if (storage(ctx).getItem(key(ctx.scope)) !== null) fail();
}
export async function reconcilePending(ctx: Context, expected: PendingRequest): Promise<boolean> {
  await verify(ctx);
  const entry = read(ctx);
  if (!entry || entry.requestId !== expected.requestId || entry.createdAt !== expected.createdAt) fail();
  const publication = entry.kind === "publication";
  const result = await ctx.client.from(publication ? "gym_class_series" : "gym_class_announcements")
    .select(publication ? "id,gym_id,created_by,publication_receipt" : "id,gym_id,created_by,request_id")
    .eq(publication ? "id" : "request_id", entry.requestId).eq("gym_id", entry.gymId).eq("created_by", entry.viewerId).maybeSingle();
  await verify(ctx);
  if (result.error) throw new Error("Could not verify the pending request. Keep recovery blocked and ask an operator to check its identifier.");
  const row = result.data;
  if (!row || row.gym_id !== entry.gymId || row.created_by !== entry.viewerId ||
    (publication ? row.id !== entry.requestId || !("publication_receipt" in row) || !validReceipt(row.publication_receipt, entry.requestId)
      : !("request_id" in row) || row.request_id !== entry.requestId || !UUID.test(row.id))) return false;
  await clearPending(ctx, entry);
  return true;
}
function validReceipt(value: unknown, seriesId: string): boolean {
  if (!Array.isArray(value) || !value.length || value.length > 1500) return false;
  const ids = new Set<string>(), keys = new Set<string>();
  return value.every(row => {
    if (!row || !UUID.test(row.id) || typeof row.key !== "string" || !row.key.startsWith(`${seriesId}/`) || row.key.length > 200 ||
      typeof row.startsAt !== "string" || typeof row.endsAt !== "string" || !Number.isFinite(Date.parse(row.startsAt)) || !Number.isFinite(Date.parse(row.endsAt)) ||
      Date.parse(row.endsAt) <= Date.parse(row.startsAt) || ids.has(row.id) || keys.has(row.key)) return false;
    ids.add(row.id); keys.add(row.key); return true;
  });
}
