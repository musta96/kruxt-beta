import type { WorkoutType } from "@kruxt/types";

import type { WorkoutBlockType } from "@/lib/public/workout-log";

export interface ParsedWorkoutPlanExercise {
  query: string;
  stationLabel: string;
  notes: string;
  blockType: WorkoutBlockType;
  reps?: string;
  weightKg?: string;
  distanceM?: string;
  durationSeconds?: string;
}

export interface ParsedWorkoutPlanDay {
  id: string;
  label: string;
  notes: string;
  exercises: ParsedWorkoutPlanExercise[];
}

export interface ParsedWorkoutPlan {
  name: string;
  description: string;
  workoutType: WorkoutType;
  days: ParsedWorkoutPlanDay[];
}

type JsonPlan =
  | Array<unknown>
  | {
      name?: unknown;
      description?: unknown;
      workoutType?: unknown;
      days?: unknown;
    };

const DAY_HEADER_PATTERNS = [
  /^#+\s+/,
  /^day\s+\d+/i,
  /^(mon|tue|wed|thu|fri|sat|sun)(day)?\b/i,
  /^(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/i
];

const BLOCK_TYPE_PATTERNS: Array<{ type: WorkoutBlockType; pattern: RegExp }> = [
  { type: "superset", pattern: /\bsuperset\b/i },
  { type: "circuit", pattern: /\bcircuit\b/i },
  { type: "emom", pattern: /\bemom\b/i },
  { type: "amrap", pattern: /\bamrap\b/i }
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function createDayId(label: string, index: number): string {
  const slug = slugify(label);
  return slug ? `${slug}-${index + 1}` : `day-${index + 1}`;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function inferWorkoutType(value: string): WorkoutType {
  const normalized = value.toLowerCase();
  if (normalized.includes("hyrox")) return "hyrox";
  if (normalized.includes("crossfit")) return "crossfit";
  if (normalized.includes("conditioning") || normalized.includes("cardio")) return "conditioning";
  if (normalized.includes("functional")) return "functional";
  return "strength";
}

function parseDurationSeconds(token: string): string | undefined {
  const minuteMatch = token.match(/(\d+(?:[.,]\d+)?)\s*(min|mins|minute|minutes)\b/i);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1].replace(",", "."));
    return Number.isFinite(minutes) ? String(Math.round(minutes * 60)) : undefined;
  }

  const secondMatch = token.match(/(\d+(?:[.,]\d+)?)\s*(sec|secs|second|seconds|s)\b/i);
  if (secondMatch) {
    const seconds = Number(secondMatch[1].replace(",", "."));
    return Number.isFinite(seconds) ? String(Math.round(seconds)) : undefined;
  }

  return undefined;
}

function parseDistanceMeters(token: string): string | undefined {
  const kilometerMatch = token.match(/(\d+(?:[.,]\d+)?)\s*(km|kilometer|kilometers)\b/i);
  if (kilometerMatch) {
    const kilometers = Number(kilometerMatch[1].replace(",", "."));
    return Number.isFinite(kilometers) ? String(Math.round(kilometers * 1000)) : undefined;
  }

  const meterMatch = token.match(/(\d+(?:[.,]\d+)?)\s*(m|meter|meters|metri)\b/i);
  if (meterMatch) {
    const meters = Number(meterMatch[1].replace(",", "."));
    return Number.isFinite(meters) ? String(Math.round(meters)) : undefined;
  }

  return undefined;
}

