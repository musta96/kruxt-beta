import { jsonResponse, parseJsonOr } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

type RecomputeTimeframe = "daily" | "weekly" | "monthly" | "all_time";

interface RecomputeInput {
  timeframe?: RecomputeTimeframe;
  leaderboardIds?: string[];
  limit?: number;
}

interface LeaderboardRow {
  id: string;
  timeframe: RecomputeTimeframe;
  starts_at: string;
  ends_at: string;
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

    return jsonResponse({
      timeframe,
      scannedCount: (boards ?? []).length,
      rebuiltCount: rebuilt.length,
      failedCount: failed.length,
      leaderboardIds: rebuilt,
      failures: failed
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
