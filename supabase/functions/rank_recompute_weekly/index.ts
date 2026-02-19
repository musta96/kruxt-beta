import { jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = serviceClient();

    const nowIso = new Date().toISOString();
    const { data: boards, error: boardsError } = await supabase
      .from("leaderboards")
      .select("id")
      .eq("is_active", true)
      .in("timeframe", ["weekly", "daily", "monthly"])
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso);

    if (boardsError) {
      throw boardsError;
    }

    const rebuilt: string[] = [];

    for (const board of boards ?? []) {
      const { error } = await supabase.rpc("rebuild_leaderboard_scope", {
        p_leaderboard_id: board.id
      });

      if (!error) {
        rebuilt.push(board.id);
      }
    }

    return jsonResponse({ rebuiltCount: rebuilt.length, leaderboardIds: rebuilt });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
