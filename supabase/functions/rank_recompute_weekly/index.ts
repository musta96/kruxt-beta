import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

type RecomputeTimeframe = "daily" | "weekly" | "monthly" | "all_time";

interface RecomputeInput {
  timeframe?: RecomputeTimeframe;
  leaderboardIds?: string[];
  limit?: number;
  determinismProbeCount?: number;
}

interface LeaderboardRow {
  id: string;
  timeframe: RecomputeTimeframe;
  starts_at: string;
  ends_at: string;
}

interface LeaderboardEntryRow {
  user_id: string;
  rank: number;
  score: number | string | null;
  details: Record<string, unknown> | null;
}

interface SnapshotResult {
  hash: string;
  rowCount: number;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeScore(value: number | string | null): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return value.toFixed(3);
  }

  return value;
}

async function snapshotLeaderboard(
  supabase: ReturnType<typeof serviceClient>,
  leaderboardId: string
): Promise<SnapshotResult> {
  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select("user_id,rank,score,details")
    .eq("leaderboard_id", leaderboardId)
    .order("rank", { ascending: true })
    .order("user_id", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = ((data as LeaderboardEntryRow[]) ?? []).map((row) => ({
    userId: row.user_id,
    rank: Number(row.rank),
    score: normalizeScore(row.score),
    details: row.details ?? {}
  }));

  const hash = await sha256Hex(JSON.stringify(rows));
  return { hash, rowCount: rows.length };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseJsonOr<RecomputeInput>(request, {});
    const timeframe = body.timeframe ?? "weekly";
    if (!["daily", "weekly", "monthly", "all_time"].includes(timeframe)) {
      return jsonResponse({ error: "Invalid timeframe." }, 400);
    }

    const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);
    const requestedDeterminismProbeCount = Math.min(Math.max(body.determinismProbeCount ?? 0, 0), 25);
    const supabase = serviceClient();
    const nowIso = new Date().toISOString();
    let query = supabase
      .from("leaderboards")
      .select("id,timeframe,starts_at,ends_at")
      .eq("is_active", true)
      .eq("timeframe", timeframe)
      .order("id", { ascending: true })
      .limit(limit);

    if (timeframe !== "all_time") {
      query = query.lte("starts_at", nowIso).gt("ends_at", nowIso);
    }

    if (body.leaderboardIds && body.leaderboardIds.length > 0) {
      query = query.in("id", body.leaderboardIds.slice(0, 200));
    }

    const { data: boards, error: boardsError } = await query;

    if (boardsError) {
      throw boardsError;
    }

    const rebuilt: string[] = [];
    const failed: Array<{ leaderboardId: string; error: string }> = [];

    for (const board of (boards as LeaderboardRow[]) ?? []) {
      const { error } = await supabase.rpc("rebuild_leaderboard_scope", {
        p_leaderboard_id: board.id
      });

      if (error) {
        failed.push({ leaderboardId: board.id, error: error.message });
      } else {
        rebuilt.push(board.id);
      }
    }

    const determinismFailures: Array<{
      leaderboardId: string;
      reason: string;
      error?: string;
      firstHash?: string;
      secondHash?: string;
      firstRowCount?: number;
      secondRowCount?: number;
    }> = [];
    const probeIds = rebuilt.slice(0, requestedDeterminismProbeCount);
    let determinismProbeCount = 0;

    for (const leaderboardId of probeIds) {
      try {
        const firstSnapshot = await snapshotLeaderboard(supabase, leaderboardId);
        const { error: probeError } = await supabase.rpc("rebuild_leaderboard_scope", {
          p_leaderboard_id: leaderboardId
        });

        if (probeError) {
          determinismFailures.push({
            leaderboardId,
            reason: "rebuild_failed_during_probe",
            error: probeError.message
          });
          continue;
        }

        const secondSnapshot = await snapshotLeaderboard(supabase, leaderboardId);
        determinismProbeCount += 1;

        if (firstSnapshot.hash !== secondSnapshot.hash) {
          determinismFailures.push({
            leaderboardId,
            reason: "non_deterministic_ordering",
            firstHash: firstSnapshot.hash,
            secondHash: secondSnapshot.hash,
            firstRowCount: firstSnapshot.rowCount,
            secondRowCount: secondSnapshot.rowCount
          });
        }
      } catch (probeError) {
        determinismFailures.push({
          leaderboardId,
          reason: "probe_error",
          error: probeError instanceof Error ? probeError.message : String(probeError)
        });
      }
    }

    failed.sort((left, right) => left.leaderboardId.localeCompare(right.leaderboardId));
    determinismFailures.sort((left, right) => left.leaderboardId.localeCompare(right.leaderboardId));

    return jsonResponse({
      timeframe,
      scannedCount: (boards ?? []).length,
      rebuiltCount: rebuilt.length,
      failedCount: failed.length,
      determinismProbeCount,
      requestedDeterminismProbeCount,
      determinismMismatchCount: determinismFailures.length,
      leaderboardIds: rebuilt,
      failures: failed,
      determinismFailures
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
