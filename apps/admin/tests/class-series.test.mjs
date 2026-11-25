import assert from "node:assert/strict";
import { test } from "node:test";
import { previewClassSeries, validateClassSeries, parseClassSeriesDraft, prepareClassCommunication, expandClassBreak } from "../src/services/class-series.ts";

test("holiday breaks include both endpoints and leap days", () => {
  assert.deepEqual(expandClassBreak("2028-02-28", "2028-03-01"), ["2028-02-28", "2028-02-29", "2028-03-01"]);
  assert.deepEqual(expandClassBreak("2026-12-25", "2026-12-25"), ["2026-12-25"]);
  assert.equal(expandClassBreak("2028-01-01", "2028-12-31").length, 366);
});

test("holiday breaks reject reversed, malformed and oversized ranges", () => {
  for (const [first, last] of [["2026-12-26", "2026-12-25"], ["2026-02-29", "2026-03-01"], ["2028-01-01", "2029-01-01"], ["2026-1-01", "2026-01-02"]]) {
    assert.throws(() => expandClassBreak(first, last));
  }
});

function draft(patch = {}) {
  return {
    version: 1, id: "strength-series", title: "Strength", timeZone: "Europe/Rome",
    startDate: "2026-10-19", endDate: "2026-11-01",
    slots: [
      { id: "tue", weekday: 2, startTime: "18:00", endTime: "19:00" },
      { id: "thu", weekday: 4, startTime: "18:00", endTime: "19:00" },
      { id: "mon", weekday: 1, startTime: "20:00", endTime: "21:00" },
      { id: "wed", weekday: 3, startTime: "20:00", endTime: "21:00" }
    ], excludedDates: [], ...patch
  };
}

test("independent weekly slots retain local times across Rome DST end", () => {
  const result = previewClassSeries(draft());
  assert.equal(result.publishable, false);
  assert.equal(result.occurrences.length, 8);
  assert.equal(result.occurrences[0].startTime, "20:00");
  const tuesdays = result.occurrences.filter((row) => row.slotId === "tue");
  assert.deepEqual(tuesdays.map((row) => row.startsAt), ["2026-10-20T16:00:00.000Z", "2026-10-27T17:00:00.000Z"]);
});

test("Rome spring DST keeps 18:00 wall clock while UTC changes", () => {
  const result = previewClassSeries(draft({ startDate: "2026-03-24", endDate: "2026-03-31" }));
  assert.deepEqual(result.occurrences.filter((row) => row.slotId === "tue").map((row) => row.startsAt), ["2026-03-24T17:00:00.000Z", "2026-03-31T16:00:00.000Z"]);
});

test("keys survive reorder, time edits, range extension, title changes and exclusions", () => {
  const before = previewClassSeries(draft()).occurrences;
  const after = previewClassSeries(draft({ title: "New name", endDate: "2026-11-08", excludedDates: ["2026-10-20"], slots: draft().slots.reverse().map((slot) => ({ ...slot, startTime: slot.id === "tue" ? "17:30" : slot.startTime })) })).occurrences;
  for (const row of before) assert.equal(after.find((next) => next.date === row.date && next.slotId === row.slotId)?.key, row.key);
  const excluded = after.find((row) => row.date === "2026-10-20");
  assert.equal(excluded.status, "excluded");
  assert.equal(excluded.startsAt, null);
});

for (const [name, timeZone, date, time, issue] of [
  ["Rome gap", "Europe/Rome", "2026-03-29", "02:15", "nonexistent"],
  ["Rome fold", "Europe/Rome", "2026-10-25", "02:15", "ambiguous"],
  ["New York gap", "America/New_York", "2026-03-08", "02:15", "nonexistent"],
  ["New York fold", "America/New_York", "2026-11-01", "01:15", "ambiguous"],
  ["Lord Howe half-hour fold", "Australia/Lord_Howe", "2026-04-05", "01:45", "ambiguous"],
  ["Lord Howe half-hour gap", "Australia/Lord_Howe", "2026-10-04", "02:15", "nonexistent"]
]) {
  test(`${name} is rejected without silently shifting local time`, () => {
    const input = draft({ timeZone, startDate: date, endDate: date, slots: [{ id: "sun", weekday: 7, startTime: time, endTime: "04:00" }] });
    const row = previewClassSeries(input).occurrences[0];
    assert.equal(row.status, "invalid_time");
    assert.match(row.issue, new RegExp(issue));
    assert.equal(row.startsAt, null);
    assert.equal(previewClassSeries({ ...input, excludedDates: [date] }).occurrences[0].status, "excluded");
  });
}

test("endpoints and elapsed duration across spring transition are resolved independently", () => {
  const row = previewClassSeries(draft({ startDate: "2026-03-29", endDate: "2026-03-29", slots: [{ id: "sun", weekday: 7, startTime: "01:30", endTime: "03:30" }] })).occurrences[0];
  assert.equal(row.status, "planned");
  assert.equal(Date.parse(row.endsAt) - Date.parse(row.startsAt), 3600000);
});

test("non-hour offsets and midnight use explicit zone, never host local zone", () => {
  for (const [timeZone, expected] of [["Asia/Kathmandu", "2026-10-19T18:15:00.000Z"], ["UTC", "2026-10-20T00:00:00.000Z"]]) {
    const row = previewClassSeries(draft({ timeZone, slots: [{ id: "tue", weekday: 2, startTime: "00:00", endTime: "01:00" }] })).occurrences[0];
    assert.equal(row.startsAt, expected);
  }
});

