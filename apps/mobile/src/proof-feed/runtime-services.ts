import type { ProofFeedServices } from "./types";
import { createPhase4ProofFeedUiFlow } from "../flows/phase4-proof-feed-ui";

export function createProofFeedRuntimeServices(): ProofFeedServices {
  let flow: ReturnType<typeof createPhase4ProofFeedUiFlow> | null = null;
  let failed = false;

  const fallbackLoad = async () => ({
    ok: true as const,
    snapshot: {
      feed: [],
      hiddenBlockedActorCount: 0,
      blockedUsers: [],
      myReports: []
    }
  });

  const getFlow = async () => {
    if (flow) return flow;
    if (failed) return null;

    try {
      flow = createPhase4ProofFeedUiFlow();
      return flow;
    } catch (error) {
      failed = true;
      // Keep Lovable preview usable when env vars are not configured.
      console.warn("[proof-feed-runtime] Falling back to preview services:", error);
      return null;
    }
  };

  return {
    load: async () => {
      const loadedFlow = await getFlow();
      if (!loadedFlow) return fallbackLoad();
      try {
        return await loadedFlow.load();
      } catch (error) {
        console.warn("[proof-feed-runtime] load failed, returning fallback:", error);
        return fallbackLoad();
      }
    },

    loadThread: async (workoutId) => {
      const loadedFlow = await getFlow();
      if (!loadedFlow) return [];
      try {
        return await loadedFlow.loadWorkoutThread(workoutId);
      } catch (error) {
        console.warn("[proof-feed-runtime] loadThread failed:", error);
        return [];
      }
    },

    react: async (workoutId, reactionType) => {
      const loadedFlow = await getFlow();
      if (!loadedFlow) return { ok: true };
      try {
        return await loadedFlow.reactToWorkout(workoutId, reactionType);
      } catch (error) {
        console.warn("[proof-feed-runtime] react failed:", error);
        return { ok: false, error: { message: "Unable to react right now." } };
      }
    },

    comment: async (workoutId, text, parentInteractionId) => {
      const loadedFlow = await getFlow();
      if (!loadedFlow) return { ok: true };
      try {
        return await loadedFlow.commentOnWorkout(workoutId, text, { parentInteractionId });
      } catch (error) {
        console.warn("[proof-feed-runtime] comment failed:", error);
        return { ok: false, error: { message: "Unable to post comment right now." } };
      }
    },

    block: async (blockedUserId, reason) => {
      const loadedFlow = await getFlow();
      if (!loadedFlow) return { ok: true };
      try {
        return await loadedFlow.blockActor(blockedUserId, reason);
      } catch (error) {
        console.warn("[proof-feed-runtime] block failed:", error);
        return { ok: false, error: { message: "Unable to block user right now." } };
      }
    },

    report: async (input) => {
      const loadedFlow = await getFlow();
      if (!loadedFlow) return { ok: true };
      try {
        return await loadedFlow.reportContent(input);
      } catch (error) {
        console.warn("[proof-feed-runtime] report failed:", error);
        return { ok: false, error: { message: "Unable to submit report right now." } };
      }
    }
  };
}
