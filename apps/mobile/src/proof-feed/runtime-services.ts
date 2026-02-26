import type { ProofFeedServices } from "./types";
import { createPhase4ProofFeedUiFlow } from "../flows/phase4-proof-feed-ui";

export function createProofFeedRuntimeServices(): ProofFeedServices {
  try {
    const flow = createPhase4ProofFeedUiFlow();

    return {
      load: () => flow.load(),

      loadThread: (workoutId) => flow.loadWorkoutThread(workoutId),

      react: (workoutId, reactionType) =>
        flow.reactToWorkout(workoutId, reactionType),

      comment: (workoutId, text, parentInteractionId) =>
        flow.commentOnWorkout(workoutId, text, { parentInteractionId }),

      block: (blockedUserId, reason) =>
        flow.blockActor(blockedUserId, reason),

      report: (input) => flow.reportContent(input),
    };
  } catch (error) {
    // Keep Lovable preview usable when env vars are not configured.
    console.warn("[proof-feed-runtime] Falling back to preview services:", error);
    return {
      load: async () => ({
        ok: true,
        snapshot: {
          feed: [],
          hiddenBlockedActorCount: 0,
          blockedUsers: [],
          myReports: []
        }
      }),
      loadThread: async () => [],
      react: async () => ({ ok: true }),
      comment: async () => ({ ok: true }),
      block: async () => ({ ok: true }),
      report: async () => ({ ok: true })
    };
  }
}
