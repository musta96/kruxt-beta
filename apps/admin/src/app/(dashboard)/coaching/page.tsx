"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import type {
  CoachingAthleteSummary,
  CoachingPlanExercise,
  CoachingPlanTemplate,
  CoachingWorkspaceDetail,
  CoachingWorkspacePlan,
} from "@/services";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

const COMPACT_INPUT =
  "w-full rounded-md border border-border bg-kruxt-panel px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

type RosterFilter = "all" | "active" | "trial" | "at-risk" | "unassigned";

const rosterFilters: { value: RosterFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trialing" },
  { value: "at-risk", label: "At risk" },
  { value: "unassigned", label: "No plan" },
];

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDatetimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultSessionStart(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toDatetimeLocal(date);
}

function defaultSessionEnd(): string {
  const date = new Date();
  date.setHours(date.getHours() + 2, 0, 0, 0);
  return toDatetimeLocal(date);
}

function emptyExercise(): CoachingPlanExercise {
  return {
    day: "Day 1",
    exercise: "",
    sets: "3",
    reps: "10",
    load: "",
    tempo: "",
    rest: "90s",
    notes: "",
  };
}

function planJsonToExercises(planJson?: Record<string, unknown>): CoachingPlanExercise[] {
  const days = Array.isArray(planJson?.days) ? planJson.days : [];
  const rows: CoachingPlanExercise[] = [];

  for (const day of days) {
    if (!day || typeof day !== "object") continue;
    const dayRecord = day as Record<string, unknown>;
    const dayLabel = typeof dayRecord.label === "string" ? dayRecord.label : "Day 1";
    const blocks = Array.isArray(dayRecord.blocks) ? dayRecord.blocks : [];

    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const blockRecord = block as Record<string, unknown>;
      rows.push({
        day: dayLabel,
        exercise: String(blockRecord.exercise ?? ""),
        sets: blockRecord.sets === undefined ? "" : String(blockRecord.sets),
        reps: blockRecord.reps === undefined ? "" : String(blockRecord.reps),
        load: blockRecord.load === undefined ? "" : String(blockRecord.load),
        tempo: blockRecord.tempo === undefined ? "" : String(blockRecord.tempo),
        rest: blockRecord.rest === undefined ? "" : String(blockRecord.rest),
        notes: blockRecord.notes === undefined ? "" : String(blockRecord.notes),
      });
    }
  }

  return rows.length > 0 ? rows : [emptyExercise()];
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "message_unread":
      return "Unread message";
    case "unassigned_to_plan":
      return "No plan";
    case "stalled_progress":
      return "Stalled";
    case "adherence_drop":
      return "Adherence";
    default:
      return reason.replace(/_/g, " ");
  }
}

