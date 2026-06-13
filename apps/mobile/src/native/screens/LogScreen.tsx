import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Banner,
  Button,
  Card,
  Field,
  Heading,
  InlineButton,
  Pill,
  ScreenScroll,
  SectionTitle,
  StatGrid
} from "../ui";
import { palette, radius, spacing } from "../theme";
import { createWorkoutLoggerRuntimeServices } from "../../workout-logger/runtime-services";
import type {
  BlockType,
  ChainContext,
  ExerciseOption,
  WorkoutDraft,
  WorkoutLoggerSubmitResult,
  WorkoutType,
  WorkoutVisibility
} from "../../workout-logger/types";

type Step = "setup" | "exercises" | "review";

type SetEntry = {
  clientId: string;
  reps: string;
  weightKg: string;
  durationSeconds: string;
  distanceM: string;
  rpe: string;
  isPr: boolean;
};

type ExerciseEntry = {
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  blockType: BlockType;
  notes: string;
  targetReps: string;
  targetWeightKg: string;
  sets: SetEntry[];
};

const services = createWorkoutLoggerRuntimeServices();
const workoutTypes: WorkoutType[] = ["strength", "conditioning", "hybrid", "recovery", "mobility"];
const visibilityOptions: WorkoutVisibility[] = ["public", "guild", "private"];
const blockTypes: BlockType[] = ["straight_set", "superset", "circuit", "emom", "amrap"];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptySet(): SetEntry {
  return {
    clientId: createId("set"),
    reps: "",
    weightKg: "",
    durationSeconds: "",
    distanceM: "",
    rpe: "",
    isPr: false
  };
}

