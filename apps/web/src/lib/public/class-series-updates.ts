import type { SupabaseClient } from "@supabase/supabase-js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validZone(value: unknown): boolean {
  if (typeof value!=="string" || value.length>100)return false;
  try {new Intl.DateTimeFormat("en",{timeZone:value});return true;}catch{return false;}
}
function validTime(value: unknown): value is string {return typeof value==="string"&&Number.isFinite(Date.parse(value));}
export interface MemberClassSeries { id: string; title: string; time_zone: string }
export interface MemberClassAnnouncement { id: string; series_id: string; class_id: string | null; audience: string; occurrence_starts_at: string | null; time_zone: string; body: string; created_at: string }
async function requireViewer(client: SupabaseClient, viewerId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== viewerId) throw new Error("Your account changed. Reload before continuing.");
}
export async function loadClassSeriesUpdates(client: SupabaseClient, viewerId: string, gymId: string) {
  if (![viewerId,gymId].every(id => UUID.test(id))) throw new Error("Choose a valid gym and account.");
  await requireViewer(client, viewerId);
  const [series, subscriptions, announcements] = await Promise.all([
    client.from("gym_class_series").select("id,title,time_zone").eq("gym_id",gymId).order("title").limit(200),
    client.from("gym_class_series_subscriptions").select("series_id").eq("user_id",viewerId),
    client.from("gym_class_announcements").select("id,series_id,class_id,audience,occurrence_starts_at,time_zone,body,created_at").eq("gym_id",gymId).order("created_at",{ascending:false}).limit(20)
  ]);
  await requireViewer(client, viewerId);
  if (series.error || subscriptions.error || announcements.error ||
    ![series.data,subscriptions.data,announcements.data].every(Array.isArray)) throw new Error("Class updates could not be loaded. Retry.");
  if (series.data.some(row=>!row || !UUID.test(row.id) || typeof row.title!=="string" || !row.title.trim() || row.title.length>120 || !validZone(row.time_zone)) ||
    subscriptions.data.some(row=>!row || !UUID.test(row.series_id)) ||
    announcements.data.some(row=>!row || !UUID.test(row.id) || !UUID.test(row.series_id) ||
      (row.class_id!==null && !UUID.test(row.class_id)) || typeof row.body!=="string" || !row.body.trim() || row.body.length>2000 ||
      !validTime(row.created_at) || !validZone(row.time_zone) || !["series_subscribers","occurrence_attendees"].includes(row.audience) ||
      (row.audience==="series_subscribers" ? row.class_id!==null || row.occurrence_starts_at!==null : !validTime(row.occurrence_starts_at)))) {
    throw new Error("Class updates could not be verified. Reload before continuing.");
  }
  return { series: series.data as MemberClassSeries[], subscriptions: subscriptions.data.map(row => row.series_id as string),
    announcements: announcements.data as MemberClassAnnouncement[] };
}
export async function subscribeToClassSeries(client: SupabaseClient, viewerId: string, seriesId: string, subscribed: boolean) {
  if (![viewerId,seriesId].every(id => UUID.test(id)) || typeof subscribed!=="boolean") throw new Error("Choose a valid series and subscription decision.");
  await requireViewer(client,viewerId);
  const {data,error}=await client.rpc("subscribe_gym_class_series",{p_series_id:seriesId,p_subscribed:subscribed});
  if (error || data?.seriesId!==seriesId || data?.subscribed!==subscribed) throw new Error("Subscription change could not be confirmed. Reload before retrying.");
  const readback=await client.from("gym_class_series_subscriptions").select("series_id").eq("series_id",seriesId).eq("user_id",viewerId).maybeSingle();
  await requireViewer(client,viewerId);
  if (readback.error || (subscribed ? readback.data?.series_id!==seriesId : readback.data!==null)) throw new Error("Subscription may have changed, but readback failed. Reload before retrying.");
}