function parseExerciseToken(rawLine: string): ParsedWorkoutPlanExercise | null {
  const cleaned = rawLine
    .replace(/^\s*[-*]\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const [querySegment, ...metadataSegments] = cleaned
    .split(/[|;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!querySegment) {
    return null;
  }

  const notes: string[] = [];
  let blockType: WorkoutBlockType = "straight_set";
  let reps = toOptionalString(querySegment.match(/(\d+)\s*reps?\b/i)?.[1]);
  let weightKg = toOptionalString(querySegment.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)?.[1]);
  let distanceM = parseDistanceMeters(querySegment);
  let durationSeconds = parseDurationSeconds(querySegment);

  for (const segment of metadataSegments) {
    const repsMatch = segment.match(/(\d+)\s*reps?\b/i);
    if (repsMatch) {
      reps = repsMatch[1];
      continue;
    }

    const weightMatch = segment.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    if (weightMatch) {
      weightKg = weightMatch[1].replace(",", ".");
      continue;
    }

    const parsedDistance = parseDistanceMeters(segment);
    if (parsedDistance) {
      distanceM = parsedDistance;
      continue;
    }

    const parsedDuration = parseDurationSeconds(segment);
    if (parsedDuration) {
      durationSeconds = parsedDuration;
      continue;
    }

    const blockMatch = BLOCK_TYPE_PATTERNS.find((item) => item.pattern.test(segment));
    if (blockMatch) {
      blockType = blockMatch.type;
      continue;
    }

    notes.push(segment);
  }

  return {
    query: querySegment,
    stationLabel: querySegment,
    notes: notes.join(" | "),
    blockType,
    reps,
    weightKg,
    distanceM,
    durationSeconds
  };
}

function normalizeJsonExercise(rawExercise: unknown): ParsedWorkoutPlanExercise | null {
  if (typeof rawExercise === "string") {
    return parseExerciseToken(rawExercise);
  }

  if (!rawExercise || typeof rawExercise !== "object") {
    return null;
  }

  const record = rawExercise as Record<string, unknown>;
  const query =
    toOptionalString(record.query) ??
    toOptionalString(record.exercise) ??
    toOptionalString(record.name) ??
    toOptionalString(record.label);

  if (!query) {
    return null;
  }

  const blockType =
    BLOCK_TYPE_PATTERNS.find((item) => item.pattern.test(toOptionalString(record.blockType) ?? ""))?.type ??
    "straight_set";

  return {
    query,
    stationLabel: toOptionalString(record.stationLabel) ?? toOptionalString(record.label) ?? query,
    notes: toOptionalString(record.notes) ?? "",
    blockType,
    reps: toOptionalString(record.reps),
    weightKg: toOptionalString(record.weightKg),
    distanceM: toOptionalString(record.distanceM),
    durationSeconds: toOptionalString(record.durationSeconds)
  };
}

function parseJsonPlan(filename: string, input: JsonPlan): ParsedWorkoutPlan {
  const record = Array.isArray(input) ? { days: input } : input;
  const rawDays = Array.isArray(record.days) ? record.days : [];

  const days = rawDays
    .map((rawDay, index) => {
      if (!rawDay) return null;

      if (typeof rawDay === "string") {
        return {
          id: createDayId(`Day ${index + 1}`, index),
          label: `Day ${index + 1}`,
          notes: "",
          exercises: [parseExerciseToken(rawDay)].filter(
            (exercise): exercise is ParsedWorkoutPlanExercise => Boolean(exercise)
          )
        } satisfies ParsedWorkoutPlanDay;
      }

      if (typeof rawDay !== "object") {
        return null;
      }

      const dayRecord = rawDay as Record<string, unknown>;
      const exercises = (Array.isArray(dayRecord.exercises) ? dayRecord.exercises : [])
        .map((exercise) => normalizeJsonExercise(exercise))
        .filter((exercise): exercise is ParsedWorkoutPlanExercise => Boolean(exercise));

      if (exercises.length === 0) {
        return null;
      }

      const label = toOptionalString(dayRecord.label) ?? `Day ${index + 1}`;
      return {
        id: createDayId(label, index),
        label,
        notes: toOptionalString(dayRecord.notes) ?? "",
        exercises
      } satisfies ParsedWorkoutPlanDay;
    })
    .filter((day): day is ParsedWorkoutPlanDay => Boolean(day));

  if (days.length === 0) {
    throw new Error("No workout days were found in the uploaded plan.");
  }

  const inferredName = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  const inferredWorkoutType = inferWorkoutType(JSON.stringify(input));

  return {
    name: toOptionalString(record.name) ?? inferredName ?? "Imported workout plan",
    description: toOptionalString(record.description) ?? "",
    workoutType: (toOptionalString(record.workoutType) as WorkoutType | undefined) ?? inferredWorkoutType,
    days
  };
}

function parseTextPlan(filename: string, content: string): ParsedWorkoutPlan {
  const lines = content.split(/\r?\n/);
  const days: ParsedWorkoutPlanDay[] = [];
  let currentDay: ParsedWorkoutPlanDay = {
    id: createDayId("Day 1", 0),
    label: "Day 1",
    notes: "",
    exercises: []
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const isDayHeader = DAY_HEADER_PATTERNS.some((pattern) => pattern.test(trimmed));
    if (isDayHeader) {
      if (currentDay.exercises.length > 0 || currentDay.notes) {
        days.push(currentDay);
      }

      const label = trimmed.replace(/^#+\s*/, "");
      currentDay = {
        id: createDayId(label, days.length),
        label,
        notes: "",
        exercises: []
      };
      continue;
    }

    if (/^(notes?|comment|focus)\s*:/i.test(trimmed)) {
      currentDay.notes = currentDay.notes
        ? `${currentDay.notes}\n${trimmed.replace(/^[^:]+:\s*/, "")}`
        : trimmed.replace(/^[^:]+:\s*/, "");
      continue;
    }

    const exercise = parseExerciseToken(trimmed);
    if (exercise) {
      currentDay.exercises.push(exercise);
    }
  }

  if (currentDay.exercises.length > 0 || currentDay.notes) {
    days.push(currentDay);
  }

  if (days.length === 0) {
    throw new Error("No exercise lines were found in the uploaded workout plan.");
  }

  const inferredName = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();

  return {
    name: inferredName || "Imported workout plan",
    description: "",
    workoutType: inferWorkoutType(content),
    days
  };
}

export function parseWorkoutPlanFile(filename: string, content: string): ParsedWorkoutPlan {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("The uploaded workout plan is empty.");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return parseJsonPlan(filename, JSON.parse(trimmed) as JsonPlan);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("The workout plan file looks like JSON but could not be parsed.");
      }

      throw error;
    }
  }

  return parseTextPlan(filename, content);
}
