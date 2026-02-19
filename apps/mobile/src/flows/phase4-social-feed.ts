import {
  createMobileSupabaseClient,
  FeedService,
  NotificationService,
  SocialService,
  type RankedFeedItem,
  type UserBlockRecord
} from "../services";
import type { NotificationPreferences, PushNotificationToken, SocialConnection } from "@kruxt/types";

export interface Phase4SocialFeedSnapshot {
  feed: RankedFeedItem[];
  incomingFollowRequests: SocialConnection[];
  notificationPreferences: NotificationPreferences;
  activePushTokens: PushNotificationToken[];
  blockedUsers: UserBlockRecord[];
}

export const phase4SocialFeedChecklist = [
  "Load ranked feed v1",
  "Load incoming follow requests",
  "Load notification preferences",
  "Load active push tokens",
  "Load block safety state"
] as const;

export function createPhase4SocialFeedFlow() {
  const supabase = createMobileSupabaseClient();
  const feed = new FeedService(supabase);
  const social = new SocialService(supabase);
  const notifications = new NotificationService(supabase);

  return {
    checklist: phase4SocialFeedChecklist,
    load: async (userId?: string): Promise<Phase4SocialFeedSnapshot> => {
      const [
        rankedFeed,
        incomingFollowRequests,
        notificationPreferences,
        activePushTokens,
        blockedUsers
      ] = await Promise.all([
        feed.listHomeFeed({ limit: 30, scanLimit: 150 }, userId),
        social.listIncomingFollowRequests(userId, 50),
        notifications.getPreferences(userId),
        notifications.listActivePushTokens(userId, 10),
        social.listMyBlocks(userId)
      ]);

      return {
        feed: rankedFeed,
        incomingFollowRequests,
        notificationPreferences,
        activePushTokens,
        blockedUsers
      };
    }
  };
}
