import type { ProofFeedServices } from "./types";
import { createPhase4ProofFeedUiFlow } from "../flows/phase4-proof-feed-ui";

export function createProofFeedRuntimeServices(): ProofFeedServices {
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
}
