"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  deleteWorkoutTemplate,
  type ExerciseSearchResult,
  type WorkoutBlockType,
  type WorkoutLogContext,
  type WorkoutTemplate,
  type WorkoutTemplateDay
} from "@/lib/public/workout-log";
import { parseWorkoutPlanFile } from "@/lib/public/workout-plan-import";

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
  const [visibility, setVisibility] = useState<WorkoutVisibility>("public");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const nextContext = await loadWorkoutLogContext(supabase);
        if (!active) return;
        setContext(nextContext);
        setGymId(nextContext.homeGymId ?? nextContext.gyms[0]?.id ?? "");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load workout context.");
      } finally {
        if (!active) return;
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

    async function loadTemplates() {
      setLoadingTemplates(true);
      setTemplateLoadError(null);
      try {
        const nextTemplates = await loadWorkoutTemplates(supabase);
        if (!active) return;
        setTemplates(nextTemplates);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load workout templates.";
        setTemplateLoadError(
          /user_workout_templates/i.test(message)
            ? "Workout templates are not ready yet. Apply the user_workout_templates migration in Supabase first."
            : message
        );
      } finally {
        if (!active) return;
        setLoadingTemplates(false);
      }
    }

    void loadTemplates();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

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
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
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
    updateBlockState(clientId, (current) => ({
      ...current,
      searchQuery: value,
      selectedExercise: current.selectedExercise?.name === value ? current.selectedExercise : null
    }));
    setError(null);

    clearBlockSearch(clientId);

    const query = value.trim();
    if (query.length < 2) {
      return;
    }

    setSearchingByBlock((current) => ({ ...current, [clientId]: true }));
    searchTimersRef.current[clientId] = window.setTimeout(async () => {
      try {
        const results = await searchExercises(supabase, query);
        setExerciseResults((current) => ({ ...current, [clientId]: results }));
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : "Unable to search exercises.");
      } finally {
        setSearchingByBlock((current) => ({ ...current, [clientId]: false }));
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
    setApplyingPreset(true);
    setError(null);
    setSuccess(null);

    try {
      const exerciseMap = await loadExercisesBySlugs(supabase, Array.from(HYROX_REQUIRED_EXERCISE_SLUGS));
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
      setError(presetError instanceof Error ? presetError.message : "Unable to apply HYROX template.");
    } finally {
      setApplyingPreset(false);
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
    if (!selectedTemplate || !selectedTemplateDay) {
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

      upsertTemplate(nextTemplate);
      setSelectedTemplateId(nextTemplate.id);
      setSelectedTemplateDayId(nextTemplate.days.at(-1)?.id ?? "");
      setTemplateName(nextTemplate.name);
      setTemplateDescription(nextTemplate.description ?? "");
      setSuccess(`Saved template ${nextTemplate.name}.`);
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Unable to save template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplate) {
      setError("Select a template before deleting it.");
      return;
    }

    setDeletingTemplate(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteWorkoutTemplate(supabase, selectedTemplate.id);
      setTemplates((current) => current.filter((template) => template.id !== selectedTemplate.id));
      handleStartNewTemplateDraft();
      setSuccess(`Deleted template ${selectedTemplate.name}.`);
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Unable to delete template.");
    } finally {
      setDeletingTemplate(false);
    }
  }

  async function handleImportPlanFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportingTemplate(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedPlan = parseWorkoutPlanFile(file.name, await file.text());
      const unresolvedQueries: string[] = [];
      const resolvedDays: WorkoutTemplateDay[] = [];

      for (const [dayIndex, day] of parsedPlan.days.entries()) {
        const resolvedExercises = [];

        for (const exercise of day.exercises) {
          const results = await searchExercises(supabase, exercise.query);
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

      upsertTemplate(savedTemplate);
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
      setError(importError instanceof Error ? importError.message : "Unable to import workout plan.");
    } finally {
      setImportingTemplate(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const workoutRpeValue = parseOptionalNumber(sessionRpe);
      const result = await submitWorkout(supabase, {
        title,
        notes,
        workoutType,
        visibility,
        gymId: gymId || context?.homeGymId || null,
        startedAt: new Date().toISOString(),
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
      });

      let uploadedProofCount = 0;
      if (proofFiles.length > 0) {
        const proofUpload = await uploadWorkoutProofMedia(supabase, {
          workoutId: result.workoutId,
          files: proofFiles
        });
        uploadedProofCount = proofUpload.uploadedCount;
      }

      setSuccess(
        `Workout logged. XP ${result.xpDelta.xpBefore} -> ${result.xpDelta.xpAfter}. Chain ${result.xpDelta.chainDaysBefore} -> ${result.xpDelta.chainDaysAfter}.${uploadedProofCount > 0 ? ` Uploaded ${uploadedProofCount} proof file${uploadedProofCount === 1 ? "" : "s"}.` : ""}`
      );
      setBlocks([createEmptyBlock()]);
      setNotes("");
      setProofFiles([]);
      setSessionRpe("7");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to log workout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MemberShell
      title="Workout Log"
      subtitle="Search the catalog, apply official HYROX presets, and log a full multi-station session into the live KRUXT workout model."
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">LOG FLOW</p>
          <h2 className="section-title">Record the whole session, not one token set.</h2>
          <p className="section-copy">
            The logger now supports multiple exercise blocks, station order changes, and official HYROX presets with editable weights and distances.
          </p>
          <div className="stack-actions">
            <Link href="/feed" className="secondary-cta">
              Open proof feed
            </Link>
          </div>
        </div>

        <div className="hero-stats">
          <div className="metric-card">
            <span className="metric-label">Chain</span>
            <strong className="metric-value">{context?.chainDays ?? 0} days</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Level</span>
            <strong className="metric-value">{context?.level ?? 1}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Rank</span>
            <strong className="metric-value metric-value-sm">{context?.rankTier ?? "initiate"}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Blocks</span>
            <strong className="metric-value">{activeBlocks.length}</strong>
          </div>
        </div>
      </section>

      {loadingContext ? <div className="status-banner">Loading workout context…</div> : null}
      {error ? <div className="status-banner status-danger">{error}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}

      <form className="section-stack" onSubmit={handleSubmit}>
        <section className="glass-panel form-grid">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">SESSION</p>
              <h2 className="section-title">Metadata</h2>
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
              Add up to 4 images or videos. This is the Strava-style proof layer for the workout post.
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
                  onClick={() => setWorkoutType(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel tight-panel">
            <p className="field-label">Visibility</p>
            <div className="chip-row">
              {VISIBILITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ghost-chip ${visibility === option ? "is-selected" : ""}`}
                  onClick={() => setVisibility(option)}
                >
                  {option}
                </button>
              ))}
            </div>
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

        <section className="glass-panel form-grid">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">TEMPLATES</p>
              <h2 className="section-title">Program days and imported plans</h2>
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

        <section className="glass-panel form-grid">
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
                      onClick={() => setBlocks((current) => moveBlock(current, index, index - 1))}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="ghost-chip"
                      onClick={() => setBlocks((current) => moveBlock(current, index, index + 1))}
                      disabled={index === blocks.length - 1}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="ghost-chip"
                      onClick={() => handleRemoveBlock(block.clientId)}
                    >
                      Remove
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

        <section className="glass-panel">
          <p className="field-label">Submission checklist</p>
          <ul className="checklist">
            <li>The logger now sends every selected block through `log_workout_atomic` in order</li>
            <li>HYROX presets use the current official singles and doubles standards</li>
            <li>You can remove or reorder blocks if you only completed part of the race simulation</li>
            <li>Selected proof files upload after the workout id is created</li>
          </ul>
          <div className="stack-actions">
            <button type="submit" className="primary-cta" disabled={submitting || loadingContext}>
              {submitting ? "Logging..." : "Log workout"}
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