test("inclusive dates, leap day and adjacent same-day slots are supported", () => {
  const result = previewClassSeries(draft({ startDate: "2028-02-29", endDate: "2028-02-29", slots: [
    { id: "a", weekday: 2, startTime: "18:00", endTime: "19:00" },
    { id: "b", weekday: 2, startTime: "19:00", endTime: "20:00" }
  ] }));
  assert.equal(result.occurrences.length, 2);
});

test("bounds and malformed untrusted drafts fail closed", () => {
  const invalid = [null, {}, draft({ version: 2 }), draft({ id: "bad/key" }), draft({ title: " " }), draft({ timeZone: "Mars/Base" }),
    draft({ timeZone: "+02:00" }), draft({ startDate: "2026-02-30" }), draft({ startDate: "2026-2-01" }),
    draft({ endDate: "2026-10-18" }), draft({ endDate: "2027-10-20" }), draft({ slots: [] }),
    draft({ slots: [null] }), draft({ excludedDates: ["2026-12-25"] }), draft({ excludedDates: "2026-10-20" }),
    draft({ slots: [{ id: "a", weekday: 8, startTime: "18:00", endTime: "19:00" }] }),
    draft({ slots: [{ id: "a", weekday: 2, startTime: "24:00", endTime: "25:00" }] }),
    draft({ slots: [{ id: "a", weekday: 2, startTime: "18:00", endTime: "18:00" }] }),
    draft({ slots: [{ id: "a", weekday: 2, startTime: "23:00", endTime: "01:00" }] }),
    draft({ slots: [draft().slots[0], draft().slots[0]] }),
    draft({ slots: [draft().slots[0], { ...draft().slots[0], id: "overlap" }] }),
    draft({ slots: Array.from({ length: 29 }, (_, i) => ({ id: `slot${i}`, weekday: 1, startTime: "18:00", endTime: "19:00" })) })
  ];
  for (const input of invalid) assert.throws(() => validateClassSeries(input), undefined, JSON.stringify(input));
  assert.throws(() => parseClassSeriesDraft("x".repeat(65537)), /64 KB/);
  assert.throws(() => parseClassSeriesDraft("invalid JSON"));
});

test("366-day range is accepted but occurrence output is capped", () => {
  const input = draft({ startDate: "2028-01-01", endDate: "2028-12-31" });
  assert.equal(validateClassSeries(input).endDate, "2028-12-31");
  const slots = Array.from({ length: 28 }, (_, i) => ({ id: `s${i}`, weekday: Math.floor(i / 4) + 1, startTime: `${String((i % 4) * 2).padStart(2, "0")}:00`, endTime: `${String((i % 4) * 2 + 1).padStart(2, "0")}:00` }));
  assert.ok(previewClassSeries({ ...input, slots }).occurrences.length <= 1500);
});

test("empty ranges and all-excluded previews are explicit", () => {
  assert.throws(() => previewClassSeries(draft({ startDate: "2026-10-24", endDate: "2026-10-24" })), /No weekly slots/);
  const result = previewClassSeries(draft({ startDate: "2026-10-20", endDate: "2026-10-20", excludedDates: ["2026-10-20"] }));
  assert.equal(result.occurrences[0].status, "excluded");
});

test("JSON round trip preserves stable IDs, strips unknown properties and deduplicates holidays", () => {
  const input = draft({ excludedDates: ["2026-10-20", "2026-10-20"], unknown: "discard" });
  const clean = parseClassSeriesDraft(JSON.stringify(input));
  assert.equal(clean.unknown, undefined);
  assert.deepEqual(clean.excludedDates, ["2026-10-20"]);
  assert.deepEqual(previewClassSeries(clean), previewClassSeries(JSON.parse(JSON.stringify(clean))));
});

test("series and occurrence communication are separate draft-only intents", () => {
  const input = draft({ excludedDates: ["2026-10-20"] });
  const rows = previewClassSeries(input).occurrences;
  const series = prepareClassCommunication(input, { kind: "series", seriesId: input.id }, " Updated schedule ");
  assert.equal(series.occurrenceKeys.length, 7);
  assert.equal(series.status, "draft");
  assert.equal(series.queued, false);
  assert.equal(series.delivered, false);
  assert.equal(series.message, "Updated schedule");
  const one = prepareClassCommunication(input, { kind: "occurrence", seriesId: input.id, occurrenceKey: rows[0].key }, "One class update");
  assert.deepEqual(one.occurrenceKeys, [rows[0].key]);
  assert.throws(() => prepareClassCommunication(input, { kind: "occurrence", seriesId: input.id, occurrenceKey: rows[1].key }, "Excluded"), /no planned/);
  assert.throws(() => prepareClassCommunication(input, { kind: "series", seriesId: "other" }, "Wrong gym"), /does not match/);
  assert.throws(() => prepareClassCommunication(input, { kind: "occurrence", seriesId: input.id, occurrenceKey: "missing" }, "Wrong occurrence"), /no planned/);
  assert.throws(() => prepareClassCommunication(input, { kind: "series", seriesId: input.id }, " "), /Message/);
});
