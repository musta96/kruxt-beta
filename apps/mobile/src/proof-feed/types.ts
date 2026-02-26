import type { ReactionType, SocialInteraction, UserReportInput } from "@kruxt/types";
import type {
  RankedFeedItem,
  UserBlockRecord,
  UserReportRecord
} from "../services";

// ─── Reaction palette ──────────────────────────────────────────────────────
export const REACTION_OPTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "fist", emoji: "✊", label: "Fist" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "shield", emoji: "🛡️", label: "Shield" },
  { type: "clap", emoji: "👏", label: "Clap" },
  { type: "crown", emoji: "👑", label: "Crown" },
];

// ─── Feed UI state ─────────────────────────────────────────────────────────
export type FeedStatus = "idle" | "loading" | "loaded" | "error" | "refreshing";

export interface FeedUiState {
  status: FeedStatus;
  items: RankedFeedItem[];
  hiddenBlockedActorCount: number;
  blockedUsers: UserBlockRecord[];
  myReports: UserReportRecord[];
  error: string | null;
  /** Active workout thread */
  activeThread: {
    workoutId: string;
    interactions: SocialInteraction[];
  } | null;
  /** Comment draft per workout */
  commentDrafts: Record<string, string>;
  /** Pending mutation locks */
  pendingMutations: Set<string>;
}

// ─── Service contract (injected) ───────────────────────────────────────────
export interface ProofFeedServices {
  load(): Promise<{
    ok: true;
    snapshot: {
      feed: RankedFeedItem[];
      hiddenBlockedActorCount: number;
      blockedUsers: UserBlockRecord[];
      myReports: UserReportRecord[];
    };
  } | {
    ok: false;
    error: { message: string };
  }>;

  loadThread(workoutId: string): Promise<SocialInteraction[]>;

  react(
    workoutId: string,
    reactionType: ReactionType | null
  ): Promise<{ ok: boolean; error?: { message: string } }>;

  comment(
    workoutId: string,
    text: string,
    parentInteractionId?: string
  ): Promise<{ ok: boolean; error?: { message: string } }>;

  block(
    blockedUserId: string,
    reason?: string
  ): Promise<{ ok: boolean; error?: { message: string } }>;

  report(input: UserReportInput): Promise<{ ok: boolean; error?: { message: string } }>;
}
