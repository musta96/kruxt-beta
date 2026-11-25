import type { WorkoutType } from "@kruxt/types";
import type { ExerciseSearchResult, WorkoutBlockType } from "./workout-log";

export const WORKOUT_DRAFT_TTL = 12 * 60 * 60 * 1000;
export const WORKOUT_DRAFT_MAX_BYTES = 256 * 1024;
export type WorkoutDraftBlock = {
  clientId: string; searchQuery: string; selectedExercise: ExerciseSearchResult | null;
  stationLabel: string; notes: string; blockType: WorkoutBlockType;
  reps: string; weightKg: string; distanceM: string; durationSeconds: string;
};
export type WorkoutDraft = {
  request: WorkoutDraftRequest;
  title: string; notes: string; workoutType: WorkoutType; gymId: string;
  sessionRpe: string; sessionGuidance: string | null; blocks: WorkoutDraftBlock[];
};
export type WorkoutDraftRequest = { idempotencyKey: string; startedAt: string };
export type StoredWorkoutDraft = {
  version: 1; owner: string; savedAt: number; saveState: "editing" | "unconfirmed"; data: WorkoutDraft;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const string = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const oneOf = (value: unknown, options: string[]) => typeof value === "string" && options.includes(value);

function validData(value: unknown): value is WorkoutDraft {
  if (!record(value) || !validRequest(value.request) || !string(value.title, 500) || !string(value.notes, 10000) ||
      !oneOf(value.workoutType, ["strength", "functional", "hyrox", "crossfit", "conditioning", "custom"]) ||
      !string(value.gymId, 36) || (value.gymId !== "" && !uuid.test(value.gymId)) ||
      !string(value.sessionRpe, 32) || !(value.sessionGuidance === null || string(value.sessionGuidance, 20000)) ||
      !Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > 100) return false;
  const ids = new Set();
  return value.blocks.every((block: unknown) => {
    if (!record(block) || !string(block.clientId, 100) || !block.clientId || ids.has(block.clientId)) return false;
    ids.add(block.clientId);
    if (!["searchQuery", "stationLabel"].every((key) => string(block[key], 500)) || !string(block.notes, 5000) ||
        !["reps", "weightKg", "distanceM", "durationSeconds"].every((key) => string(block[key], 64)) ||
        !oneOf(block.blockType, ["straight_set", "superset", "circuit", "emom", "amrap"])) return false;
    const exercise = block.selectedExercise;
    return exercise === null || (record(exercise) && typeof exercise.id === "string" && uuid.test(exercise.id) &&
      ["name", "slug", "category"].every((key) => string(exercise[key], 500)) &&
      ["equipment", "movementPattern"].every((key) => exercise[key] === null || string(exercise[key], 500)));
  });
}

function key(owner: string) {
  if (!uuid.test(owner)) throw new Error("A verified viewer is required.");
  return `kruxt:workout-draft:v1:${owner}`;
}

// Whitelist content: never serialize files, audience choices, auth, or template metadata.
function content(data: WorkoutDraft): WorkoutDraft {
  return {
    request: { idempotencyKey: data.request.idempotencyKey, startedAt: data.request.startedAt },
    title: data.title, notes: data.notes, workoutType: data.workoutType, gymId: data.gymId,
    sessionRpe: data.sessionRpe, sessionGuidance: data.sessionGuidance,
    blocks: data.blocks.map((block) => ({
      clientId: block.clientId, searchQuery: block.searchQuery, stationLabel: block.stationLabel,
      notes: block.notes, blockType: block.blockType, reps: block.reps, weightKg: block.weightKg,
      distanceM: block.distanceM, durationSeconds: block.durationSeconds,
      selectedExercise: block.selectedExercise && {
        id: block.selectedExercise.id, name: block.selectedExercise.name, slug: block.selectedExercise.slug,
        category: block.selectedExercise.category, equipment: block.selectedExercise.equipment,
        movementPattern: block.selectedExercise.movementPattern
      }
    }))
  };
}

export function readWorkoutDraft(storage: Storage, owner: string, now = Date.now()): StoredWorkoutDraft | null {
  const storageKey = key(owner);
  const raw = storage.getItem(storageKey);
  if (raw === null) return null;
  try {
    if (raw.length > WORKOUT_DRAFT_MAX_BYTES || new TextEncoder().encode(raw).length > WORKOUT_DRAFT_MAX_BYTES) throw new Error();
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || value.owner !== owner ||
        typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) || value.savedAt > now ||
        now - value.savedAt >= WORKOUT_DRAFT_TTL || !oneOf(value.saveState, ["editing", "unconfirmed"]) ||
        !validData(value.data)) throw new Error();
    return { version: 1, owner, savedAt: value.savedAt, saveState: value.saveState as StoredWorkoutDraft["saveState"], data: content(value.data) };
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

export function writeWorkoutDraft(storage: Storage, owner: string, data: WorkoutDraft,
  saveState: StoredWorkoutDraft["saveState"] = "editing", now = Date.now()): void {
  const storageKey = key(owner);
  if (!validData(data) || !Number.isFinite(now) || !oneOf(saveState, ["editing", "unconfirmed"])) throw new Error("Draft exceeds recovery limits.");
  const raw = JSON.stringify({ version: 1, owner, savedAt: now, saveState, data: content(data) });
  if (new TextEncoder().encode(raw).length > WORKOUT_DRAFT_MAX_BYTES) throw new Error("Draft exceeds recovery limits.");
  storage.setItem(storageKey, raw);
}

export function discardWorkoutDraft(storage: Storage, owner: string): void {
  storage.removeItem(key(owner));
}

function validRequest(value: unknown): value is WorkoutDraftRequest {
  return record(value) && typeof value.idempotencyKey === "string" && uuid.test(value.idempotencyKey) &&
    typeof value.startedAt === "string" && value.startedAt.length === 24 &&
    Number.isFinite(Date.parse(value.startedAt)) && new Date(value.startedAt).toISOString() === value.startedAt;
}

// This receipt has no workout content and survives opting out of content recovery.
export function writeWorkoutDraftRequest(storage: Storage, owner: string, request: WorkoutDraftRequest) {
  if (!validRequest(request)) throw new Error("Invalid submission identity.");
  storage.setItem(`${key(owner)}:request`, JSON.stringify({ version: 1, owner,
    idempotencyKey: request.idempotencyKey, startedAt: request.startedAt }));
}

export function readWorkoutDraftRequest(storage: Storage, owner: string): WorkoutDraftRequest | null {
  const raw = storage.getItem(`${key(owner)}:request`);
  if (!raw) return null;
  try {
    if (raw.length > 512) return null;
    const value: unknown = JSON.parse(raw);
    return record(value) && value.version === 1 && value.owner === owner && validRequest(value)
      ? { idempotencyKey: value.idempotencyKey, startedAt: value.startedAt } : null;
  } catch { return null; }
}

export function clearWorkoutDraftRequest(storage: Storage, owner: string) {
  storage.removeItem(`${key(owner)}:request`);
}
