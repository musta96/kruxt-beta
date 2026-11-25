export interface ClassSeriesSlot {
  id: string;
  weekday: number; // ISO weekday: Monday = 1, Sunday = 7.
  startTime: string;
  endTime: string;
}

export interface ClassSeriesDraft {
  version: 1;
  id: string;
  title: string;
  timeZone: string;
  startDate: string;
  endDate: string;
  slots: ClassSeriesSlot[];
  excludedDates: string[];
}

export interface ClassSeriesOccurrence {
  key: string;
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  startsAt: string | null;
  endsAt: string | null;
  status: "planned" | "excluded" | "invalid_time";
  issue?: string;
}

export const CLASS_SERIES_LIMITS = { days: 366, slots: 28, occurrences: 1500, exclusions: 366 } as const;
const DAY = 86400000;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

function fail(message: string): never { throw new Error(message); }

function dateMs(value: string): number {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) fail("Dates must be YYYY-MM-DD between 2000 and 2099.");
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) fail(`Invalid date: ${value}.`);
  return ms;
}

function timeMinutes(value: string): number {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail("Times must use HH:mm (00:00 to 23:59).");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function expandClassBreak(first: string, last: string): string[] {
  const start = dateMs(first), end = dateMs(last);
  if (end < start || (end - start) / DAY >= CLASS_SERIES_LIMITS.exclusions) fail("Choose a break of 1 to 366 days.");
  return Array.from({ length: (end - start) / DAY + 1 }, (_, index) => new Date(start + index * DAY).toISOString().slice(0, 10));
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  if (typeof timeZone !== "string" || timeZone.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(timeZone) && timeZone !== "UTC") {
    fail("Choose an IANA time zone, such as Europe/Rome.");
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone, calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  } catch { return fail("Choose a supported IANA time zone, such as Europe/Rome."); }
}

/** Validate untrusted imported JSON and return only supported, bounded fields. */
export function validateClassSeries(value: unknown): ClassSeriesDraft {
  if (!value || typeof value !== "object") fail("A series draft is required.");
  const v = value as ClassSeriesDraft;
  if (v.version !== 1 || typeof v.id !== "string" || !ID.test(v.id)) fail("Unsupported draft version or series ID.");
  if (typeof v.title !== "string" || !v.title.trim() || v.title.length > 120) fail("Class name must contain 1 to 120 characters.");
  formatter(v.timeZone);
  const start = dateMs(v.startDate);
  const end = dateMs(v.endDate);
  if (end < start || (end - start) / DAY >= CLASS_SERIES_LIMITS.days) fail("Choose an inclusive date range of 1 to 366 days.");
  if (!Array.isArray(v.slots) || !v.slots.length || v.slots.length > CLASS_SERIES_LIMITS.slots) fail("Add 1 to 28 weekly slots.");
  const ids = new Set<string>();
  const slots = v.slots.map((slot) => {
    if (!slot || typeof slot.id !== "string" || !ID.test(slot.id) || ids.has(slot.id)) fail("Weekly slots need unique stable IDs.");
    ids.add(slot.id);
    if (!Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7) fail("Choose a weekday for every slot.");
    if (timeMinutes(slot.endTime) <= timeMinutes(slot.startTime)) fail("Each slot must end after it starts on the same day.");
    return { id: slot.id, weekday: slot.weekday, startTime: slot.startTime, endTime: slot.endTime };
  });
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      if (a.weekday === b.weekday && a.startTime < b.endTime && b.startTime < a.endTime) fail("Weekly slots must not overlap on the same weekday.");
    }
  }
  if (!Array.isArray(v.excludedDates) || v.excludedDates.length > CLASS_SERIES_LIMITS.exclusions) fail("Use at most 366 holiday exclusions.");
  const excludedDates = [...new Set(v.excludedDates.map((date) => {
    const ms = dateMs(date);
    if (ms < start || ms > end) fail("Holiday exclusions must be inside the series date range.");
    return date;
  }))].sort();
  return { version: 1, id: v.id, title: v.title.trim(), timeZone: v.timeZone, startDate: v.startDate, endDate: v.endDate, slots, excludedDates };
}

