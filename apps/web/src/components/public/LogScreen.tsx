"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, LockKeyhole, Save } from "lucide-react";
import type { WorkoutType, WorkoutVisibility } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  buildHyroxPreset,
  HYROX_PRESET_OPTIONS,
  HYROX_REQUIRED_EXERCISE_SLUGS,
  type HyroxPresetKey
} from "@/lib/public/hyrox";
import {
  loadExercisesBySlugs,
  loadWorkoutLogContext,
  loadWorkoutTemplates,
  searchExercises,
  saveWorkoutTemplate,
  submitWorkout,
  uploadWorkoutProofMedia,
  updateWorkoutAudience,
  WorkoutSaveUncertainError,
  deleteWorkoutTemplate,
  type ExerciseSearchResult,
  type WorkoutBlockType,
  type WorkoutLogContext,
  type WorkoutTemplate,
  type WorkoutTemplateDay
} from "@/lib/public/workout-log";
import { parseWorkoutPlanFile } from "@/lib/public/workout-plan-import";
import { parseWorkoutHandoff } from "@/lib/public/workout-handoff";
import { loadTrainingPlanForWorkout } from "@/lib/public/plan";
import { readWorkoutDraft, writeWorkoutDraft, discardWorkoutDraft, readWorkoutDraftRequest, writeWorkoutDraftRequest,
  clearWorkoutDraftRequest, type WorkoutDraftRequest, type StoredWorkoutDraft } from "@/lib/public/workout-draft";

const WORKOUT_TYPES: WorkoutType[] = ["strength", "functional", "hyrox", "crossfit", "conditioning", "custom"];
const VISIBILITIES: WorkoutVisibility[] = ["public", "followers", "gym", "private"];
const WORKOUT_BLOCK_OPTIONS: Array<{ value: WorkoutBlockType; label: string }> = [
  { value: "straight_set", label: "Straight set" },
  { value: "superset", label: "Superset" },
  { value: "circuit", label: "Circuit" },
  { value: "emom", label: "EMOM" },
  { value: "amrap", label: "AMRAP" }
];

type LogExerciseBlock = {
  clientId: string;
  searchQuery: string;
  selectedExercise: ExerciseSearchResult | null;
  stationLabel: string;
  notes: string;
  blockType: WorkoutBlockType;
  reps: string;
  weightKg: string;
  distanceM: string;
  durationSeconds: string;
};

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `log_block_${Math.random().toString(36).slice(2, 11)}`;
}

function createEmptyBlock(overrides?: Partial<LogExerciseBlock>): LogExerciseBlock {
  return {
    clientId: createClientId(),
    searchQuery: "",
    selectedExercise: null,
    stationLabel: "",
    notes: "",
    blockType: "straight_set",
    reps: "",
    weightKg: "",
    distanceM: "",
    durationSeconds: "",
    ...overrides
  };
}

