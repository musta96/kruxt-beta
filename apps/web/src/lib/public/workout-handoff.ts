import type { MemberTrainingPlan } from "./plan";
import type { WorkoutTemplate } from "./workout-log";

export type WorkoutHandoff =
  | { kind: "template"; templateId: string; dayId: string }
  | { kind: "plan"; planId: string; dayId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function identifier(value: unknown): value is string {
  return text(value, 200) && value.trim().length > 0 && !/\s/.test(value);
}

export function buildTemplateWorkoutHref(template: WorkoutTemplate, dayId: string): string | null {
  if (!UUID.test(template.id) || !identifier(dayId)) return null;
  const matchingDays = template.days.filter((day) => day.id === dayId);
  if (matchingDays.length !== 1 || matchingDays[0].exercises.length === 0) return null;
  return `/log?${new URLSearchParams({ templateId: template.id, dayId })}`;
}

export function buildPlanWorkoutHref(
  plan: Pick<MemberTrainingPlan, "id" | "title" | "coachNotes" | "days">,
  dayId: string
): string | null {
  if (!UUID.test(plan.id) || !identifier(dayId)) return null;
  const days = plan.days.filter((day) => day.id === dayId);
  if (days.length !== 1 || days[0].blocks.length === 0) return null;
  return `/log?${new URLSearchParams({ planId: plan.id, dayId })}`;
}

/** References must be resolved and authorized by the consumer; never fall back to another day. */
export function parseWorkoutHandoff(params: Pick<URLSearchParams, "getAll">): WorkoutHandoff | null {
  const templateIds = params.getAll("templateId");
  const planIds = params.getAll("planId");
  const dayIds = params.getAll("dayId");
  if (params.getAll("session").length || dayIds.length !== 1 || !identifier(dayIds[0])) return null;
  if (planIds.length) {
    if (planIds.length !== 1 || templateIds.length || !UUID.test(planIds[0])) return null;
    return { kind: "plan", planId: planIds[0], dayId: dayIds[0] };
  }
  if (templateIds.length !== 1 || !UUID.test(templateIds[0])) return null;
  return { kind: "template", templateId: templateIds[0], dayId: dayIds[0] };
}