function wallMs(ms: number, fmt: Intl.DateTimeFormat): number {
  const parts = Object.fromEntries(fmt.formatToParts(ms).map((p) => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

function resolveWallTime(date: string, time: string, fmt: Intl.DateTimeFormat, offsets: Set<number>): number {
  const wall = dateMs(date) + timeMinutes(time) * 60000;
  const candidates = [...offsets].map((offset) => wall - offset).filter((ms) => wallMs(ms, fmt) === wall);
  if (candidates.length !== 1) fail(`${date} ${time} is ${candidates.length ? "ambiguous" : "nonexistent"} in this time zone. Exclude this date or change the slot.`);
  return candidates[0];
}

export function previewClassSeries(value: unknown): { draft: ClassSeriesDraft; occurrences: ClassSeriesOccurrence[]; publishable: false } {
  const draft = validateClassSeries(value);
  const fmt = formatter(draft.timeZone);
  const excluded = new Set(draft.excludedDates);
  const occurrences: ClassSeriesOccurrence[] = [];
  for (let ms = dateMs(draft.startDate); ms <= dateMs(draft.endDate); ms += DAY) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const weekday = new Date(ms).getUTCDay() || 7;
    const slots = draft.slots.filter((slot) => slot.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!slots.length) continue;
    // ICU supplies zone rules. Sample both sides of nearby transitions, then
    // round-trip every candidate; never silently normalize DST gaps or folds.
    const offsets = new Set<number>();
    if (!excluded.has(date)) {
      for (let hour = -36; hour <= 60; hour += 6) {
        const sample = ms + hour * 3600000;
        offsets.add(wallMs(sample, fmt) - sample);
      }
    }
    for (const slot of slots) {
      if (occurrences.length >= CLASS_SERIES_LIMITS.occurrences) fail("Series exceeds 1500 occurrences. Shorten the range or remove slots.");
      const row: ClassSeriesOccurrence = {
        key: `${draft.id}/${slot.id}/${date}`, slotId: slot.id, date,
        startTime: slot.startTime, endTime: slot.endTime, startsAt: null, endsAt: null,
        status: excluded.has(date) ? "excluded" : "planned"
      };
      if (row.status !== "excluded") {
        try {
          const start = resolveWallTime(date, slot.startTime, fmt, offsets);
          const end = resolveWallTime(date, slot.endTime, fmt, offsets);
          if (end <= start) fail("Class end must be after class start in this time zone.");
          row.startsAt = new Date(start).toISOString();
          row.endsAt = new Date(end).toISOString();
        } catch (error) {
          row.status = "invalid_time";
          row.issue = error instanceof Error ? error.message : "Unable to resolve local time.";
        }
      }
      occurrences.push(row);
    }
  }
  if (!occurrences.length) fail("No weekly slots fall inside this date range.");
  return { draft, occurrences, publishable: false };
}

export function parseClassSeriesDraft(json: string): ClassSeriesDraft {
  if (json.length > 65536) fail("Draft file must be at most 64 KB.");
  return validateClassSeries(JSON.parse(json));
}

export type ClassCommunicationScope =
  | { kind: "series"; seriesId: string }
  | { kind: "occurrence"; seriesId: string; occurrenceKey: string };

/** Intent only: this function neither queues nor delivers a notification. */
export function prepareClassCommunication(value: unknown, scope: ClassCommunicationScope, message: string) {
  const preview = previewClassSeries(value);
  if (!scope || scope.seriesId !== preview.draft.id || !["series", "occurrence"].includes(scope.kind)) fail("Communication scope does not match this series.");
  if (typeof message !== "string" || !message.trim() || message.length > 2000) fail("Message must contain 1 to 2000 characters.");
  const targets = preview.occurrences.filter((row) => row.status === "planned" && (scope.kind === "series" || row.key === scope.occurrenceKey));
  if (!targets.length) fail("Communication scope has no planned occurrences.");
  return {
    scope: scope.kind === "series" ? { kind: "series" as const, seriesId: scope.seriesId } : { kind: "occurrence" as const, seriesId: scope.seriesId, occurrenceKey: scope.occurrenceKey },
    message: message.trim(), occurrenceKeys: targets.map((row) => row.key),
    status: "draft" as const, queued: false as const, delivered: false as const
  };
}