function moveBlock(blocks: LogExerciseBlock[], currentIndex: number, targetIndex: number): LogExerciseBlock[] {
  if (targetIndex < 0 || targetIndex >= blocks.length || currentIndex === targetIndex) {
    return blocks;
  }

  const next = [...blocks];
  const [item] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildBlockNotes(block: LogExerciseBlock): string | undefined {
  const lines: string[] = [];
  const stationLabel = block.stationLabel.trim();
  const notes = block.notes.trim();

  if (stationLabel) {
    lines.push(`Station: ${stationLabel}`);
  }

  if (notes) {
    lines.push(notes);
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function hasMeaningfulMetrics(block: LogExerciseBlock): boolean {
  return Boolean(
    block.reps.trim() ||
      block.weightKg.trim() ||
      block.distanceM.trim() ||
      block.durationSeconds.trim()
  );
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isExerciseExactMatch(query: string, result: ExerciseSearchResult | null | undefined): boolean {
  if (!result) {
    return false;
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return false;
  }

  return (
    normalizeSearchText(result.name) === normalizedQuery ||
    normalizeSearchText(result.slug) === normalizedQuery
  );
}

function pickBestExerciseMatch(
  query: string,
  results: ExerciseSearchResult[]
): ExerciseSearchResult | null {
  if (results.length === 0) {
    return null;
  }

  const normalizedQuery = normalizeSearchText(query);
  const exact = results.find((result) => {
    const normalizedName = normalizeSearchText(result.name);
    const normalizedSlug = normalizeSearchText(result.slug);
    return normalizedName === normalizedQuery || normalizedSlug === normalizedQuery;
  });

  if (exact) {
    return exact;
  }

  const partial = results.find((result) => {
    const normalizedName = normalizeSearchText(result.name);
    const normalizedSlug = normalizeSearchText(result.slug);
    return normalizedName.startsWith(normalizedQuery) || normalizedSlug.startsWith(normalizedQuery);
  });

  return partial ?? results[0] ?? null;
}

function mapTemplateDayToBlocks(day: WorkoutTemplateDay): LogExerciseBlock[] {
  return day.exercises.map((exercise) =>
    createEmptyBlock({
      searchQuery: exercise.exerciseName,
      selectedExercise: {
        id: exercise.exerciseId,
        name: exercise.exerciseName,
        slug: exercise.exerciseSlug,
        category: exercise.category,
        equipment: exercise.equipment,
        movementPattern: null
      },
      stationLabel: exercise.stationLabel || exercise.exerciseName,
      notes: exercise.notes,
      blockType: exercise.blockType,
      reps: exercise.reps ?? "",
      weightKg: typeof exercise.weightKg === "number" ? String(exercise.weightKg) : "",
      distanceM: typeof exercise.distanceM === "number" ? String(exercise.distanceM) : "",
      durationSeconds: typeof exercise.durationSeconds === "number" ? String(exercise.durationSeconds) : ""
    })
  );
}

export function LogScreen() {
  const { state, supabase } = usePublicSession();
  const [context, setContext] = useState<WorkoutLogContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [title, setTitle] = useState("Workout Session");
  const [notes, setNotes] = useState("");
  const [workoutType, setWorkoutType] = useState<WorkoutType>("hyrox");
  const [visibility, setVisibility] = useState<WorkoutVisibility>("private");
  const [gymId, setGymId] = useState("");
  const [sessionRpe, setSessionRpe] = useState("7");
  const [blocks, setBlocks] = useState<LogExerciseBlock[]>([createEmptyBlock()]);
  const [exerciseResults, setExerciseResults] = useState<Record<string, ExerciseSearchResult[]>>({});
  const [searchingByBlock, setSearchingByBlock] = useState<Record<string, boolean>>({});
  const [hyroxPresetKey, setHyroxPresetKey] = useState<HyroxPresetKey>("singles_women_open");
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesReady, setTemplatesReady] = useState(false);
  const [templateOwner, setTemplateOwner] = useState<string | null>(null);
  const [loadingHandoff, setLoadingHandoff] = useState(false);
  const handoffRef = useRef<string | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplateDayId, setSelectedTemplateDayId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateDayLabel, setTemplateDayLabel] = useState("Day 1");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [saveUncertain, setSaveUncertain] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofPending, setProofPending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sessionGuidance, setSessionGuidance] = useState<string | null>(null);
  const viewerId = state.user?.id ?? null;
  const viewerRef = useRef(viewerId);
  viewerRef.current = viewerId;
  const generationRef = useRef(0);
  const [editorOwner, setEditorOwner] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const submissionRef = useRef(false);
  const receiptRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimersRef = useRef<Record<string, number>>({});
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<StoredWorkoutDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftRequest, setDraftRequest] = useState<WorkoutDraftRequest | null>(null);

  function clearConfirmedDraft(owner: string) {
    try {
      discardWorkoutDraft(window.sessionStorage, owner);
      if (viewerRef.current === owner) setDraftStatus(null);
    }
    catch { if (viewerRef.current === owner) setDraftStatus("Workout saved, but the tab draft could not be removed. Clear it before logging another workout."); }
  }

  function isCurrentViewer(owner: string, generation: number) {
    return viewerRef.current === owner && generationRef.current === generation;
  }

  async function hydrateReceipt(workoutId: string, owner: string, generation: number) {
    if (!isCurrentViewer(owner, generation) || submissionRef.current) return;
    submissionRef.current = true;
    setReceiptLoading(true);
    setReceiptError(null);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || auth.data.user?.id !== owner) throw new Error("Session changed.");
      if (!isCurrentViewer(owner, generation)) return;
      const { data, error: loadError } = await supabase.from("workouts")
        .select("id,title,visibility,gym_id").eq("id", workoutId).eq("user_id", owner).maybeSingle();
      const verified = await supabase.auth.getUser();
      if (!isCurrentViewer(owner, generation)) return;
      if (verified.error || verified.data.user?.id !== owner || loadError || !data || data.id !== workoutId ||
          !VISIBILITIES.includes(data.visibility as WorkoutVisibility)) throw new Error("Receipt unavailable.");
      setTitle(data.title || "Saved workout");
      setVisibility(data.visibility as WorkoutVisibility);
      setGymId(data.gym_id ?? "");
      setSavedWorkoutId(workoutId);
      clearConfirmedDraft(owner);
      setSuccess("This workout was already saved. To finish a pending upload, select the same original files in the same order.");
    } catch {
      if (isCurrentViewer(owner, generation)) setReceiptError("Your saved workout and its audience could not be verified. Retry before making changes.");
    } finally {
      if (isCurrentViewer(owner, generation)) {
        submissionRef.current = false;
        setReceiptLoading(false);
      }
    }
  }

  useEffect(() => {
    const generation = ++generationRef.current;
    setEditorOwner(viewerId);
    setDraftOwner(null); setDraftEnabled(false); setPendingDraft(null); setDraftStatus(null); setDraftBusy(false);
    setDraftRequest(null);
    submissionRef.current = false;
    receiptRef.current = null;
    handoffRef.current = null;
    setContext(null);
    setLoadingContext(true);
    setTitle("Workout Session"); setNotes(""); setWorkoutType("hyrox"); setVisibility("private");
    setGymId(""); setSessionRpe("7"); setHyroxPresetKey("singles_women_open");
    setBlocks([createEmptyBlock()]); setSessionGuidance(null);
    clearAllSearchState();
    setTemplates([]); setTemplatesReady(false); setTemplateOwner(null); setLoadingTemplates(false);
    setSelectedTemplateId(""); setSelectedTemplateDayId("");
    setTemplateName(""); setTemplateDescription(""); setTemplateDayLabel("Day 1");
    setTemplateLoadError(null); setLoadingHandoff(false);
    setApplyingPreset(false); setSavingTemplate(false); setDeletingTemplate(false); setImportingTemplate(false);
    setSubmitting(false); setProofPending(false); setSharing(false);
    setError(null); setSuccess(null); setReceiptError(null); setReceiptLoading(false);
    setSavedWorkoutId(null);
    setSaveUncertain(false);
    setProofFiles([]);
    setProofError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (templateFileInputRef.current) templateFileInputRef.current.value = "";
    if (!viewerId) return () => { generationRef.current++; };
    try {
      const receipt = window.sessionStorage.getItem(`kruxt:workout-receipt:${viewerId}`);
      if (receipt === "unconfirmed") { setSaveUncertain(true); setError(new WorkoutSaveUncertainError().message); }
      else if (receipt) {
        receiptRef.current = receipt;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt)) {
          void hydrateReceipt(receipt, viewerId, generation);
        } else {
          setReceiptError("The saved workout reference could not be verified. Check your activity before continuing.");
        }
      }
    } catch { /* Storage is optional; the in-memory receipt still protects this session. */ }
    return () => { generationRef.current++; };
  }, [viewerId, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !viewerId) return;
    const owner = viewerId;
    const generation = generationRef.current;
    let active = true;
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!active || !isCurrentViewer(owner, generation)) return;
        if (auth.error || auth.data.user?.id !== owner) throw new Error("Session could not be verified. Reload before recovering a draft.");
        setDraftOwner(owner);
        const freshRequest = { idempotencyKey: crypto.randomUUID(), startedAt: new Date().toISOString() };
        setDraftRequest(freshRequest);
        try {
          const draft = readWorkoutDraft(window.sessionStorage, owner);
          setDraftRequest(readWorkoutDraftRequest(window.sessionStorage, owner) ?? draft?.data.request ?? freshRequest);
          if (!receiptRef.current) setPendingDraft(draft);
        } catch { setDraftStatus("Tab storage is unavailable. Draft recovery is off; keep this page open."); }
      } catch { if (active && isCurrentViewer(owner, generation)) setDraftStatus("Session could not be verified. Reload before recovering a draft."); }
    })();
    return () => { active = false; };
  }, [viewerId, state.status, supabase]);

  const draftData = useMemo(() => draftRequest && ({ request: draftRequest, title, notes, workoutType, gymId, sessionRpe, sessionGuidance, blocks }),
    [draftRequest, title, notes, workoutType, gymId, sessionRpe, sessionGuidance, blocks]);

  useEffect(() => {
    if (!viewerId || !draftData || draftOwner !== viewerId || !draftEnabled || pendingDraft || savedWorkoutId ||
        receiptRef.current || submitting || loadingHandoff || state.status !== "ready") return;
    const owner = viewerId;
    const generation = generationRef.current;
    let active = true;
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!active || !isCurrentViewer(owner, generation) || receiptRef.current || submissionRef.current) return;
        if (auth.error || auth.data.user?.id !== owner) throw new Error();
        writeWorkoutDraft(window.sessionStorage, owner, draftData, saveUncertain ? "unconfirmed" : "editing");
        setDraftStatus("Draft kept in this tab. Files are not included.");
      } catch { if (active && isCurrentViewer(owner, generation)) setDraftStatus("Draft recovery could not be updated. Keep this page open or turn recovery off to remove the older copy."); }
    })();
    return () => { active = false; };
  }, [viewerId, draftOwner, draftEnabled, pendingDraft, savedWorkoutId, submitting, loadingHandoff, state.status, draftData, saveUncertain, supabase]);

  async function resolveDraft(restore: boolean) {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || draftOwner !== owner || draftBusy) return;
    setDraftBusy(true);
    if (!restore) {
      // Removing local sensitive content must not depend on network availability.
      setDraftEnabled(false);
      try {
        discardWorkoutDraft(window.sessionStorage, owner);
        setPendingDraft(null);
        setDraftStatus("Tab draft removed. Recovery is off.");
      } catch {
        setDraftStatus("Recovery is off, but this tab's stored draft could not be removed. Close the tab to clear its storage.");
      } finally { setDraftBusy(false); }
      return;
    }
    try {
      const auth = await supabase.auth.getUser();
      if (!isCurrentViewer(owner, generation)) return;
      if (auth.error || auth.data.user?.id !== owner) throw new Error();
      if (restore) {
        const draft = readWorkoutDraft(window.sessionStorage, owner);
        if (!draft) { setPendingDraft(null); setDraftStatus("The draft expired or is no longer available."); return; }
        const data = draft.data;
        setDraftRequest(readWorkoutDraftRequest(window.sessionStorage, owner) ?? data.request);
        clearAllSearchState();
        setTitle(data.title); setNotes(data.notes); setWorkoutType(data.workoutType); setGymId(data.gymId);
        setSessionRpe(data.sessionRpe); setSessionGuidance(data.sessionGuidance); setBlocks(data.blocks);
        setVisibility("private"); setProofFiles([]);
        handoffRef.current = `${owner}:${window.location.search}`;
        if (draft.saveState === "unconfirmed") {
          setSaveUncertain(true); setError(new WorkoutSaveUncertainError().message);
        }
        setDraftEnabled(true);
        setDraftStatus("Draft restored privately. Reselect any proof files.");
      }
      setPendingDraft(null);
    } catch { if (isCurrentViewer(owner, generation)) setDraftStatus("Draft recovery unavailable. Your session may have changed or tab storage is blocked. Reload to verify."); }
    finally { if (isCurrentViewer(owner, generation)) setDraftBusy(false); }
  }

  function persistReceipt(value: string | null, owner = viewerId) {
    if (!owner) return;
    try {
      const key = `kruxt:workout-receipt:${owner}`;
      if (value) window.sessionStorage.setItem(key, value); else window.sessionStorage.removeItem(key);
    } catch { /* No workout content or media is stored in browser storage. */ }
  }

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;
    const owner = state.user.id;
    const generation = generationRef.current;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const nextContext = await loadWorkoutLogContext(supabase);
        if (!active || !isCurrentViewer(owner, generation)) return;
        setContext(nextContext);
        if (!receiptRef.current) setGymId((current) => current || nextContext.homeGymId || nextContext.gyms[0]?.id || "");
      } catch (loadError) {
        if (!active || !isCurrentViewer(owner, generation)) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load workout context.");
      } finally {
        if (!active || !isCurrentViewer(owner, generation)) return;
        setLoadingContext(false);
      }
    }

    void loadContext();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;
    const owner = state.user.id;
    const generation = generationRef.current;

    async function loadTemplates() {
      setLoadingTemplates(true);
      setTemplatesReady(false);
      setTemplateOwner(null);
      setTemplateLoadError(null);
      try {
        const nextTemplates = await loadWorkoutTemplates(supabase);
        const auth = await supabase.auth.getUser();
        if (!active || !isCurrentViewer(owner, generation)) return;
        if (auth.error || auth.data.user?.id !== owner) throw new Error("Session changed. Reload your templates.");
        setTemplates(nextTemplates);
        setTemplateOwner(owner);
      } catch (loadError) {
        if (!active || !isCurrentViewer(owner, generation)) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load workout templates.";
        setTemplateLoadError(
          /user_workout_templates/i.test(message)
            ? "Workout templates are not ready yet. Apply the user_workout_templates migration in Supabase first."
            : message
        );
      } finally {
        if (!active || !isCurrentViewer(owner, generation)) return;
        setLoadingTemplates(false);
        setTemplatesReady(true);
      }
    }

    void loadTemplates();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user || draftOwner !== viewerId || pendingDraft) return;
    const params = new URLSearchParams(window.location.search);
    if (!["planId", "templateId", "session", "dayId"].some((key) => params.has(key))) return;
    const handoff = parseWorkoutHandoff(params);
    if (!handoff) { setError("This session link is invalid. Return to Plan or Library to choose a session."); return; }
    if (handoff.kind === "template" && (!templatesReady || templateOwner !== state.user.id)) return;
    const key = `${state.user.id}:${window.location.search}`;
    if (handoffRef.current === key || receiptRef.current) return;
    let active = true;
    const owner = state.user.id;
    const generation = generationRef.current;
    setLoadingHandoff(true);
    async function applyHandoff() {
      try {
        if (!handoff) return;
        if (handoff.kind === "template") {
          const template = templates.find((item) => item.id === handoff.templateId);
          const day = template?.days.find((item) => item.id === handoff.dayId);
          if (!template || !day) throw new Error("This saved session is no longer available. Choose another session in Library.");
          if (!active || !isCurrentViewer(owner, generation)) return;
          setSelectedTemplateId(template.id); setSelectedTemplateDayId(day.id);
          setBlocks(mapTemplateDayToBlocks(day)); setTitle(`${template.name} · ${day.label}`);
          setWorkoutType(template.workoutType); setSessionGuidance(day.notes || template.description || null); setNotes("");
        } else {
          const plan = await loadTrainingPlanForWorkout(supabase, handoff.planId);
          const day = plan.days.find((item) => item.id === handoff.dayId);
          if (!day || !day.blocks.length) throw new Error("This plan day is no longer available. Return to your plan.");
          const next = await Promise.all(day.blocks.map(async (block) => {
            const results = await searchExercises(supabase, block.exercise);
            const exact = results.find((exercise) => isExerciseExactMatch(block.exercise, exercise)) ?? null;
            return createEmptyBlock({ searchQuery: block.exercise, selectedExercise: exact, stationLabel: block.exercise });
          }));
          if (!active || !isCurrentViewer(owner, generation)) return;
          setBlocks(next); setTitle(`${plan.title} · ${day.label}`); setWorkoutType("strength");
          setSessionGuidance([plan.coachNotes, day.focus, day.notes, ...day.blocks.map((block) => [block.exercise, block.target, block.notes].filter(Boolean).join(" - "))].filter(Boolean).join("\n"));
          setNotes(""); setGymId(plan.gymId);
        }
        handoffRef.current = key;
        setSuccess("Session loaded. Review the exercise targets and record your completed work.");
      } catch (handoffError) {
        if (active && isCurrentViewer(owner, generation)) setError(handoffError instanceof Error ? handoffError.message : "Session could not be loaded.");
      } finally {
        if (active && isCurrentViewer(owner, generation)) setLoadingHandoff(false);
      }
    }
    void applyHandoff();
    return () => { active = false; };
  }, [state.status, state.user, supabase, templatesReady, templates, templateOwner, draftOwner, viewerId, pendingDraft]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(searchTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const selectedGymName = useMemo(
    () => context?.gyms.find((gym) => gym.id === gymId)?.name ?? null,
    [context?.gyms, gymId]
  );

  const activeBlocks = useMemo(
    () => blocks.filter((block) => block.selectedExercise),
    [blocks]
  );
  const selectedTemplate = useMemo(
    () => templateOwner === viewerId ? templates.find((template) => template.id === selectedTemplateId) ?? null : null,
    [templates, selectedTemplateId, templateOwner, viewerId]
  );
  const selectedTemplateDay = useMemo(
    () =>
      selectedTemplate?.days.find((day) => day.id === selectedTemplateDayId) ??
      selectedTemplate?.days[0] ??
      null,
    [selectedTemplate, selectedTemplateDayId]
  );

  const selectedPresetDetail = useMemo(
    () => HYROX_PRESET_OPTIONS.find((option) => option.key === hyroxPresetKey)?.detail ?? "",
    [hyroxPresetKey]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    setTemplateName(selectedTemplate.name);
    setTemplateDescription(selectedTemplate.description ?? "");
    if (!selectedTemplate.days.some((day) => day.id === selectedTemplateDayId)) {
      setSelectedTemplateDayId(selectedTemplate.days[0]?.id ?? "");
    }
  }, [selectedTemplate, selectedTemplateDayId]);

  useEffect(() => {
    if (selectedTemplateDay) {
      setTemplateDayLabel(selectedTemplateDay.label);
    } else if (!selectedTemplateId) {
      setTemplateDayLabel("Day 1");
    }
  }, [selectedTemplateDay, selectedTemplateId]);

  function updateBlockState(clientId: string, updater: (current: LogExerciseBlock) => LogExerciseBlock) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.clientId === clientId ? updater(block) : block))
    );
  }

  function clearBlockSearch(clientId: string) {
    if (searchTimersRef.current[clientId]) {
      clearTimeout(searchTimersRef.current[clientId]);
      delete searchTimersRef.current[clientId];
    }

    setSearchingByBlock((current) => ({ ...current, [clientId]: false }));
    setExerciseResults((current) => ({ ...current, [clientId]: [] }));
  }

  function clearAllSearchState() {
    for (const timer of Object.values(searchTimersRef.current)) {
      clearTimeout(timer);
    }

    searchTimersRef.current = {};
    setSearchingByBlock({});
    setExerciseResults({});
  }

  function upsertTemplate(nextTemplate: WorkoutTemplate) {
    setTemplates((current) => {
      const existingIndex = current.findIndex((template) => template.id === nextTemplate.id);
      if (existingIndex === -1) {
        return [...current, nextTemplate].sort((left, right) => left.name.localeCompare(right.name));
      }

      const next = [...current];
      next[existingIndex] = nextTemplate;
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
  }

  function buildTemplateDaysFromCurrentBlocks(): WorkoutTemplateDay[] {
    const selectedBlocks = blocks.filter((block) => block.selectedExercise);
    if (selectedBlocks.length === 0) {
      throw new Error("Select at least one exercise block before saving a template.");
    }

    const nextDay: WorkoutTemplateDay = {
      id: selectedTemplateDay?.id ?? createClientId(),
      label: templateDayLabel.trim() || `Day ${(selectedTemplate?.days.length ?? 0) + 1}`,
      notes: notes.trim(),
      exercises: selectedBlocks.map((block) => ({
        exerciseId: block.selectedExercise!.id,
        exerciseName: block.selectedExercise!.name,
        exerciseSlug: block.selectedExercise!.slug,
        category: block.selectedExercise!.category,
        equipment: block.selectedExercise!.equipment,
        stationLabel: block.stationLabel.trim() || block.selectedExercise!.name,
        notes: block.notes.trim(),
        blockType: block.blockType,
        reps: block.reps.trim() || undefined,
        weightKg: parseOptionalNumber(block.weightKg),
        distanceM: parseOptionalNumber(block.distanceM),
        durationSeconds: parseOptionalNumber(block.durationSeconds)
      }))
    };

    if (!selectedTemplate) {
      return [nextDay];
    }

    const existingIndex = selectedTemplate.days.findIndex((day) => day.id === nextDay.id);
    if (existingIndex === -1) {
      return [...selectedTemplate.days, nextDay];
    }

    const nextDays = [...selectedTemplate.days];
    nextDays[existingIndex] = nextDay;
    return nextDays;
  }

  function handleSearchChange(clientId: string, value: string) {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || editorOwner !== owner) return;
    updateBlockState(clientId, (current) => ({
      ...current,
      searchQuery: value,
      selectedExercise: isExerciseExactMatch(value, current.selectedExercise) ? current.selectedExercise : null
    }));
    setError(null);

    clearBlockSearch(clientId);

    const query = value.trim();
    if (query.length < 2) {
      return;
    }

    setSearchingByBlock((current) => ({ ...current, [clientId]: true }));
    searchTimersRef.current[clientId] = window.setTimeout(async () => {
      if (!isCurrentViewer(owner, generation)) return;
      try {
        const results = await searchExercises(supabase, query);
        if (!isCurrentViewer(owner, generation)) return;
        const exactMatch = results.find((result) => isExerciseExactMatch(query, result)) ?? null;

        if (exactMatch) {
          updateBlockState(clientId, (current) => ({
            ...current,
            selectedExercise: exactMatch,
            searchQuery: exactMatch.name,
            stationLabel: current.stationLabel || exactMatch.name
          }));
          setExerciseResults((current) => ({ ...current, [clientId]: [] }));
        } else {
          setExerciseResults((current) => ({ ...current, [clientId]: results }));
        }
      } catch (searchError) {
        if (isCurrentViewer(owner, generation)) setError(searchError instanceof Error ? searchError.message : "Unable to search exercises.");
      } finally {
        if (isCurrentViewer(owner, generation)) setSearchingByBlock((current) => ({ ...current, [clientId]: false }));
      }
    }, 220);
  }

  function handleSelectExercise(clientId: string, result: ExerciseSearchResult) {
    updateBlockState(clientId, (current) => ({
      ...current,
      selectedExercise: result,
      searchQuery: result.name,
      stationLabel: current.stationLabel || result.name
    }));
    clearBlockSearch(clientId);
  }

  function handleAddBlock() {
    setBlocks((current) => [...current, createEmptyBlock()]);
  }

  function handleRemoveBlock(clientId: string) {
    clearBlockSearch(clientId);
    setBlocks((current) => {
      const filtered = current.filter((block) => block.clientId !== clientId);
      return filtered.length > 0 ? filtered : [createEmptyBlock()];
    });
  }

  async function handleApplyHyroxPreset() {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || editorOwner !== owner) return;
    setApplyingPreset(true);
    setError(null);
    setSuccess(null);

    try {
      const exerciseMap = await loadExercisesBySlugs(supabase, Array.from(HYROX_REQUIRED_EXERCISE_SLUGS));
      if (!isCurrentViewer(owner, generation)) return;
      const preset = buildHyroxPreset(hyroxPresetKey);
      const missingSlugs = Array.from(HYROX_REQUIRED_EXERCISE_SLUGS).filter((slug) => !exerciseMap.has(slug));

      if (missingSlugs.length > 0) {
        throw new Error(
          "The HYROX preset cannot be applied yet because the seeded exercise catalog is missing required exercises. Apply the exercise catalog migration in Supabase first."
        );
      }

      clearAllSearchState();
      setBlocks(
        preset.exercises.map((exercise) => {
          const selectedExercise = exerciseMap.get(exercise.slug) ?? null;
          return createEmptyBlock({
            searchQuery: selectedExercise?.name ?? exercise.label,
            selectedExercise,
            stationLabel: exercise.label,
            notes: exercise.notes ?? "",
            blockType: exercise.blockType,
            reps: exercise.set.reps ? String(exercise.set.reps) : "",
            weightKg: exercise.set.weightKg ? String(exercise.set.weightKg) : "",
            distanceM: exercise.set.distanceM ? String(exercise.set.distanceM) : "",
            durationSeconds: exercise.set.durationSeconds ? String(exercise.set.durationSeconds) : ""
          });
        })
      );
      setTitle(preset.title);
      setWorkoutType("hyrox");
      setSuccess("HYROX template applied. You can now remove stations, reorder them, or edit any weight and distance.");
    } catch (presetError) {
      if (isCurrentViewer(owner, generation)) setError(presetError instanceof Error ? presetError.message : "Unable to apply HYROX template.");
    } finally {
      if (isCurrentViewer(owner, generation)) setApplyingPreset(false);
    }
  }

  function handleStartNewTemplateDraft() {
    setSelectedTemplateId("");
    setSelectedTemplateDayId("");
    setTemplateName("");
    setTemplateDescription("");
    setTemplateDayLabel("Day 1");
    setTemplateLoadError(null);
  }

  async function handleApplySelectedTemplateDay() {
    if (!viewerId || templateOwner !== viewerId || !selectedTemplate || !selectedTemplateDay) {
      setError("Select a template day before applying it.");
      return;
    }

    clearAllSearchState();
    setBlocks(mapTemplateDayToBlocks(selectedTemplateDay));
    setTitle(`${selectedTemplate.name} · ${selectedTemplateDay.label}`);
    setWorkoutType(selectedTemplate.workoutType);
    setNotes(selectedTemplateDay.notes || selectedTemplate.description || "");
    setSuccess(`Applied ${selectedTemplate.name} · ${selectedTemplateDay.label}.`);
    setError(null);
  }

  async function handleSaveTemplate() {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || editorOwner !== owner) return;
    setSavingTemplate(true);
    setError(null);
    setSuccess(null);

    try {
      const nextTemplate = await saveWorkoutTemplate(supabase, {
        templateId: selectedTemplate?.id,
        name: templateName.trim() || title.trim() || "Workout template",
        description: templateDescription.trim(),
        workoutType,
        days: buildTemplateDaysFromCurrentBlocks()
      });

      if (!isCurrentViewer(owner, generation)) return;
      upsertTemplate(nextTemplate);
      setTemplateOwner(owner);
      setSelectedTemplateId(nextTemplate.id);
      setSelectedTemplateDayId(nextTemplate.days.at(-1)?.id ?? "");
      setTemplateName(nextTemplate.name);
      setTemplateDescription(nextTemplate.description ?? "");
      setSuccess(`Saved template ${nextTemplate.name}.`);
    } catch (templateError) {
      if (isCurrentViewer(owner, generation)) setError(templateError instanceof Error ? templateError.message : "Unable to save template.");
    } finally {
      if (isCurrentViewer(owner, generation)) setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate() {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || templateOwner !== owner || !selectedTemplate) {
      setError("Select a template before deleting it.");
      return;
    }

    setDeletingTemplate(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteWorkoutTemplate(supabase, selectedTemplate.id);
      if (!isCurrentViewer(owner, generation)) return;
      setTemplates((current) => current.filter((template) => template.id !== selectedTemplate.id));
      handleStartNewTemplateDraft();
      setSuccess(`Deleted template ${selectedTemplate.name}.`);
    } catch (templateError) {
      if (isCurrentViewer(owner, generation)) setError(templateError instanceof Error ? templateError.message : "Unable to delete template.");
    } finally {
      if (isCurrentViewer(owner, generation)) setDeletingTemplate(false);
    }
  }

  async function handleImportPlanFile(event: React.ChangeEvent<HTMLInputElement>) {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || editorOwner !== owner) return;
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportingTemplate(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedPlan = parseWorkoutPlanFile(file.name, await file.text());
      if (!isCurrentViewer(owner, generation)) return;
      const unresolvedQueries: string[] = [];
      const resolvedDays: WorkoutTemplateDay[] = [];

      for (const [dayIndex, day] of parsedPlan.days.entries()) {
        const resolvedExercises = [];

        for (const exercise of day.exercises) {
          const results = await searchExercises(supabase, exercise.query);
          if (!isCurrentViewer(owner, generation)) return;
          const match = pickBestExerciseMatch(exercise.query, results);

          if (!match) {
            unresolvedQueries.push(`${day.label}: ${exercise.query}`);
            continue;
          }

          resolvedExercises.push({
            exerciseId: match.id,
            exerciseName: match.name,
            exerciseSlug: match.slug,
            category: match.category,
            equipment: match.equipment,
            stationLabel: exercise.stationLabel || match.name,
            notes: exercise.notes,
            blockType: exercise.blockType,
            reps: exercise.reps,
            weightKg: parseOptionalNumber(exercise.weightKg ?? ""),
            distanceM: parseOptionalNumber(exercise.distanceM ?? ""),
            durationSeconds: parseOptionalNumber(exercise.durationSeconds ?? "")
          });
        }

        if (resolvedExercises.length > 0) {
          resolvedDays.push({
            id: day.id || createClientId(),
            label: day.label || `Day ${dayIndex + 1}`,
            notes: day.notes,
            exercises: resolvedExercises
          });
        }
      }

      if (resolvedDays.length === 0) {
        throw new Error("No imported exercises could be matched to the exercise catalogue.");
      }

      if (unresolvedQueries.length > 0) {
        throw new Error(
          `Some imported exercises could not be matched yet: ${unresolvedQueries.slice(0, 6).join(", ")}${unresolvedQueries.length > 6 ? "..." : ""}`
        );
      }

      const savedTemplate = await saveWorkoutTemplate(supabase, {
        name: parsedPlan.name,
        description: parsedPlan.description,
        workoutType: parsedPlan.workoutType,
        days: resolvedDays
      });

      if (!isCurrentViewer(owner, generation)) return;
      upsertTemplate(savedTemplate);
      setTemplateOwner(owner);
      setSelectedTemplateId(savedTemplate.id);
      setSelectedTemplateDayId(savedTemplate.days[0]?.id ?? "");
      setTemplateName(savedTemplate.name);
      setTemplateDescription(savedTemplate.description ?? "");
      setTemplateDayLabel(savedTemplate.days[0]?.label ?? "Day 1");

      if (savedTemplate.days[0]) {
        clearAllSearchState();
        setBlocks(mapTemplateDayToBlocks(savedTemplate.days[0]));
        setTitle(`${savedTemplate.name} · ${savedTemplate.days[0].label}`);
        setWorkoutType(savedTemplate.workoutType);
        setNotes(savedTemplate.days[0].notes || savedTemplate.description || "");
      }

      setSuccess(`Imported plan ${savedTemplate.name} with ${savedTemplate.days.length} day${savedTemplate.days.length === 1 ? "" : "s"}.`);
    } catch (importError) {
      if (isCurrentViewer(owner, generation)) setError(importError instanceof Error ? importError.message : "Unable to import workout plan.");
    } finally {
      if (isCurrentViewer(owner, generation)) {
        setImportingTemplate(false);
        event.target.value = "";
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || !isCurrentViewer(owner, generation) || editorOwner !== owner || state.status !== "ready" || submissionRef.current || receiptRef.current ||
        !draftData || !draftRequest || draftOwner !== owner || pendingDraft || saveUncertain || receiptLoading || receiptError || loadingContext || loadingHandoff) return;

    const incompleteBlocks = blocks.filter(
      (block) => (block.searchQuery.trim() || hasMeaningfulMetrics(block)) && !block.selectedExercise
    );
    if (incompleteBlocks.length > 0) {
      setError("Pick a valid exercise for every filled block or clear the incomplete block.");
      return;
    }

    const selectedBlocks = blocks.filter((block) => block.selectedExercise);
    if (selectedBlocks.length === 0) {
      setError("Add at least one exercise block before submitting.");
      return;
    }

    const blocksWithoutMetrics = selectedBlocks.filter((block) => !hasMeaningfulMetrics(block));
    if (blocksWithoutMetrics.length > 0) {
      setError("Each selected block needs at least reps, weight, distance, or duration.");
      return;
    }

    if (selectedBlocks.some((block) => [block.reps, block.weightKg, block.distanceM, block.durationSeconds]
      .some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))) ||
      !Number.isFinite(Number(sessionRpe)) || Number(sessionRpe) < 1 || Number(sessionRpe) > 10) {
      setError("Use non-negative numbers for completed work and an effort rating from 1 to 10."); return;
    }

    submissionRef.current = true;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const workoutRpeValue = parseOptionalNumber(sessionRpe);
      const auth = await supabase.auth.getUser();
      if (!isCurrentViewer(owner, generation)) return;
      if (auth.error || auth.data.user?.id !== owner) throw new Error("Session changed. Reload before saving.");
      try { writeWorkoutDraftRequest(window.sessionStorage, owner, draftRequest); }
      catch { setDraftStatus("Submission recovery metadata could not be stored. Keep this page open until saving is confirmed."); }
      if (draftEnabled) {
        try { writeWorkoutDraft(window.sessionStorage, owner, draftData, "unconfirmed"); }
        catch { setDraftStatus("Draft recovery could not be updated. Keep this page open."); }
      }
      persistReceipt("unconfirmed", owner);
      const result = await submitWorkout(supabase, {
        idempotencyKey: draftRequest.idempotencyKey,
        title,
        notes,
        workoutType,
        visibility: "private",
        gymId: gymId || context?.homeGymId || null,
        startedAt: draftRequest.startedAt,
        rpe: workoutRpeValue,
        exercises: selectedBlocks.map((block) => {
          const repsValue = parseOptionalNumber(block.reps);
          const weightValue = parseOptionalNumber(block.weightKg);
          const distanceValue = parseOptionalNumber(block.distanceM);
          const durationValue = parseOptionalNumber(block.durationSeconds);

          return {
            exerciseId: block.selectedExercise!.id,
            blockType: block.blockType,
            targetReps: block.reps.trim() || undefined,
            targetWeightKg: weightValue,
            notes: buildBlockNotes(block),
            set: {
              reps: repsValue,
              weightKg: weightValue,
              distanceM: distanceValue,
              durationSeconds: durationValue,
              rpe: workoutRpeValue
            }
          };
        })
      }, owner);

      persistReceipt(result.workoutId, owner);
      clearConfirmedDraft(owner);
      if (!isCurrentViewer(owner, generation)) return;
      receiptRef.current = result.workoutId;
      setSavedWorkoutId(result.workoutId);
      setSuccess(result.progressAvailable
        ? `Workout saved. ${result.xpDelta.xpAfter - result.xpDelta.xpBefore} XP earned.`
        : "Workout saved. Progress totals are temporarily unavailable.");
      setVisibility("private");
      if (proofFiles.length > 0) {
        setProofPending(true);
        try {
          await uploadWorkoutProofMedia(supabase, { workoutId: result.workoutId, files: proofFiles, expectedUserId: owner });
          if (isCurrentViewer(owner, generation)) setProofFiles([]);
        } catch {
          if (isCurrentViewer(owner, generation)) setProofError("Your workout is saved. Some attachments could not be uploaded; retry them without saving the workout again.");
        } finally {
          if (isCurrentViewer(owner, generation)) setProofPending(false);
        }
      }
    } catch (submitError) {
      if (!isCurrentViewer(owner, generation)) return;
      if (submitError instanceof WorkoutSaveUncertainError) setSaveUncertain(true);
      else persistReceipt(null, owner);
      setError(submitError instanceof Error ? submitError.message : "Unable to log workout.");
    } finally {
      if (isCurrentViewer(owner, generation)) {
        submissionRef.current = false;
        setSubmitting(false);
      }
    }
  }

  async function retryProof() {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || !isCurrentViewer(owner, generation) || editorOwner !== owner || state.status !== "ready" || receiptLoading || receiptError || !savedWorkoutId || submissionRef.current) return;
    submissionRef.current = true;
    setProofPending(true);
    try {
      await uploadWorkoutProofMedia(supabase, { workoutId: savedWorkoutId, files: proofFiles, expectedUserId: owner });
      if (!isCurrentViewer(owner, generation)) return;
      setProofFiles([]);
      setProofError(null);
    } catch {
      if (isCurrentViewer(owner, generation)) setProofError("Some attachments are still pending. Your saved workout is unchanged.");
    } finally {
      if (isCurrentViewer(owner, generation)) {
        submissionRef.current = false;
        setProofPending(false);
      }
    }
  }

  async function shareWorkout() {
    const owner = viewerId;
    const generation = generationRef.current;
    if (!owner || !isCurrentViewer(owner, generation) || editorOwner !== owner || state.status !== "ready" || receiptLoading || receiptError || !savedWorkoutId || submissionRef.current) return;
    submissionRef.current = true;
    setSharing(true);
    setError(null);
    try {
      await updateWorkoutAudience(supabase, savedWorkoutId, visibility, owner);
      if (!isCurrentViewer(owner, generation)) return;
      setSuccess(visibility === "private" ? "Workout is private." : `Audience updated: ${visibility}.`);
    } catch (shareError) {
      if (isCurrentViewer(owner, generation)) setError(shareError instanceof Error ? shareError.message : "Audience change unavailable.");
    } finally {
      if (isCurrentViewer(owner, generation)) {
        submissionRef.current = false;
        setSharing(false);
      }
    }
  }

  if (editorOwner !== viewerId || receiptLoading || receiptError) {
    return (
      <MemberShell title="Workout Log" subtitle="Checking your session">
        {receiptError && editorOwner === viewerId ? (
          <section className="glass-panel" role="alert">
            <p>{receiptError}</p>
            <button type="button" className="secondary-cta" onClick={() => {
              if (viewerId && receiptRef.current) void hydrateReceipt(receiptRef.current, viewerId, generationRef.current);
            }}>Retry saved workout</button>
            <Link href="/feed" className="secondary-cta">Check activity</Link>
          </section>
        ) : <p role="status">Checking your saved workout and audience...</p>}
      </MemberShell>
    );
  }

  if (savedWorkoutId) {
    return (
      <MemberShell title="Session complete" subtitle={title}>
        <section className="session-receipt" aria-labelledby="saved-title">
          <h2 id="saved-title" className="section-title">Workout saved</h2>
          <p role="status">{success}</p>
          {draftStatus ? <p role="status">{draftStatus}</p> : null}
          {proofPending ? <p role="status">Uploading attachments...</p> : null}
          {proofError ? <div role="alert"><p>{proofError}</p><button className="secondary-cta" disabled={proofPending} onClick={() => void retryProof()}>Retry attachments</button></div> : null}
          {!proofPending && proofFiles.length === 0 ? <div>
            <label className="label" htmlFor="resume-attachments">Resume pending attachments</label>
            <input id="resume-attachments" className="input" type="file" accept="image/*,video/*" multiple disabled={sharing} onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 4 || files.some((file) => file.size > 50 * 1024 * 1024)) {
                setError("Choose up to 4 files, 50 MB each."); return;
              }
              setProofFiles(files); setProofError(files.length ? "Attachments selected. Retry to finish uploading them." : null);
            }} />
          </div> : null}
          <div className="session-sharing">
            <label className="label" htmlFor="saved-audience">Audience</label>
            <select id="saved-audience" className="input" value={visibility} disabled={sharing} onChange={(event) => setVisibility(event.target.value as WorkoutVisibility)}>
              {VISIBILITIES.filter((option) => option !== "gym" || gymId).map((option) => <option key={option} value={option}>{option === "private" ? "Only me" : option === "gym" ? "My gym" : option === "followers" ? "Accepted followers" : "Everyone"}</option>)}
            </select>
            <button className="primary-cta" onClick={() => void shareWorkout()} disabled={sharing || proofPending}>{sharing ? "Updating..." : visibility === "private" ? "Keep private" : "Share workout"}</button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <div className="stack-actions">
            <Link href="/feed" className="secondary-cta">View activity</Link>
            <button className="secondary-cta" disabled={submitting || sharing || proofPending} onClick={() => {
              if (proofFiles.length && !window.confirm("Some attachments have not uploaded. Start another workout and discard those pending files?")) return;
              receiptRef.current = null;
              persistReceipt(null);
              try { if (viewerId) clearWorkoutDraftRequest(window.sessionStorage, viewerId); } catch { /* The new request below replaces metadata on submission. */ }
              setDraftRequest({ idempotencyKey: crypto.randomUUID(), startedAt: new Date().toISOString() });
              setSavedWorkoutId(null);
              setDraftEnabled(false); setDraftStatus(null);
              setBlocks([createEmptyBlock()]);
              setNotes(""); setSessionGuidance(null); setProofFiles([]); setProofError(null); setSuccess(null); setError(null);
              setVisibility("private");
            }}>Start another workout</button>
          </div>
        </section>
      </MemberShell>
    );
  }

  if (viewerId && (draftOwner !== viewerId || pendingDraft)) {
    return <MemberShell title="Workout Log" subtitle="Draft recovery">
      {draftOwner !== viewerId ? <p role="status">{draftStatus || "Verifying your session..."}</p> : <section className="glass-panel">
        <h2 className="section-title">Recover this tab's workout?</h2>
        <p>Restoring replaces the current editor and opens the workout privately. Proof files are not stored.</p>
        {draftStatus ? <p role="status">{draftStatus}</p> : null}
        <div className="stack-actions">
          <button type="button" className="primary-cta" disabled={draftBusy} onClick={() => void resolveDraft(true)}>Restore draft</button>
          <button type="button" className="secondary-cta" disabled={draftBusy} onClick={() => void resolveDraft(false)}>Discard draft</button>
        </div>
      </section>}
    </MemberShell>;
  }

  return (
    <MemberShell
      title="Log workout"
      subtitle="Your session, one exercise at a time."
    >
      {loadingContext ? <div className="status-banner">Loading workout context…</div> : null}
      {loadingHandoff ? <div role="status" className="status-banner">Loading your selected session...</div> : null}
      {sessionGuidance ? <details className="glass-panel" open><summary className="section-title">Session guidance</summary><p className="supporting-copy" style={{ whiteSpace: "pre-line" }}>{sessionGuidance}</p></details> : null}
      {error ? <div role="alert" className="status-banner status-danger">{error}{saveUncertain ? <div className="stack-actions"><Link href="/feed">Check activity</Link><button type="button" className="secondary-cta" onClick={() => {
        if (!window.confirm("Only continue after checking whether this session was saved. Starting again without checking may duplicate it.")) return;
        persistReceipt(null); setSaveUncertain(false); setError(null);
      }}>I checked my activity</button></div> : null}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}
      <section className="glass-panel">
        <label><input type="checkbox" checked={draftEnabled} disabled={!viewerId || draftOwner !== viewerId || draftBusy || submitting}
          onChange={(event) => { if (event.target.checked) setDraftEnabled(true); else void resolveDraft(false); }} /> Keep a recovery draft in this tab</label>
        <p>Off by default. Contains sensitive workout text and metrics, not encrypted on this device. Expires after 12 hours without updates; this tab only, not synced. Files are never included. Turning off removes the draft.</p>
        {draftStatus ? <p role="status">{draftStatus}</p> : null}
      </section>

      <form className="section-stack log-workout-form" onSubmit={handleSubmit}>
        <section className="glass-panel form-grid">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">SESSION</p>
              <h2 className="section-title">Session details</h2>
            </div>
            {selectedGymName ? <span className="ghost-chip">{selectedGymName}</span> : null}
          </div>

          <div className="split-card">
            <div>
              <label className="label" htmlFor="log-title">Title</label>
              <input
                id="log-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="HYROX Singles Men Open"
              />
            </div>
            <div>
              <label className="label" htmlFor="log-gym">Gym</label>
              <select
                id="log-gym"
                className="input"
                value={gymId}
                onChange={(event) => setGymId(event.target.value)}
              >
                <option value="">No gym selected</option>
                {(context?.gyms ?? []).map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="split-card">
            <div>
              <label className="label" htmlFor="log-rpe">Session RPE</label>
              <input
                id="log-rpe"
                className="input"
                value={sessionRpe}
                onChange={(event) => setSessionRpe(event.target.value)}
                inputMode="decimal"
                placeholder="7"
              />
            </div>
            <div>
              <label className="label" htmlFor="log-proof-files">Proof files</label>
              <input
                ref={fileInputRef}
                id="log-proof-files"
                className="input"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files ?? []).slice(0, 4);
                  setProofFiles(nextFiles);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="log-notes">Notes</label>
            <textarea
              id="log-notes"
              className="input profile-bio"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Session notes, context, splits, or recovery notes."
            />
            <p className="feed-body">
              Up to 4 images or videos, 50 MB each. Attachments use your workout's audience.
            </p>
            {proofFiles.length > 0 ? (
              <div className="proof-file-list">
                {proofFiles.map((file) => (
                  <span key={`${file.name}-${file.lastModified}`} className="ghost-chip">
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="split-card">
          <div className="glass-panel tight-panel">
            <p className="field-label">Workout type</p>
            <div className="chip-row">
              {WORKOUT_TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ghost-chip ${workoutType === option ? "is-selected" : ""}`}
                  aria-pressed={workoutType === option}
                  onClick={() => setWorkoutType(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel tight-panel">
            <p className="field-label">Audience</p>
            <p className="feed-body">Only you. Choose whether to share after saving.</p>
          </div>
        </section>

        {workoutType === "hyrox" ? (
          <section className="glass-panel form-grid">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">HYROX</p>
                <h2 className="section-title">Official race template</h2>
              </div>
              <span className="identity-chip">Run splits + stations</span>
            </div>

            <div className="hyrox-preset-grid">
              <div>
                <label className="label" htmlFor="hyrox-preset">Division</label>
                <select
                  id="hyrox-preset"
                  className="input"
                  value={hyroxPresetKey}
                  onChange={(event) => setHyroxPresetKey(event.target.value as HyroxPresetKey)}
                >
                  {HYROX_PRESET_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="feed-body">{selectedPresetDetail}</p>
              </div>

              <div className="glass-panel hyrox-note">
                <p className="field-label">Preset behavior</p>
                <p className="feed-body">
                  Applying the preset creates all eight run splits plus the eight HYROX stations with current official defaults. After that you can remove a station, change the order, or override any weight and distance.
                </p>
                <button
                  type="button"
                  className="primary-cta"
                  onClick={() => void handleApplyHyroxPreset()}
                  disabled={applyingPreset}
                >
                  {applyingPreset ? "Applying..." : "Apply HYROX template"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <details className="log-template-tools">
          <summary>Saved sessions &amp; imports</summary>
        <section className="glass-panel form-grid">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">TEMPLATES</p>
              <h2 className="section-title">Session templates</h2>
            </div>
            <div className="stack-actions">
              <span className="identity-chip">{templates.length} saved</span>
              <button type="button" className="secondary-cta" onClick={handleStartNewTemplateDraft}>
                New draft
              </button>
            </div>
          </div>

          {loadingTemplates ? <div className="status-banner">Loading templates…</div> : null}
          {templateLoadError ? <div className="status-banner status-danger">{templateLoadError}</div> : null}

          <div className="template-grid">
            <div>
              <label className="label" htmlFor="template-select">Saved template</label>
              <select
                id="template-select"
                className="input"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
              >
                <option value="">New template draft</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <p className="feed-body">
                Save the current block order as a reusable day, or import a whole plan and pick which day to apply before logging.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="template-day-select">Template day</label>
              <select
                id="template-day-select"
                className="input"
                value={selectedTemplateDay?.id ?? ""}
                onChange={(event) => setSelectedTemplateDayId(event.target.value)}
                disabled={!selectedTemplate}
              >
                <option value="">Select a saved day</option>
                {(selectedTemplate?.days ?? []).map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label}
                  </option>
                ))}
              </select>
              <div className="template-toolbar">
                <button
                  type="button"
                  className="secondary-cta"
                  onClick={() => void handleApplySelectedTemplateDay()}
                  disabled={!selectedTemplateDay}
                >
                  Apply selected day
                </button>
                <button
                  type="button"
                  className="ghost-chip"
                  onClick={() => templateFileInputRef.current?.click()}
                  disabled={importingTemplate}
                >
                  {importingTemplate ? "Importing..." : "Import plan file"}
                </button>
                <input
                  ref={templateFileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.csv"
                  hidden
                  onChange={(event) => void handleImportPlanFile(event)}
                />
              </div>
            </div>
          </div>

          <div className="template-grid">
            <div>
              <label className="label" htmlFor="template-name">Template name</label>
              <input
                id="template-name"
                className="input"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Upper Strength, HYROX Race Simulation, 4-day plan"
              />
            </div>
            <div>
              <label className="label" htmlFor="template-day-label">Day label</label>
              <input
                id="template-day-label"
                className="input"
                value={templateDayLabel}
                onChange={(event) => setTemplateDayLabel(event.target.value)}
                placeholder="Day 1, Upper, Tempo Run"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="template-description">Template notes</label>
            <textarea
              id="template-description"
              className="input profile-bio"
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder="Explain the focus of the plan, weekly split, or target event."
            />
            <p className="feed-body">
              Plan import accepts plain text, markdown, or JSON. Use simple exercise names line by line under day headings, for example: Day 1, Bench Press | reps 8 | 80 kg.
            </p>
          </div>

          <div className="template-toolbar">
            <button
              type="button"
              className="primary-cta"
              onClick={() => void handleSaveTemplate()}
              disabled={savingTemplate || Boolean(templateLoadError)}
            >
              {savingTemplate ? "Saving..." : selectedTemplate ? "Update template day" : "Save current day as template"}
            </button>
            {selectedTemplate ? (
              <button
                type="button"
                className="ghost-chip"
                onClick={() => void handleDeleteTemplate()}
                disabled={deletingTemplate}
              >
                {deletingTemplate ? "Deleting..." : "Delete template"}
              </button>
            ) : null}
          </div>
        </section>
        </details>

        <section className="glass-panel form-grid log-exercises">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">BLOCKS</p>
              <h2 className="section-title">Exercise order</h2>
            </div>
            <div className="stack-actions">
              <span className="identity-chip">{activeBlocks.length} selected</span>
              <button type="button" className="secondary-cta" onClick={handleAddBlock}>
                Add block
              </button>
            </div>
          </div>

          <div className="log-block-list">
            {blocks.map((block, index) => (
              <article key={block.clientId} className="log-block-card">
                <div className="log-block-header">
                  <div className="log-block-header-main">
                    <span className="ghost-chip log-block-order">#{index + 1}</span>
                    <div>
                      <h3 className="log-block-title">
                        {block.stationLabel.trim() || block.selectedExercise?.name || "Exercise block"}
                      </h3>
                      {block.selectedExercise ? (
                        <p className="feed-body">
                          {block.selectedExercise.category}
                          {block.selectedExercise.equipment ? ` · ${block.selectedExercise.equipment}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="log-block-actions">
                    <button
                      type="button"
                      className="ghost-chip"
                      aria-label={`Move ${block.stationLabel.trim() || block.selectedExercise?.name || "exercise"} up`}
                      title="Move up"
                      onClick={() => setBlocks((current) => moveBlock(current, index, index - 1))}
                      disabled={index === 0}
                    >
                      <ArrowUp size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="ghost-chip"
                      aria-label={`Move ${block.stationLabel.trim() || block.selectedExercise?.name || "exercise"} down`}
                      title="Move down"
                      onClick={() => setBlocks((current) => moveBlock(current, index, index + 1))}
                      disabled={index === blocks.length - 1}
                    >
                      <ArrowDown size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="ghost-chip"
                      aria-label={`Remove ${block.stationLabel.trim() || block.selectedExercise?.name || "exercise"}`}
                      title="Remove exercise"
                      onClick={() => handleRemoveBlock(block.clientId)}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor={`search-${block.clientId}`}>Search exercise catalogue</label>
                  <input
                    id={`search-${block.clientId}`}
                    className="input"
                    value={block.searchQuery}
                    onChange={(event) => handleSearchChange(block.clientId, event.target.value)}
                    placeholder="Search exercise catalogue"
                  />
                  {searchingByBlock[block.clientId] ? <p className="feed-body">Searching exercises…</p> : null}
                  {(exerciseResults[block.clientId] ?? []).length > 0 && !block.selectedExercise ? (
                    <div className="result-list">
                      {(exerciseResults[block.clientId] ?? []).map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="result-row"
                          onClick={() => handleSelectExercise(block.clientId, result)}
                        >
                          <strong>{result.name}</strong>
                          <span className="search-meta">
                            {result.category}
                            {result.equipment ? ` · ${result.equipment}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="split-card">
                  <div>
                    <label className="label" htmlFor={`label-${block.clientId}`}>Display label</label>
                    <input
                      id={`label-${block.clientId}`}
                      className="input"
                      value={block.stationLabel}
                      onChange={(event) =>
                        updateBlockState(block.clientId, (current) => ({
                          ...current,
                          stationLabel: event.target.value
                        }))
                      }
                      placeholder="Run 1, Station 4, Sled Push"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`block-type-${block.clientId}`}>Block type</label>
                    <select
                      id={`block-type-${block.clientId}`}
                      className="input"
                      value={block.blockType}
                      onChange={(event) =>
                        updateBlockState(block.clientId, (current) => ({
                          ...current,
                          blockType: event.target.value as WorkoutBlockType
                        }))
                      }
                    >
                      {WORKOUT_BLOCK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor={`notes-${block.clientId}`}>Block notes</label>
                  <textarea
                    id={`notes-${block.clientId}`}
                    className="input profile-bio"
                    value={block.notes}
                    onChange={(event) =>
                      updateBlockState(block.clientId, (current) => ({
                        ...current,
                        notes: event.target.value
                      }))
                    }
                    placeholder="Split notes, pace, scaling, or modifications."
                  />
                </div>

                <div className="metric-grid">
                  <div>
                    <label className="label" htmlFor={`reps-${block.clientId}`}>Reps</label>
                    <input
                      id={`reps-${block.clientId}`}
                      className="input"
                      value={block.reps}
                      onChange={(event) =>
                        updateBlockState(block.clientId, (current) => ({
                          ...current,
                          reps: event.target.value
                        }))
                      }
                      inputMode="numeric"
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`weight-${block.clientId}`}>Weight (kg)</label>
                    <input
                      id={`weight-${block.clientId}`}
                      className="input"
                      value={block.weightKg}
                      onChange={(event) =>
                        updateBlockState(block.clientId, (current) => ({
                          ...current,
                          weightKg: event.target.value
                        }))
                      }
                      inputMode="decimal"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`distance-${block.clientId}`}>Distance (m)</label>
                    <input
                      id={`distance-${block.clientId}`}
                      className="input"
                      value={block.distanceM}
                      onChange={(event) =>
                        updateBlockState(block.clientId, (current) => ({
                          ...current,
                          distanceM: event.target.value
                        }))
                      }
                      inputMode="numeric"
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`duration-${block.clientId}`}>Duration (sec)</label>
                    <input
                      id={`duration-${block.clientId}`}
                      className="input"
                      value={block.durationSeconds}
                      onChange={(event) =>
                        updateBlockState(block.clientId, (current) => ({
                          ...current,
                          durationSeconds: event.target.value
                        }))
                      }
                      inputMode="numeric"
                      placeholder="300"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-panel log-submit">
          <p className="log-private-note"><LockKeyhole size={16} aria-hidden="true" />Saved privately. Sharing is optional.</p>
          <div className="stack-actions">
            <button type="submit" className="primary-cta" disabled={submitting || loadingContext || loadingHandoff || saveUncertain}>
              <Save size={18} aria-hidden="true" />
              {submitting ? "Saving..." : "Save workout"}
            </button>
            <Link href="/feed" className="secondary-cta">
              Back to feed
            </Link>
          </div>
        </section>
      </form>
    </MemberShell>
  );
}
