export const KRUXT_EVENT_TYPES = [
  "workout.logged",
  "pr.verified",
  "rank.updated",
  "membership.status_changed",
  "class.waitlist_promoted",
  "integration.sync_failed"
] as const;

export type KruxtEventType = (typeof KRUXT_EVENT_TYPES)[number];

export interface KruxtEventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  type: KruxtEventType;
  actorUserId?: string;
  subjectUserId?: string;
  gymId?: string;
  occurredAt: string;
  payload: TPayload;
}