function createExerciseEntry(option: ExerciseOption): ExerciseEntry {
  return {
    clientId: createId("exercise"),
    exerciseId: option.id,
    exerciseName: option.name,
    blockType: "straight_set",
    notes: "",
    targetReps: "",
    targetWeightKg: "",
    sets: [createEmptySet()]
  };
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function countSets(exercises: ExerciseEntry[]) {
  return exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

function blockLabel(blockType: BlockType) {
  return blockType.replace(/_/g, " ");
}

function formatChainContext(context: ChainContext | null) {
  if (!context) {
    return [];
  }

  return [
    { label: "Chain", value: `${context.chainDays}d` },
    { label: "Rank", value: context.rankTier },
    { label: "Level", value: String(context.level) },
    { label: "XP", value: String(context.xpTotal) }
  ];
}

function buildDraft(params: {
  title: string;
  notes: string;
  workoutType: WorkoutType;
  visibility: WorkoutVisibility;
  workoutRpe: string;
  exercises: ExerciseEntry[];
}): WorkoutDraft {
  return {
    metadata: {
      title: params.title.trim(),
      notes: params.notes.trim() || undefined,
      workoutType: params.workoutType,
      visibility: params.visibility,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      rpe: parseOptionalNumber(params.workoutRpe)
    },
    exercises: params.exercises.map((exercise) => ({
      clientId: exercise.clientId,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      blockType: exercise.blockType,
      notes: exercise.notes.trim() || undefined,
      targetReps: exercise.targetReps.trim() || undefined,
      targetWeightKg: parseOptionalNumber(exercise.targetWeightKg),
      sets: exercise.sets.map((setEntry) => ({
        clientId: setEntry.clientId,
        reps: parseOptionalNumber(setEntry.reps),
        weightKg: parseOptionalNumber(setEntry.weightKg),
        durationSeconds: parseOptionalNumber(setEntry.durationSeconds),
        distanceM: parseOptionalNumber(setEntry.distanceM),
        rpe: parseOptionalNumber(setEntry.rpe),
        isPr: setEntry.isPr || undefined
      }))
    }))
  };
}

export function LogScreen() {
  const [step, setStep] = useState<Step>("setup");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [visibility, setVisibility] = useState<WorkoutVisibility>("guild");
  const [workoutRpe, setWorkoutRpe] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseOption[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<ExerciseEntry[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chainContext, setChainContext] = useState<ChainContext | null>(null);
  const [submitResult, setSubmitResult] = useState<WorkoutLoggerSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const context = await services.loadContext();
        if (!cancelled) {
          setChainContext(context);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your current rank context.");
        }
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function searchExercises() {
      const trimmed = exerciseQuery.trim();
      if (trimmed.length < 2) {
        setExerciseResults([]);
        return;
      }

      setLoadingSearch(true);
      try {
        const results = await services.searchExercises(trimmed);
        if (!cancelled) {
          setExerciseResults(results);
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : "Unable to search exercises right now.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSearch(false);
        }
      }
    }

    void searchExercises();

    return () => {
      cancelled = true;
    };
  }, [exerciseQuery]);

  const hasSetup = title.trim().length > 0;
  const hasExercises = selectedExercises.length > 0;
  const hasSetData = selectedExercises.every((exercise) => exercise.sets.length > 0);
  const totalSets = useMemo(() => countSets(selectedExercises), [selectedExercises]);
  const contextStats = useMemo(() => formatChainContext(chainContext), [chainContext]);

  const draftPreview = useMemo(
    () =>
      hasSetup && hasExercises && hasSetData
        ? buildDraft({
            title,
            notes,
            workoutType,
            visibility,
            workoutRpe,
            exercises: selectedExercises
          })
        : null,
    [hasExercises, hasSetData, hasSetup, notes, selectedExercises, title, visibility, workoutRpe, workoutType]
  );

  function resetDraft() {
    setStep("setup");
    setTitle("");
    setNotes("");
    setWorkoutType("strength");
    setVisibility("guild");
    setWorkoutRpe("");
    setExerciseQuery("");
    setExerciseResults([]);
    setSelectedExercises([]);
    setSubmitResult(null);
    setError(null);
  }

  function addExercise(option: ExerciseOption) {
    setSelectedExercises((current) => {
      if (current.some((exercise) => exercise.exerciseId === option.id)) {
        return current;
      }
      return [...current, createExerciseEntry(option)];
    });
    setExerciseQuery("");
    setExerciseResults([]);
    setError(null);
  }

  function removeExercise(clientId: string) {
    setSelectedExercises((current) => current.filter((exercise) => exercise.clientId !== clientId));
  }

  function updateExercise(clientId: string, updater: (exercise: ExerciseEntry) => ExerciseEntry) {
    setSelectedExercises((current) =>
      current.map((exercise) => (exercise.clientId === clientId ? updater(exercise) : exercise))
    );
  }

  function updateSet(
    exerciseId: string,
    setId: string,
    updater: (setEntry: SetEntry) => SetEntry
  ) {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((setEntry) => (setEntry.clientId === setId ? updater(setEntry) : setEntry))
    }));
  }

  function addSet(exerciseId: string) {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: [...exercise.sets, createEmptySet()]
    }));
  }

  function removeSet(exerciseId: string, setId: string) {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.length > 1 ? exercise.sets.filter((setEntry) => setEntry.clientId !== setId) : exercise.sets
    }));
  }

  async function handleSubmit() {
    if (!draftPreview) {
      setError("Complete the setup, add at least one exercise, and keep one set per exercise before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await services.submit(draftPreview);
      setSubmitResult(result);
      resetDraft();
      setSubmitResult(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save your workout right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Record"
        title="Log today’s session"
        subtitle="Build the workout, review the structure, then submit a real KRUXT activity with XP and chain updates."
      />

      {loadingContext ? (
        <Banner tone="info" title="Loading your rank context" description="Chain, rank, and level stats are syncing now." />
      ) : contextStats.length ? (
        <StatGrid items={contextStats} />
      ) : null}

      {submitResult ? (
        <Banner
          tone="success"
          title="Workout saved"
          description={`+${submitResult.xpDelta.xpAwarded} XP, chain ${submitResult.xpDelta.chainDays}d, rank ${submitResult.xpDelta.rankTier}.`}
        />
      ) : null}

      {error ? <Banner tone="danger" title="Logger blocked" description={error} /> : null}

      <Card>
        <SectionTitle title="Flow" />
        <View style={styles.stepRow}>
          {[
            { key: "setup", label: "Setup" },
            { key: "exercises", label: "Exercises" },
            { key: "review", label: "Review" }
          ].map((item) => (
            <Pressable key={item.key} onPress={() => setStep(item.key as Step)} style={styles.stepPressable}>
              <Pill label={item.label} tone={step === item.key ? "primary" : "neutral"} />
            </Pressable>
          ))}
        </View>
      </Card>

      {step === "setup" ? (
        <Card>
          <SectionTitle title="Session setup" subtitle="Name the workout and set the basic logging context." />
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Morning lower, Guild HYROX, Push day" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="How it felt, why it matters, coach notes" multiline />
          <Field
            label="Workout RPE"
            value={workoutRpe}
            onChangeText={setWorkoutRpe}
            placeholder="1-10"
            keyboardType="decimal-pad"
          />

          <View style={styles.choiceGroup}>
            <Text style={styles.choiceLabel}>Workout type</Text>
            <View style={styles.choiceRow}>
              {workoutTypes.map((option) => (
                <Pressable key={option} onPress={() => setWorkoutType(option)} style={styles.choicePressable}>
                  <Pill label={option} tone={workoutType === option ? "primary" : "neutral"} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.choiceGroup}>
            <Text style={styles.choiceLabel}>Visibility</Text>
            <View style={styles.choiceRow}>
              {visibilityOptions.map((option) => (
                <Pressable key={option} onPress={() => setVisibility(option)} style={styles.choicePressable}>
                  <Pill label={option} tone={visibility === option ? "primary" : "neutral"} />
                </Pressable>
              ))}
            </View>
          </View>

          <Button
            label="Continue to exercises"
            onPress={() => setStep("exercises")}
            disabled={!hasSetup}
          />
        </Card>
      ) : null}

      {step === "exercises" ? (
        <>
          <Card>
            <SectionTitle title="Add exercises" subtitle="Search the library, then define the block and sets for each movement." />
            <Field
              label="Exercise search"
              value={exerciseQuery}
              onChangeText={setExerciseQuery}
              placeholder="Trap bar deadlift, sled push, bike erg"
            />
            {loadingSearch ? <Text style={styles.helperText}>Searching exercise library…</Text> : null}
            {exerciseResults.length ? (
              <View style={styles.searchResults}>
                {exerciseResults.map((result) => (
                  <Card key={result.id} style={styles.searchCard}>
                    <View style={styles.searchRow}>
                      <View style={styles.searchMeta}>
                        <Text style={styles.searchName}>{result.name}</Text>
                        <Text style={styles.helperText}>Tap to add this exercise block.</Text>
                      </View>
                      <InlineButton label="Add" onPress={() => addExercise(result)} />
                    </View>
                  </Card>
                ))}
              </View>
            ) : exerciseQuery.trim().length >= 2 && !loadingSearch ? (
              <Text style={styles.helperText}>No exercise matches yet.</Text>
            ) : null}
          </Card>

          {selectedExercises.map((exercise, exerciseIndex) => (
            <Card key={exercise.clientId}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseMeta}>
                  <Text style={styles.exerciseTitle}>{`${exerciseIndex + 1}. ${exercise.exerciseName}`}</Text>
                  <Text style={styles.helperText}>{exercise.sets.length} sets in this block</Text>
                </View>
                <InlineButton label="Remove" tone="danger" onPress={() => removeExercise(exercise.clientId)} />
              </View>

              <View style={styles.choiceGroup}>
                <Text style={styles.choiceLabel}>Block type</Text>
                <View style={styles.choiceRow}>
                  {blockTypes.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => updateExercise(exercise.clientId, (current) => ({ ...current, blockType: option }))}
                      style={styles.choicePressable}
                    >
                      <Pill label={blockLabel(option)} tone={exercise.blockType === option ? "primary" : "neutral"} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <Field
                label="Block notes"
                value={exercise.notes}
                onChangeText={(value) => updateExercise(exercise.clientId, (current) => ({ ...current, notes: value }))}
                placeholder="Tempo, focus cues, interval rules"
                multiline
              />
              <View style={styles.inlineFieldRow}>
                <Field
                  label="Target reps"
                  value={exercise.targetReps}
                  onChangeText={(value) => updateExercise(exercise.clientId, (current) => ({ ...current, targetReps: value }))}
                  placeholder="8-10"
                />
                <Field
                  label="Target kg"
                  value={exercise.targetWeightKg}
                  onChangeText={(value) => updateExercise(exercise.clientId, (current) => ({ ...current, targetWeightKg: value }))}
                  placeholder="80"
                  keyboardType="decimal-pad"
                />
              </View>

              {exercise.sets.map((setEntry, setIndex) => (
                <Card key={setEntry.clientId} style={styles.setCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.setTitle}>{`Set ${setIndex + 1}`}</Text>
                    <View style={styles.setActions}>
                      <Pressable
                        onPress={() => updateSet(exercise.clientId, setEntry.clientId, (current) => ({ ...current, isPr: !current.isPr }))}
                        style={styles.choicePressable}
                      >
                        <Pill label={setEntry.isPr ? "PR" : "Mark PR"} tone={setEntry.isPr ? "success" : "neutral"} />
                      </Pressable>
                      {exercise.sets.length > 1 ? (
                        <InlineButton label="Delete" tone="danger" onPress={() => removeSet(exercise.clientId, setEntry.clientId)} />
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.inlineFieldRow}>
                    <Field
                      label="Reps"
                      value={setEntry.reps}
                      onChangeText={(value) => updateSet(exercise.clientId, setEntry.clientId, (current) => ({ ...current, reps: value }))}
                      placeholder="8"
                      keyboardType="decimal-pad"
                    />
                    <Field
                      label="Weight kg"
                      value={setEntry.weightKg}
                      onChangeText={(value) => updateSet(exercise.clientId, setEntry.clientId, (current) => ({ ...current, weightKg: value }))}
                      placeholder="80"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.inlineFieldRow}>
                    <Field
                      label="Duration s"
                      value={setEntry.durationSeconds}
                      onChangeText={(value) => updateSet(exercise.clientId, setEntry.clientId, (current) => ({ ...current, durationSeconds: value }))}
                      placeholder="60"
                      keyboardType="decimal-pad"
                    />
                    <Field
                      label="Distance m"
                      value={setEntry.distanceM}
                      onChangeText={(value) => updateSet(exercise.clientId, setEntry.clientId, (current) => ({ ...current, distanceM: value }))}
                      placeholder="500"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Field
                    label="Set RPE"
                    value={setEntry.rpe}
                    onChangeText={(value) => updateSet(exercise.clientId, setEntry.clientId, (current) => ({ ...current, rpe: value }))}
                    placeholder="1-10"
                    keyboardType="decimal-pad"
                  />
                </Card>
              ))}

              <Button label="Add set" tone="secondary" onPress={() => addSet(exercise.clientId)} />
            </Card>
          ))}

          <Card>
            <SectionTitle title="Progress" subtitle="You need one titled workout with at least one exercise and one set per exercise." />
            <StatGrid
              items={[
                { label: "Exercises", value: String(selectedExercises.length) },
                { label: "Sets", value: String(totalSets) },
                { label: "Ready", value: hasSetup && hasExercises && hasSetData ? "Yes" : "No" }
              ]}
            />
            <View style={styles.footerActions}>
              <Button label="Back to setup" tone="secondary" onPress={() => setStep("setup")} />
              <Button label="Review draft" onPress={() => setStep("review")} disabled={!hasSetup || !hasExercises || !hasSetData} />
            </View>
          </Card>
        </>
      ) : null}

      {step === "review" ? (
        <>
          <Card>
            <SectionTitle title="Review before submit" subtitle="This is the real workout payload that will create XP, chain, and proof activity." />
            <StatGrid
              items={[
                { label: "Type", value: workoutType },
                { label: "Visibility", value: visibility },
                { label: "Exercises", value: String(selectedExercises.length) },
                { label: "Sets", value: String(totalSets) }
              ]}
            />
            <Text style={styles.reviewTitle}>{title || "Untitled workout"}</Text>
            {notes.trim() ? <Text style={styles.reviewNotes}>{notes.trim()}</Text> : null}
            {selectedExercises.map((exercise) => (
              <View key={exercise.clientId} style={styles.reviewExercise}>
                <Text style={styles.reviewExerciseTitle}>{exercise.exerciseName}</Text>
                <Text style={styles.helperText}>{`${blockLabel(exercise.blockType)} · ${exercise.sets.length} sets`}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle title="Submit" subtitle="If anything is off, go back and correct the draft before posting it to KRUXT." />
            <View style={styles.footerActions}>
              <Button label="Back to exercises" tone="secondary" onPress={() => setStep("exercises")} />
              <Button label={submitting ? "Submitting…" : "Submit workout"} onPress={() => void handleSubmit()} disabled={!draftPreview || submitting} />
            </View>
          </Card>
        </>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  choiceGroup: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  choiceLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  choicePressable: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  exerciseHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md
  },
  exerciseMeta: {
    flex: 1,
    gap: 4
  },
  exerciseTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700"
  },
  footerActions: {
    gap: spacing.sm
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  inlineFieldRow: {
    gap: spacing.sm
  },
  reviewExercise: {
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: spacing.sm,
    marginTop: spacing.sm
  },
  reviewExerciseTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700"
  },
  reviewNotes: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm
  },
  reviewTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: spacing.md
  },
  searchCard: {
    padding: spacing.md
  },
  searchMeta: {
    flex: 1,
    gap: 4
  },
  searchName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700"
  },
  searchResults: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  setActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  setCard: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  setTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700"
  },
  stepPressable: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm
  },
  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  }
});