function athleteSearchText(athlete: CoachingAthleteSummary): string {
  return [
    athlete.displayName,
    athlete.username,
    athlete.membershipPlanName,
    athlete.latestPlanTitle,
    athlete.needsAttentionReasons.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function rosterMatchesFilter(athlete: CoachingAthleteSummary, filter: RosterFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return athlete.membershipStatus === "active";
  if (filter === "trial") return athlete.membershipStatus === "trial";
  if (filter === "at-risk") return athlete.needsAttention;
  if (filter === "unassigned") return !athlete.latestPlanId;
  return true;
}

function currentPlanLabel(plan?: CoachingWorkspacePlan): string {
  if (!plan) return "No published plan";
  const version = plan.versionNumber ? `v${plan.versionNumber}` : "latest";
  return `${plan.title} / ${version}`;
}

function templateToExercises(template?: CoachingPlanTemplate | null): CoachingPlanExercise[] {
  if (!template) return [emptyExercise()];
  return planJsonToExercises(template.planJson);
}

function ProgressBar({ value }: { value: number }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-kruxt-panel">
      <div className="h-full rounded-full bg-kruxt-accent" style={{ width: `${bounded}%` }} />
    </div>
  );
}

function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
            {title}
          </h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function CoachingPage() {
  const { gymId } = useGym();
  const { coaching } = useServices();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [planTitle, setPlanTitle] = useState("Strength progression");
  const [planGoal, setPlanGoal] = useState("Build weekly consistency and measurable strength progress.");
  const [planNotes, setPlanNotes] = useState("");
  const [planRows, setPlanRows] = useState<CoachingPlanExercise[]>([emptyExercise()]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [swapOriginal, setSwapOriginal] = useState("");
  const [swapReplacement, setSwapReplacement] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [attachLatestPlan, setAttachLatestPlan] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("1:1 coaching session");
  const [sessionStart, setSessionStart] = useState(defaultSessionStart);
  const [sessionEnd, setSessionEnd] = useState(defaultSessionEnd);
  const [sessionNotes, setSessionNotes] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalMetric, setGoalMetric] = useState("strength");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalUnit, setGoalUnit] = useState("kg");
  const [goalDueAt, setGoalDueAt] = useState("");
  const [actionError, setActionError] = useState<string | undefined>();
  const [actionSuccess, setActionSuccess] = useState<string | undefined>();
  const [savingAction, setSavingAction] = useState<string | null>(null);

  const capabilityState = useAsync(() => coaching.getCapabilityStatus(gymId), [gymId]);
  const athletesState = useAsync(() => coaching.listMyAthletes(gymId), [gymId]);
  const templatesState = useAsync(() => coaching.listPlanTemplates(gymId), [gymId]);
  const detailState = useAsync<CoachingWorkspaceDetail | null>(
    () => (selectedMemberId ? coaching.getAthleteWorkspace(gymId, selectedMemberId) : Promise.resolve(null)),
    [gymId, selectedMemberId]
  );

  const athletes = useMemo(() => athletesState.data ?? [], [athletesState.data]);
  const templates = useMemo(() => templatesState.data ?? [], [templatesState.data]);
  const detail = detailState.data;
  const currentPlan = detail?.plans?.[0];

  useEffect(() => {
    if (!selectedMemberId && athletes.length > 0) {
      setSelectedMemberId(athletes[0].memberUserId);
    }
  }, [athletes, selectedMemberId]);

  useEffect(() => {
    if (currentPlan?.id) {
      setSelectedPlanId(currentPlan.id);
      if (!swapOriginal) {
        const firstExercise = planJsonToExercises(currentPlan.planJson)[0]?.exercise ?? "";
        setSwapOriginal(firstExercise);
      }
    }
  }, [currentPlan, swapOriginal]);

  const selectedAthlete = athletes.find((athlete) => athlete.memberUserId === selectedMemberId) ?? null;

  const visibleAthletes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return athletes.filter((athlete) => {
      if (!rosterMatchesFilter(athlete, filter)) return false;
      if (!query) return true;
      return athleteSearchText(athlete).includes(query);
    });
  }, [athletes, filter, search]);

  const atRiskCount = athletes.filter((athlete) => athlete.needsAttention).length;
  const unassignedCount = athletes.filter((athlete) => !athlete.latestPlanId).length;
  const averageAdherence =
    athletes.length === 0
      ? 0
      : Math.round(athletes.reduce((total, athlete) => total + athlete.adherencePercent, 0) / athletes.length);
  const upcomingSessions = athletes.filter((athlete) => athlete.nextSessionAt).length;

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const currentPlanExercises = useMemo(() => planJsonToExercises(currentPlan?.planJson), [currentPlan]);

  function resetActionState() {
    setActionError(undefined);
    setActionSuccess(undefined);
  }

  function refreshWorkspace() {
    athletesState.refetch();
    detailState.refetch();
    templatesState.refetch();
  }

  function updatePlanRow(index: number, patch: Partial<CoachingPlanExercise>) {
    setPlanRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function loadTemplate() {
    if (!selectedTemplate) return;
    setPlanTitle(selectedTemplate.title);
    setPlanGoal(selectedTemplate.goal ?? "");
    setPlanRows(templateToExercises(selectedTemplate));
    setPlanNotes(String(selectedTemplate.planJson.notes ?? ""));
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setSavingAction(label);
    resetActionState();
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setSavingAction(null);
    }
  }

  async function publishPlan() {
    if (!selectedMemberId) return;
    await runAction("publish", async () => {
      await coaching.publishWorkoutPlan(gymId, {
        memberUserId: selectedMemberId,
        title: planTitle,
        goal: planGoal,
        notes: planNotes,
        exercises: planRows,
        source: selectedTemplate ? "template" : "manual",
      });
      setActionSuccess("Plan published to the member app.");
      refreshWorkspace();
    });
  }

  async function saveTemplate() {
    await runAction("template", async () => {
      await coaching.savePlanTemplate(gymId, {
        title: planTitle,
        goal: planGoal,
        notes: planNotes,
        exercises: planRows,
        isShared: true,
      });
      setActionSuccess("Template saved to the coaching library.");
      templatesState.refetch();
    });
  }

  async function swapExercise() {
    if (!selectedMemberId || !selectedPlanId) return;
    await runAction("swap", async () => {
      await coaching.swapExercise(gymId, {
        memberUserId: selectedMemberId,
        workoutPlanId: selectedPlanId,
        originalExercise: swapOriginal,
        replacementExercise: swapReplacement,
        reason: swapReason,
        exercisePath: {
          exerciseIndex: Math.max(0, currentPlanExercises.findIndex((row) => row.exercise === swapOriginal)),
        },
      });
      setSwapReplacement("");
      setSwapReason("");
      setActionSuccess("Exercise swap published and logged.");
      refreshWorkspace();
    });
  }

  async function sendMessage(targets: "selected" | "at-risk") {
    const targetAthletes =
      targets === "selected"
        ? athletes.filter((athlete) => athlete.memberUserId === selectedMemberId)
        : athletes.filter((athlete) => athlete.needsAttention);

    if (targetAthletes.length === 0) return;

    await runAction(targets === "selected" ? "message" : "broadcast", async () => {
      for (const athlete of targetAthletes) {
        await coaching.sendMessage(
          gymId,
          athlete.memberUserId,
          messageBody,
          attachLatestPlan && athlete.latestPlanId
            ? { type: "plan", ref: { workoutPlanId: athlete.latestPlanId } }
            : undefined
        );
      }
      setMessageBody("");
      setAttachLatestPlan(false);
      setActionSuccess(
        targets === "selected"
          ? "Message sent."
          : `Broadcast sent to ${targetAthletes.length} at-risk athlete${targetAthletes.length === 1 ? "" : "s"}.`
      );
      refreshWorkspace();
    });
  }

  async function scheduleSession() {
    if (!selectedMemberId) return;
    await runAction("session", async () => {
      await coaching.scheduleSession(gymId, {
        memberUserId: selectedMemberId,
        title: sessionTitle,
        startsAt: new Date(sessionStart).toISOString(),
        endsAt: new Date(sessionEnd).toISOString(),
        notes: sessionNotes,
      });
      setSessionTitle("1:1 coaching session");
      setSessionStart(defaultSessionStart());
      setSessionEnd(defaultSessionEnd());
      setSessionNotes("");
      setActionSuccess("Private session scheduled and synced to Staff.");
      refreshWorkspace();
    });
  }

  async function createNote() {
    if (!selectedMemberId) return;
    await runAction("note", async () => {
      await coaching.createNote(gymId, {
        memberUserId: selectedMemberId,
        title: noteTitle,
        body: noteBody,
        noteType: "session_note",
      });
      setNoteTitle("");
      setNoteBody("");
      setActionSuccess("Private coaching note saved.");
      refreshWorkspace();
    });
  }

  async function saveGoal() {
    if (!selectedMemberId) return;
    await runAction("goal", async () => {
      await coaching.upsertGoal(gymId, {
        memberUserId: selectedMemberId,
        title: goalTitle,
        metricKey: goalMetric,
        currentValue: goalCurrent ? Number(goalCurrent) : null,
        targetValue: goalTarget ? Number(goalTarget) : null,
        unit: goalUnit,
        dueAt: goalDueAt || null,
      });
      setGoalTitle("");
      setGoalCurrent("");
      setGoalTarget("");
      setGoalDueAt("");
      setActionSuccess("Goal saved.");
      refreshWorkspace();
    });
  }

  const isLoading =
    capabilityState.status === "loading" ||
    capabilityState.status === "idle" ||
    athletesState.status === "loading" ||
    athletesState.status === "idle";

  if (isLoading) return <PageSkeleton />;

  if (capabilityState.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Coaching" description="Private PT workspace for assigned athletes." />
        <ErrorBanner message={capabilityState.error} onRetry={capabilityState.refetch} />
      </div>
    );
  }

  const capability = capabilityState.data;
  if (!capability?.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Coaching"
          description="Private PT workspace for assigned athletes."
          actions={<StatusBadge label="Pro entitlement off" variant="warning" dot />}
        />
        <EmptyState
          title="Private coaching workspace is not enabled"
          description="Turn on the Private coaching workspace capability for this gym from Platform > Tenant Detail > Features."
        />
      </div>
    );
  }

  if (athletesState.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Coaching" description="Private PT workspace for assigned athletes." />
        <ErrorBanner message={athletesState.error} onRetry={athletesState.refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coaching"
        description="Coach-scoped roster, plan builder, messaging, sessions, notes, and goals."
        actions={
          <>
            <StatusBadge
              label={`${capability.templateName ?? capability.templateKey ?? "Plan"} / ${capability.source ?? "effective"}`}
              variant="info"
              dot
            />
            <StatusBadge label="Private" variant="default" dot />
          </>
        }
      />

      {(actionError || actionSuccess) && (
        <div
          className={
            actionError
              ? "rounded-card border border-kruxt-danger/30 bg-kruxt-danger/5 p-4 text-sm text-kruxt-danger"
              : "rounded-card border border-kruxt-success/30 bg-kruxt-success/5 p-4 text-sm text-kruxt-success"
          }
        >
          {actionError ?? actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="My Athletes" value={athletes.length} subtext={`${atRiskCount} need attention`} />
        <StatCard label="Adherence Avg" value={`${averageAdherence}%`} accent={averageAdherence < 60 ? "warning" : "success"} />
        <StatCard label="Upcoming 1:1s" value={upcomingSessions} subtext="scheduled" />
        <StatCard label="No Plan" value={unassignedCount} accent={unassignedCount > 0 ? "warning" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Section title="My athletes" description="Only members assigned to you are unmasked here.">
            <div className="space-y-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={INPUT}
                placeholder="Search name, plan, or risk..."
              />
              <div className="flex flex-wrap gap-2">
                {rosterFilters.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    className={
                      filter === item.value
                        ? "rounded-button bg-kruxt-accent px-3 py-1.5 text-xs font-semibold text-kruxt-bg"
                        : "rounded-button border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {visibleAthletes.length === 0 ? (
                <EmptyState
                  title="No athletes found"
                  description="Assigned athletes will appear here after Members > Assigned PT is set to your profile."
                  className="py-10"
                />
              ) : (
                <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                  {visibleAthletes.map((athlete) => {
                    const active = athlete.memberUserId === selectedMemberId;
                    return (
                      <button
                        key={athlete.memberUserId}
                        onClick={() => setSelectedMemberId(athlete.memberUserId)}
                        className={
                          active
                            ? "w-full rounded-card border border-kruxt-accent/50 bg-kruxt-accent/10 p-4 text-left"
                            : "w-full rounded-card border border-border bg-kruxt-panel/40 p-4 text-left transition-colors hover:border-kruxt-accent/40 hover:bg-kruxt-panel"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{athlete.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {athlete.username ? `@${athlete.username}` : athlete.memberUserId.slice(0, 8)}
                            </p>
                          </div>
                          <StatusBadge
                            label={athlete.membershipStatus}
                            variant={statusToVariant(athlete.membershipStatus)}
                            dot
                          />
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Adherence</span>
                            <span className="font-medium text-foreground">{athlete.adherencePercent}%</span>
                          </div>
                          <ProgressBar value={athlete.adherencePercent} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {athlete.needsAttentionReasons.length > 0 ? (
                            athlete.needsAttentionReasons.map((reason) => (
                              <StatusBadge key={reason} label={reasonLabel(reason)} variant="warning" />
                            ))
                          ) : (
                            <StatusBadge label="On track" variant="success" />
                          )}
                          {athlete.unreadMessages > 0 && (
                            <StatusBadge label={`${athlete.unreadMessages} unread`} variant="danger" />
                          )}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Next: {formatDateTime(athlete.nextSessionAt)} / Plan: {athlete.latestPlanTitle ?? "None"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        </aside>

        <main className="space-y-6">
          {!selectedAthlete ? (
            <EmptyState
              title="Pick an athlete"
              description="Select an assigned member to open their private coaching workspace."
            />
          ) : detailState.status === "loading" || detailState.status === "idle" ? (
            <PageSkeleton />
          ) : detailState.status === "error" ? (
            <ErrorBanner message={detailState.error} onRetry={detailState.refetch} />
          ) : detail?.masked ? (
            <EmptyState
              title="Private athlete"
              description="This athlete is masked because they are not assigned to your coach profile."
            />
          ) : (
            <>
              <Section
                title={selectedAthlete.displayName}
                description={`${selectedAthlete.membershipPlanName ?? "No plan"} / latest workout ${formatDateTime(
                  detail?.stats.latestWorkoutAt
                )}`}
                actions={
                  <>
                    <StatusBadge label={currentPlanLabel(currentPlan)} variant="info" />
                    <StatusBadge
                      label={selectedAthlete.needsAttention ? "Needs attention" : "On track"}
                      variant={selectedAthlete.needsAttention ? "warning" : "success"}
                      dot
                    />
                  </>
                }
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Check-ins 30d</p>
                    <p className="mt-1 text-2xl font-bold text-foreground font-kruxt-mono">
                      {detail?.stats.checkins30d ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Workouts 30d</p>
                    <p className="mt-1 text-2xl font-bold text-foreground font-kruxt-mono">
                      {detail?.stats.workouts30d ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">PRs 90d</p>
                    <p className="mt-1 text-2xl font-bold text-foreground font-kruxt-mono">
                      {detail?.stats.prs90d ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sessions done</p>
                    <p className="mt-1 text-2xl font-bold text-foreground font-kruxt-mono">
                      {detail?.stats.completedSessions30d ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Adherence</p>
                    <p className="mt-1 text-2xl font-bold text-kruxt-accent font-kruxt-mono">
                      {selectedAthlete.adherencePercent}%
                    </p>
                  </div>
                </div>
              </Section>

              <Section
                title="Training plan builder"
                description="Publish syncs immediately to the member side; exercise swaps are versioned and logged."
                actions={
                  <>
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      className="rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-xs text-foreground focus:border-kruxt-accent focus:outline-none"
                    >
                      <option value="">Templates</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={loadTemplate}
                      disabled={!selectedTemplate}
                      className="rounded-button border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground disabled:opacity-50"
                    >
                      Load template
                    </button>
                    <button
                      disabled
                      title="Pro+AI drafting will be enabled when the model provider is wired."
                      className="rounded-button border border-border px-3 py-2 text-xs font-medium text-muted-foreground opacity-50"
                    >
                      Draft with AI
                    </button>
                  </>
                }
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      value={planTitle}
                      onChange={(event) => setPlanTitle(event.target.value)}
                      className={INPUT}
                      placeholder="Plan title"
                    />
                    <input
                      value={planGoal}
                      onChange={(event) => setPlanGoal(event.target.value)}
                      className={INPUT}
                      placeholder="Goal"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-2">Day</th>
                          <th className="px-2 py-2">Exercise</th>
                          <th className="px-2 py-2">Sets</th>
                          <th className="px-2 py-2">Reps</th>
                          <th className="px-2 py-2">Load</th>
                          <th className="px-2 py-2">Tempo</th>
                          <th className="px-2 py-2">Rest</th>
                          <th className="px-2 py-2">Notes</th>
                          <th className="py-2 pl-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {planRows.map((row, index) => (
                          <tr key={`${row.day}-${index}`}>
                            <td className="py-2 pr-2">
                              <input
                                value={row.day}
                                onChange={(event) => updatePlanRow(index, { day: event.target.value })}
                                className={COMPACT_INPUT}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.exercise}
                                onChange={(event) => updatePlanRow(index, { exercise: event.target.value })}
                                className={COMPACT_INPUT}
                                placeholder="Goblet squat"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.sets ?? ""}
                                onChange={(event) => updatePlanRow(index, { sets: event.target.value })}
                                className={COMPACT_INPUT}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.reps ?? ""}
                                onChange={(event) => updatePlanRow(index, { reps: event.target.value })}
                                className={COMPACT_INPUT}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.load ?? ""}
                                onChange={(event) => updatePlanRow(index, { load: event.target.value })}
                                className={COMPACT_INPUT}
                                placeholder="RPE 7"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.tempo ?? ""}
                                onChange={(event) => updatePlanRow(index, { tempo: event.target.value })}
                                className={COMPACT_INPUT}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.rest ?? ""}
                                onChange={(event) => updatePlanRow(index, { rest: event.target.value })}
                                className={COMPACT_INPUT}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={row.notes ?? ""}
                                onChange={(event) => updatePlanRow(index, { notes: event.target.value })}
                                className={COMPACT_INPUT}
                              />
                            </td>
                            <td className="py-2 pl-2">
                              <button
                                onClick={() => setPlanRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                                disabled={planRows.length === 1}
                                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-kruxt-panel disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <textarea
                    value={planNotes}
                    onChange={(event) => setPlanNotes(event.target.value)}
                    className={INPUT}
                    rows={2}
                    placeholder="Coach notes, session intent, technique cues..."
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPlanRows((current) => [...current, emptyExercise()])}
                      className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
                    >
                      Add exercise
                    </button>
                    <button
                      onClick={() => void saveTemplate()}
                      disabled={savingAction === "template"}
                      className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground disabled:opacity-50"
                    >
                      {savingAction === "template" ? "Saving..." : "Save template"}
                    </button>
                    <button
                      onClick={() => void publishPlan()}
                      disabled={savingAction === "publish"}
                      className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingAction === "publish" ? "Publishing..." : "Publish to member"}
                    </button>
                  </div>
                </div>
              </Section>

              <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                <Section title="Per-exercise swap" description="Patch one exercise while keeping the rest of the program intact.">
                  <div className="space-y-3">
                    <select
                      value={selectedPlanId}
                      onChange={(event) => setSelectedPlanId(event.target.value)}
                      className={INPUT}
                    >
                      <option value="">Select plan</option>
                      {(detail?.plans ?? []).map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={swapOriginal}
                      onChange={(event) => setSwapOriginal(event.target.value)}
                      className={INPUT}
                    >
                      <option value="">Original exercise</option>
                      {currentPlanExercises.map((exercise, index) => (
                        <option key={`${exercise.exercise}-${index}`} value={exercise.exercise}>
                          {exercise.day} / {exercise.exercise || "Untitled"}
                        </option>
                      ))}
                    </select>
                    <input
                      value={swapReplacement}
                      onChange={(event) => setSwapReplacement(event.target.value)}
                      className={INPUT}
                      placeholder="Replacement exercise"
                    />
                    <textarea
                      value={swapReason}
                      onChange={(event) => setSwapReason(event.target.value)}
                      className={INPUT}
                      rows={2}
                      placeholder="Reason, e.g. knee discomfort, equipment unavailable..."
                    />
                    <button
                      onClick={() => void swapExercise()}
                      disabled={savingAction === "swap"}
                      className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingAction === "swap" ? "Publishing..." : "Publish swap"}
                    </button>

                    {(detail?.exerciseSwaps ?? []).length > 0 && (
                      <div className="space-y-2 border-t border-border pt-3">
                        {detail?.exerciseSwaps.slice(0, 4).map((swap) => (
                          <div key={swap.id} className="text-sm">
                            <p className="font-medium text-foreground">
                              {swap.originalExercise} to {swap.replacementExercise}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(swap.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Messages" description="In-app thread tied to this athlete, retained and logged.">
                  <div className="space-y-3">
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-kruxt-panel/30 p-3">
                      {(detail?.messages ?? []).length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
                      ) : (
                        detail?.messages.map((message) => {
                          const own = message.senderUserId !== selectedAthlete.memberUserId;
                          return (
                            <div key={message.id} className={own ? "text-right" : "text-left"}>
                              <div
                                className={
                                  own
                                    ? "ml-auto inline-block max-w-[80%] rounded-lg bg-kruxt-accent/15 px-3 py-2 text-sm text-foreground"
                                    : "inline-block max-w-[80%] rounded-lg bg-card px-3 py-2 text-sm text-foreground"
                                }
                              >
                                {message.body ?? message.attachmentType ?? "Attachment"}
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(message.createdAt)}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <textarea
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                      className={INPUT}
                      rows={3}
                      placeholder="Write a coaching message..."
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={attachLatestPlan}
                        onChange={(event) => setAttachLatestPlan(event.target.checked)}
                        className="h-4 w-4 rounded border-border bg-kruxt-panel"
                      />
                      Attach latest plan
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void sendMessage("selected")}
                        disabled={savingAction === "message"}
                        className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {savingAction === "message" ? "Sending..." : "Send"}
                      </button>
                      <button
                        onClick={() => void sendMessage("at-risk")}
                        disabled={savingAction === "broadcast" || atRiskCount === 0}
                        className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground disabled:opacity-50"
                      >
                        Broadcast to at-risk
                      </button>
                    </div>
                  </div>
                </Section>
              </div>

              <div className="grid grid-cols-1 gap-6 2xl:grid-cols-3">
                <Section title="Session scheduling" description="Creates a private session and syncs to Staff scheduling.">
                  <div className="space-y-3">
                    <input
                      value={sessionTitle}
                      onChange={(event) => setSessionTitle(event.target.value)}
                      className={INPUT}
                      placeholder="Session title"
                    />
                    <input
                      type="datetime-local"
                      value={sessionStart}
                      onChange={(event) => setSessionStart(event.target.value)}
                      className={INPUT}
                    />
                    <input
                      type="datetime-local"
                      value={sessionEnd}
                      onChange={(event) => setSessionEnd(event.target.value)}
                      className={INPUT}
                    />
                    <textarea
                      value={sessionNotes}
                      onChange={(event) => setSessionNotes(event.target.value)}
                      className={INPUT}
                      rows={2}
                      placeholder="Session notes or prep..."
                    />
                    <button
                      onClick={() => void scheduleSession()}
                      disabled={savingAction === "session"}
                      className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingAction === "session" ? "Scheduling..." : "Schedule session"}
                    </button>
                    <div className="space-y-2 border-t border-border pt-3">
                      {(detail?.sessions ?? []).slice(0, 4).map((session) => (
                        <div key={session.id}>
                          <p className="text-sm font-medium text-foreground">{session.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(session.startsAt)} / {session.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                <Section title="Private notes" description="Sensitive coaching CRM notes, scoped to the assigned coach.">
                  <div className="space-y-3">
                    <input
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      className={INPUT}
                      placeholder="Note title"
                    />
                    <textarea
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      className={INPUT}
                      rows={4}
                      placeholder="Injuries, preferences, technique cues..."
                    />
                    <button
                      onClick={() => void createNote()}
                      disabled={savingAction === "note"}
                      className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingAction === "note" ? "Saving..." : "Save note"}
                    </button>
                    <div className="space-y-2 border-t border-border pt-3">
                      {(detail?.notes ?? []).slice(0, 3).map((note) => (
                        <div key={note.id}>
                          <p className="text-sm font-medium text-foreground">{note.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                <Section title="Goals" description="Track milestones and progress bars for this athlete.">
                  <div className="space-y-3">
                    <input
                      value={goalTitle}
                      onChange={(event) => setGoalTitle(event.target.value)}
                      className={INPUT}
                      placeholder="Goal title"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={goalMetric}
                        onChange={(event) => setGoalMetric(event.target.value)}
                        className={COMPACT_INPUT}
                        placeholder="metric"
                      />
                      <input
                        value={goalUnit}
                        onChange={(event) => setGoalUnit(event.target.value)}
                        className={COMPACT_INPUT}
                        placeholder="unit"
                      />
                      <input
                        value={goalCurrent}
                        onChange={(event) => setGoalCurrent(event.target.value)}
                        className={COMPACT_INPUT}
                        type="number"
                        placeholder="current"
                      />
                      <input
                        value={goalTarget}
                        onChange={(event) => setGoalTarget(event.target.value)}
                        className={COMPACT_INPUT}
                        type="number"
                        placeholder="target"
                      />
                    </div>
                    <input
                      value={goalDueAt}
                      onChange={(event) => setGoalDueAt(event.target.value)}
                      className={INPUT}
                      type="date"
                    />
                    <button
                      onClick={() => void saveGoal()}
                      disabled={savingAction === "goal"}
                      className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingAction === "goal" ? "Saving..." : "Save goal"}
                    </button>
                    <div className="space-y-3 border-t border-border pt-3">
                      {(detail?.goals ?? []).slice(0, 4).map((goal) => {
                        const progress =
                          goal.targetValue && goal.currentValue
                            ? Math.round((Number(goal.currentValue) / Number(goal.targetValue)) * 100)
                            : 0;
                        return (
                          <div key={goal.id}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-foreground">{goal.title}</p>
                              <span className="text-xs text-muted-foreground">{formatDate(goal.dueAt)}</span>
                            </div>
                            <ProgressBar value={progress} />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {goal.currentValue ?? 0} / {goal.targetValue ?? "-"} {goal.unit ?? ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Section>
              </div>

              <Section title="Activity feed" description="Actual training and check-in activity against the prescribed plan.">
                {(detail?.activity ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {detail?.activity.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.type} / {item.detail ?? "activity"}</p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
