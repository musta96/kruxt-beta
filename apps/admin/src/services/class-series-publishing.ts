import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassSeriesDraft, ClassSeriesOccurrence } from "./class-series";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validZone(value: unknown): boolean {
  if (typeof value !== "string" || value.length>100) return false;
  try { new Intl.DateTimeFormat("en",{timeZone:value}); return true; } catch { return false; }
}
export class ClassSeriesUnconfirmedError extends Error {}
export interface PublishedClassSeries { id: string; title: string; time_zone: string; capacity: number }
export interface PublishedOccurrence { id: string; series_id: string; title: string; starts_at: string; ends_at: string; status: string }
export interface SeriesPublication { seriesId: string; count: number; replayed: boolean }
export interface ClassAnnouncementInput {
  seriesId: string; audience: "series_subscribers" | "occurrence_attendees";
  body: string; requestId: string; classId: string | null; cancelOccurrence: boolean;
}
async function viewer(client: SupabaseClient, expected: string) {
  const { data, error } = await client.auth.getUser();
  if (!UUID.test(expected) || error || data.user?.id !== expected) throw new Error("Your account changed. Reload before continuing.");
}
function rejected(error: { code?: string } | null, action: string): never {
  if (["42501", "22023", "22007", "22008", "23514", "40001", "P0001"].includes(error?.code ?? "")) {
    throw new Error(`${action} was rejected. Check staff access, dates and the unchanged request, then reload.`);
  }
  if (["PGRST202", "42883"].includes(error?.code ?? "")) throw new Error("Recurring classes are not available in this environment yet.");
  throw new ClassSeriesUnconfirmedError(`${action} could not be confirmed. Retry the same unchanged request; do not create another copy.`);
}
export async function publishClassSeries(client: SupabaseClient, input: {
  viewerId: string; gymId: string; draft: ClassSeriesDraft; occurrences: ClassSeriesOccurrence[];
  capacity: number; description: string;
}): Promise<SeriesPublication> {
  if (!UUID.test(input.gymId) || !UUID.test(input.draft.id) || !Number.isInteger(input.capacity) ||
    input.capacity < 1 || input.capacity > 10000 || input.description.length > 2000 ||
    !Array.isArray(input.occurrences) || input.occurrences.some(row => !row || !["planned","excluded"].includes(row.status))) throw new Error("Review the series, capacity and dates before publishing.");
  const expected = input.occurrences.filter(row => row.status === "planned");
  if (!expected.length || expected.length > 1500) throw new Error("Choose 1 to 1,500 future occurrences.");
  if (new Set(expected.map(row=>row.key)).size!==expected.length || expected.some(row=>
    typeof row.key!=="string" || !row.key || row.key.length>200 || typeof row.startsAt!=="string" || typeof row.endsAt!=="string" ||
    !Number.isFinite(Date.parse(row.startsAt)) || !Number.isFinite(Date.parse(row.endsAt)) || Date.parse(row.endsAt)<=Date.parse(row.startsAt))) {
    throw new Error("Review occurrence identities and start/end times before publishing.");
  }
  await viewer(client, input.viewerId);
  let response;
  try {
    response = await client.rpc("publish_gym_class_series", { p_gym_id: input.gymId, p_draft: input.draft,
      p_capacity: input.capacity, p_description: input.description, p_coach_user_id: null });
  } catch { throw new ClassSeriesUnconfirmedError("Publication could not be confirmed. Retry the same unchanged request."); }
  if (response.error) rejected(response.error, "Publication");
  const data = response.data;
  if (data?.seriesId !== input.draft.id || typeof data.replayed !== "boolean" || !Array.isArray(data.occurrences) ||
    data.occurrences.length !== expected.length || data.occurrences.some((row: {id:string}|null)=>!row || !UUID.test(row.id)) ||
    new Set(data.occurrences.map((row: { id: string }) => row.id)).size !== expected.length ||
    expected.some(row => !data.occurrences.some((saved: { id: string; key: string; startsAt: string; endsAt: string }) =>
      UUID.test(saved.id) && saved.key === row.key && Date.parse(saved.startsAt) === Date.parse(row.startsAt ?? "") && Date.parse(saved.endsAt) === Date.parse(row.endsAt ?? "")))) {
    throw new ClassSeriesUnconfirmedError("The publication response could not be verified. Retry the same unchanged request.");
  }
  try {
    const readback = await client.from("gym_class_series").select("id,gym_id,title").eq("id", input.draft.id).eq("gym_id", input.gymId).maybeSingle();
    await viewer(client, input.viewerId);
    if (readback.error || readback.data?.id !== input.draft.id || readback.data?.gym_id !== input.gymId) throw new Error();
  } catch { throw new ClassSeriesUnconfirmedError("The series may be published, but readback failed. Retry the same unchanged request."); }
  return { seriesId: input.draft.id, count: expected.length, replayed: data.replayed };
}
export async function loadPublishedClassSeries(client: SupabaseClient, viewerId: string, gymId: string) {
  await viewer(client, viewerId);
  if (!UUID.test(gymId)) throw new Error("Choose a gym.");
  const [series, occurrences] = await Promise.all([
    client.from("gym_class_series").select("id,title,time_zone,capacity").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(200),
    client.from("gym_classes").select("id,series_id,title,starts_at,ends_at,status").eq("gym_id", gymId)
      .not("series_id", "is", null).gte("ends_at", new Date().toISOString()).order("starts_at").limit(500)
  ]);
  await viewer(client, viewerId);
  if (series.error || occurrences.error || !Array.isArray(series.data) || !Array.isArray(occurrences.data)) throw new Error("Published series could not be loaded. Retry.");
  if (series.data.some(row=>!row || !UUID.test(row.id) || typeof row.title!=="string" || !row.title.trim() || row.title.length>120 ||
      !validZone(row.time_zone) || !Number.isInteger(row.capacity) || row.capacity<1 || row.capacity>10000) ||
    occurrences.data.some(row=>!row || !UUID.test(row.id) || !UUID.test(row.series_id) || typeof row.title!=="string" || row.title.length>120 ||
      !["scheduled","cancelled","completed"].includes(row.status) || typeof row.starts_at!=="string" || typeof row.ends_at!=="string" ||
      !Number.isFinite(Date.parse(row.starts_at)) || !Number.isFinite(Date.parse(row.ends_at)) || Date.parse(row.ends_at)<=Date.parse(row.starts_at))) {
    throw new Error("Published series could not be verified. Reload before continuing.");
  }
  return { series: series.data as PublishedClassSeries[], occurrences: occurrences.data as PublishedOccurrence[] };
}
export async function announceClassSeries(client: SupabaseClient, viewerId: string, gymId: string, input: ClassAnnouncementInput) {
  if (![gymId, input.seriesId, input.requestId].every(id => UUID.test(id)) || !input.body.trim() || input.body.length > 2000 ||
    !["series_subscribers", "occurrence_attendees"].includes(input.audience) || typeof input.cancelOccurrence!=="boolean" ||
    (input.audience === "series_subscribers" ? input.classId !== null || input.cancelOccurrence : !UUID.test(input.classId ?? ""))) {
    throw new Error("Review the announcement and its audience.");
  }
  await viewer(client, viewerId);
  let response;
  try { response = await client.rpc("announce_gym_class_series", { p_series_id: input.seriesId, p_audience: input.audience,
    p_body: input.body.trim(), p_request_id: input.requestId, p_class_id: input.classId, p_cancel_occurrence: input.cancelOccurrence }); }
  catch { throw new ClassSeriesUnconfirmedError("Announcement could not be confirmed. Retry the same unchanged request."); }
  if (response.error) rejected(response.error, "Announcement");
  const data = response.data;
  if (!UUID.test(data?.announcementId ?? "") || !Number.isInteger(data?.recipientCount) || data.recipientCount < 0 ||
    data.channel !== "in_app" || typeof data.replayed !== "boolean") throw new ClassSeriesUnconfirmedError("Announcement acknowledgement could not be verified. Retry the same unchanged request.");
  try {
    const readback = await client.from("gym_class_announcements").select("id,gym_id,recipient_count")
      .eq("id", data.announcementId).eq("gym_id", gymId).maybeSingle();
    await viewer(client, viewerId);
    if (readback.error || readback.data?.id !== data.announcementId || readback.data?.gym_id !== gymId || readback.data?.recipient_count !== data.recipientCount) throw new Error();
  } catch { throw new ClassSeriesUnconfirmedError("The announcement may be posted, but readback failed. Retry the same unchanged request."); }
  return { announcementId: data.announcementId as string, recipientCount: data.recipientCount as number, replayed: data.replayed as boolean };
}
