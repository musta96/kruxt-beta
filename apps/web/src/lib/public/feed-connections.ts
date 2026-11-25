import type { SupabaseClient } from "@supabase/supabase-js";

interface ConnectionRow {
  id: string;
  follower_user_id: string;
  followed_user_id: string;
  status: "pending" | "accepted" | "blocked";
}

interface BlockRow {
  blocker_user_id: string;
  blocked_user_id: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  username: string | null;
}

export interface FeedConnection {
  id: string;
  userId: string;
  label: string;
  status: "pending" | "accepted";
}

export interface FeedConnectionsSnapshot {
  viewerId: string;
  incoming: FeedConnection[];
  outgoing: FeedConnection[];
  blocked: Array<{ userId: string; label: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_IN_LABEL = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function requireViewer(client: SupabaseClient, expectedViewerId?: string): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required.");
  if (expectedViewerId !== undefined && data.user.id !== expectedViewerId) {
    throw new Error("Your account changed. Reload connections.");
  }
  return data.user.id;
}

function profileLabel(profile: ProfileRow | undefined): string {
  for (const [value, prefix] of [[profile?.display_name, ""], [profile?.username, "@"]] as const) {
    const label = value?.trim().replace(/^@/, "");
    if (label && label.length <= 120 && !/[@\u0000-\u001f\u007f]/.test(label) && !UUID_IN_LABEL.test(label)) {
      return `${prefix}${label}`;
    }
  }
  return "Member";
}

export async function loadFeedConnections(client: SupabaseClient): Promise<FeedConnectionsSnapshot> {
  const viewerId = await requireViewer(client);
  const [incoming, outgoing, blocked] = await Promise.all([
    client.from("social_connections").select("id,follower_user_id,followed_user_id,status")
      .eq("followed_user_id", viewerId).eq("status", "pending"),
    client.from("social_connections").select("id,follower_user_id,followed_user_id,status")
      .eq("follower_user_id", viewerId).in("status", ["pending", "accepted"]),
    client.from("user_blocks").select("blocker_user_id,blocked_user_id").eq("blocker_user_id", viewerId)
  ]);
  if (incoming.error || outgoing.error || blocked.error) throw new Error("Unable to load connections. Retry.");

  const ownBlocks = ((blocked.data ?? []) as BlockRow[]).filter((row) => row.blocker_user_id === viewerId);
  const blockedIds = new Set(ownBlocks.map((row) => row.blocked_user_id));
  const incomingRows = ((incoming.data ?? []) as ConnectionRow[]).filter((row) =>
    row.followed_user_id === viewerId && row.status === "pending" && !blockedIds.has(row.follower_user_id));
  const outgoingRows = ((outgoing.data ?? []) as ConnectionRow[]).filter((row) =>
    row.follower_user_id === viewerId && (row.status === "pending" || row.status === "accepted") && !blockedIds.has(row.followed_user_id));
  const ids = [...new Set([
    ...incomingRows.map((row) => row.follower_user_id),
    ...outgoingRows.map((row) => row.followed_user_id),
    ...blockedIds
  ])];
  const profiles = ids.length
    ? await client.from("profiles").select("id,display_name,username").in("id", ids)
    : { data: [], error: null };
  if (profiles.error) throw new Error("Unable to load connection profiles. Retry.");
  const labels = new Map(((profiles.data ?? []) as ProfileRow[]).map((row) => [row.id, profileLabel(row)]));
  await requireViewer(client, viewerId);
  return {
    viewerId,
    incoming: incomingRows.map((row) => ({ id: row.id, userId: row.follower_user_id, label: labels.get(row.follower_user_id) ?? "Member", status: "pending" })),
    outgoing: outgoingRows.map((row) => ({ id: row.id, userId: row.followed_user_id, label: labels.get(row.followed_user_id) ?? "Member", status: row.status as "pending" | "accepted" })),
    blocked: ownBlocks.map((row) => ({ userId: row.blocked_user_id, label: labels.get(row.blocked_user_id) ?? "Member" }))
  };
}

export type FeedConnectionAction = "accept" | "decline" | "remove" | "unblock";

/** The expected viewer binds a displayed row to the identity that loaded it. RLS remains authoritative. */
export async function mutateFeedConnection(
  client: SupabaseClient,
  expectedViewerId: string,
  action: FeedConnectionAction,
  id: string
): Promise<void> {
  const viewerId = await requireViewer(client, expectedViewerId);
  if (!UUID.test(id)) throw new Error("Invalid connection reference.");
  if (action === "unblock") {
    const result = await client.from("user_blocks").delete()
      .eq("blocker_user_id", viewerId).eq("blocked_user_id", id).select("blocked_user_id").maybeSingle();
    if (result.error || result.data?.blocked_user_id !== id) throw new Error("Unblock was not confirmed. Reload and retry.");
  } else {
    if (!["accept", "decline", "remove"].includes(action)) throw new Error("Invalid connection action.");
    let query = action === "accept"
      ? client.from("social_connections").update({ status: "accepted" })
      : client.from("social_connections").delete();
    query = query.eq("id", id);
    query = action === "remove"
      ? query.eq("follower_user_id", viewerId).in("status", ["pending", "accepted"])
      : query.eq("followed_user_id", viewerId).eq("status", "pending");
    const result = await query.select("id").maybeSingle();
    if (result.error || result.data?.id !== id) throw new Error("Connection change was not confirmed. Reload and retry.");
  }
  await requireViewer(client, viewerId);
}
