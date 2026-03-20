import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Chip, Input, ProgressBar } from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";
import type {
  WorkoutLoggerDraft,
  WorkoutLoggerExerciseDraft,
  WorkoutLoggerSetDraft,
  WorkoutLoggerUiStep,
} from "../flows/phase3-workout-logger-ui";
import { createPhase3WorkoutLoggerUiFlow } from "../flows/phase3-workout-logger-ui";

const theme = darkTheme;

const WORKOUT_TYPES = [
  { key: "strength" as const, label: "Strength", icon: "\u{1F4AA}" },
  { key: "cardio" as const, label: "Cardio", icon: "\u{1F3C3}" },
  { key: "flexibility" as const, label: "Flexibility", icon: "\u{1F9D8}" },
  { key: "sport" as const, label: "Sport", icon: "\u26BD" },
  { key: "other" as const, label: "Other", icon: "\u{1F3AF}" },
];

const VISIBILITY_OPTIONS = [
  { key: "public" as const, label: "Public", icon: "\u{1F30D}" },
  { key: "guild_only" as const, label: "Guild Only", icon: "\u{1F6E1}\uFE0F" },
  { key: "private" as const, label: "Private", icon: "\u{1F512}" },
];

const STEP_ORDER: WorkoutLoggerUiStep[] = [
  "metadata",
  "exercise_blocks",
  "sets",
  "review",
];

const STEP_LABELS: Record<WorkoutLoggerUiStep, string> = {
  metadata: "Workout Info",
  exercise_blocks: "Exercises",
  sets: "Sets & Reps",
  review: "Review & Post",
};

export function WorkoutLoggerScreen() {
  const flowRef = useRef(createPhase3WorkoutLoggerUiFlow());
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<WorkoutLoggerDraft>(() =>
    flowRef.current.createDraft(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const step = STEP_ORDER[currentStep];
  const progress = (currentStep + 1) / STEP_ORDER.length;

  const goNext = useCallback(() => {
    if (currentStep < STEP_ORDER.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    const errors = flowRef.current.validate(draft);
    if (errors.length > 0) {
      const errMap: Record<string, string> = {};
      errors.forEach((e) => {
        errMap[e.field] = e.message;
      });
      setFieldErrors(errMap);
      Alert.alert("Validation", errors[0].message);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    const result = await flowRef.current.submit(draft);
    setSubmitting(false);

    if (result.ok) {
      Alert.alert(
        "Proof Posted!",
        `+${result.progressDelta.xpDelta ?? 0} XP  \u2022  Chain: ${result.progressDelta.current.chainDays}d`,
      );
      setDraft(flowRef.current.createDraft());
      setCurrentStep(0);
    } else {
      Alert.alert("Error", result.error.message);
    }
  }, [draft]);

  const updateMetadata = useCallback(
    (updates: Partial<WorkoutLoggerDraft["metadata"]>) => {
      setDraft((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, ...updates },
      }));
    },
    [],
  );

  const addExercise = useCallback(() => {
    setDraft((prev) => flowRef.current.addExercise(prev));
  }, []);

  const removeExercise = useCallback((index: number) => {
    setDraft((prev) => flowRef.current.removeExercise(prev, index));
  }, []);

  const addSet = useCallback((exerciseIndex: number) => {
    setDraft((prev) => flowRef.current.addSet(prev, exerciseIndex));
  }, []);

  const removeSet = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      setDraft((prev) =>
        flowRef.current.removeSet(prev, exerciseIndex, setIndex),
      );
    },
    [],
  );

  const quickAdjust = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: "reps" | "weightKg" | "rpe",
      delta: number,
    ) => {
      setDraft((prev) =>
        flowRef.current.quickAdjustSet(prev, exerciseIndex, setIndex, field, delta),
      );
    },
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LOG WORKOUT</Text>
        <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>
        <ProgressBar
          theme={theme}
          progress={progress}
          style={styles.progressBar}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === "metadata" && (
            <MetadataStep
              draft={draft}
              onUpdate={updateMetadata}
              errors={fieldErrors}
            />
          )}
          {step === "exercise_blocks" && (
            <ExerciseBlocksStep
              exercises={draft.exercises}
              onAdd={addExercise}
              onRemove={removeExercise}
            />
          )}
          {step === "sets" && (
            <SetsStep
              exercises={draft.exercises}
              onAddSet={addSet}
              onRemoveSet={removeSet}
              onQuickAdjust={quickAdjust}
            />
          )}
          {step === "review" && <ReviewStep draft={draft} />}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer nav */}
      <View style={styles.footer}>
        {currentStep > 0 && (
          <Button
            theme={theme}
            variant="secondary"
            label="Back"
            onPress={goBack}
            style={styles.footerButton}
          />
        )}
        <View style={styles.footerSpacer} />
        {currentStep < STEP_ORDER.length - 1 ? (
          <Button
            theme={theme}
            variant="primary"
            label="Next"
            onPress={goNext}
            style={styles.footerButton}
          />
        ) : (
          <Button
            theme={theme}
            variant="primary"
            label="Post Proof"
            loading={submitting}
            onPress={handleSubmit}
            style={styles.footerButton}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Metadata
// ---------------------------------------------------------------------------

function MetadataStep({
  draft,
  onUpdate,
  errors,
}: {
  draft: WorkoutLoggerDraft;
  onUpdate: (u: Partial<WorkoutLoggerDraft["metadata"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>Workout Title</Text>
      <Input
        theme={theme}
        value={draft.metadata.title}
        onChangeText={(t) => onUpdate({ title: t })}
        placeholder="e.g. Push Day, Morning Run"
        error={errors["metadata.title"]}
      />

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Type</Text>
      <View style={styles.chipRow}>
        {WORKOUT_TYPES.map((wt) => (
          <Chip
            key={wt.key}
            theme={theme}
            label={`${wt.icon} ${wt.label}`}
            selected={draft.metadata.workoutType === wt.key}
            onPress={() => onUpdate({ workoutType: wt.key })}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Visibility</Text>
      <View style={styles.chipRow}>
        {VISIBILITY_OPTIONS.map((vo) => (
          <Chip
            key={vo.key}
            theme={theme}
            label={`${vo.icon} ${vo.label}`}
            selected={draft.metadata.visibility === vo.key}
            onPress={() => onUpdate({ visibility: vo.key })}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        RPE (Optional)
      </Text>
      <View style={styles.rpeRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            style={[
              styles.rpeButton,
              draft.metadata.rpe === n && styles.rpeButtonActive,
            ]}
            onPress={() => onUpdate({ rpe: n })}
            accessibilityLabel={`RPE ${n}`}
          >
            <Text
              style={[
                styles.rpeText,
                draft.metadata.rpe === n && styles.rpeTextActive,
              ]}
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        Notes (Optional)
      </Text>
      <TextInput
        style={styles.notesInput}
        multiline
        numberOfLines={3}
        placeholder="How did it feel?"
        placeholderTextColor="#A7B1C2"
        value={draft.metadata.notes ?? ""}
        onChangeText={(t) => onUpdate({ notes: t })}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Exercise Blocks
// ---------------------------------------------------------------------------

function ExerciseBlocksStep({
  exercises,
  onAdd,
  onRemove,
}: {
  exercises: WorkoutLoggerExerciseDraft[];
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      {exercises.length === 0 ? (
        <View style={styles.emptyExercises}>
          <Text style={styles.emptyExercisesText}>
            Add your first exercise block
          </Text>
        </View>
      ) : (
        exercises.map((ex, i) => (
          <Card key={ex.clientId} theme={theme} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseNumber}>
                <Text style={styles.exerciseNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.exerciseName}>
                {ex.exerciseId || "Select exercise..."}
              </Text>
              <Pressable
                onPress={() => onRemove(i)}
                accessibilityLabel="Remove exercise"
              >
                <Text style={styles.removeBtn}>{"\u2715"}</Text>
              </Pressable>
            </View>
            <View style={styles.exerciseMeta}>
              <Chip
                theme={theme}
                label={ex.blockType.replace("_", " ")}
                selected
                size="sm"
              />
              <Text style={styles.setCount}>
                {ex.sets.length} set{ex.sets.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </Card>
        ))
      )}
      <Button
        theme={theme}
        variant="secondary"
        label="+ Add Exercise"
        onPress={onAdd}
        style={styles.addExerciseBtn}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Sets
// ---------------------------------------------------------------------------

function SetsStep({
  exercises,
  onAddSet,
  onRemoveSet,
  onQuickAdjust,
}: {
  exercises: WorkoutLoggerExerciseDraft[];
  onAddSet: (ei: number) => void;
  onRemoveSet: (ei: number, si: number) => void;
  onQuickAdjust: (
    ei: number,
    si: number,
    field: "reps" | "weightKg" | "rpe",
    delta: number,
  ) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      {exercises.map((ex, ei) => (
        <View key={ex.clientId} style={styles.setGroup}>
          <Text style={styles.setGroupTitle}>
            {ex.exerciseId || `Exercise ${ei + 1}`}
          </Text>
          {ex.sets.map((set, si) => (
            <SetRow
              key={set.clientId}
              set={set}
              index={si}
              onAdjust={(field, delta) => onQuickAdjust(ei, si, field, delta)}
              onRemove={() => onRemoveSet(ei, si)}
            />
          ))}
          <Pressable
            style={styles.addSetBtn}
            onPress={() => onAddSet(ei)}
            accessibilityLabel="Add set"
          >
            <Text style={styles.addSetText}>+ Add Set</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function SetRow({
  set,
  index,
  onAdjust,
  onRemove,
}: {
  set: WorkoutLoggerSetDraft;
  index: number;
  onAdjust: (field: "reps" | "weightKg" | "rpe", delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setIndex}>{index + 1}</Text>

      <View style={styles.setField}>
        <Text style={styles.setFieldLabel}>REPS</Text>
        <View style={styles.adjustRow}>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => onAdjust("reps", -1)}
          >
            <Text style={styles.adjustText}>-</Text>
          </Pressable>
          <Text style={styles.setFieldValue}>{set.reps ?? 0}</Text>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => onAdjust("reps", 1)}
          >
            <Text style={styles.adjustText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.setField}>
        <Text style={styles.setFieldLabel}>KG</Text>
        <View style={styles.adjustRow}>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => onAdjust("weightKg", -2.5)}
          >
            <Text style={styles.adjustText}>-</Text>
          </Pressable>
          <Text style={styles.setFieldValue}>{set.weightKg ?? 0}</Text>
          <Pressable
            style={styles.adjustBtn}
            onPress={() => onAdjust("weightKg", 2.5)}
          >
            <Text style={styles.adjustText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.setFieldSmall}>
        <Text style={styles.setFieldLabel}>RPE</Text>
        <Text style={styles.setFieldValue}>{set.rpe ?? "--"}</Text>
      </View>

      <Pressable
        style={styles.removeSetBtn}
        onPress={onRemove}
        accessibilityLabel="Remove set"
      >
        <Text style={styles.removeBtn}>{"\u2715"}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review
// ---------------------------------------------------------------------------

function ReviewStep({ draft }: { draft: WorkoutLoggerDraft }) {
  const totalSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalVolume = draft.exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets.reduce(
        (s, set) => s + (set.reps ?? 0) * (set.weightKg ?? 0),
        0,
      ),
    0,
  );

  return (
    <View style={styles.stepContainer}>
      <Card theme={theme} style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>{draft.metadata.title}</Text>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Type</Text>
          <Text style={styles.reviewValue}>{draft.metadata.workoutType}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Visibility</Text>
          <Text style={styles.reviewValue}>{draft.metadata.visibility}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Exercises</Text>
          <Text style={styles.reviewValue}>{draft.exercises.length}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Total Sets</Text>
          <Text style={styles.reviewValue}>{totalSets}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Est. Volume</Text>
          <Text style={styles.reviewValueAccent}>
            {formatVolume(totalVolume)} kg
          </Text>
        </View>
        {draft.metadata.rpe && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>RPE</Text>
            <Text style={styles.reviewValue}>{draft.metadata.rpe}/10</Text>
          </View>
        )}
      </Card>
      <Text style={styles.reviewHint}>
        {"\u{1F525}"} Protect the chain. Post the proof.
      </Text>
    </View>
  );
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return String(Math.round(kg));
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.1)",
  },
  headerTitle: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 2,
  },
  stepLabel: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#35D0FF",
    marginTop: 4,
  },
  progressBar: { marginTop: 8 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  stepContainer: {},
  sectionTitle: {
    fontFamily: "Oswald",
    fontSize: 16,
    fontWeight: "600",
    color: "#F4F6F8",
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rpeRow: { flexDirection: "row", gap: 6 },
  rpeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(141,153,174,0.08)",
  },
  rpeButtonActive: { backgroundColor: "#35D0FF" },
  rpeText: {
    fontFamily: "Roboto Mono",
    fontSize: 13,
    color: "#A7B1C2",
    fontWeight: "600",
  },
  rpeTextActive: { color: "#0E1116" },
  notesInput: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#F4F6F8",
    backgroundColor: "rgba(141,153,174,0.08)",
    borderRadius: 12,
    padding: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  // Exercise blocks
  exerciseCard: { marginBottom: 12 },
  exerciseHeader: { flexDirection: "row", alignItems: "center" },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#35D0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseNumberText: {
    fontFamily: "Roboto Mono",
    fontSize: 14,
    fontWeight: "700",
    color: "#0E1116",
  },
  exerciseName: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#F4F6F8",
    flex: 1,
    marginLeft: 10,
  },
  removeBtn: { fontSize: 16, color: "#FF6B6B", padding: 4 },
  exerciseMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  setCount: { fontFamily: "Sora", fontSize: 12, color: "#A7B1C2" },
  addExerciseBtn: { marginTop: 8 },
  emptyExercises: { alignItems: "center", padding: 40 },
  emptyExercisesText: { fontFamily: "Sora", fontSize: 15, color: "#A7B1C2" },
  // Sets
  setGroup: { marginBottom: 24 },
  setGroupTitle: {
    fontFamily: "Oswald",
    fontSize: 16,
    fontWeight: "600",
    color: "#F4F6F8",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(141,153,174,0.06)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  setIndex: {
    fontFamily: "Roboto Mono",
    fontSize: 14,
    color: "#A7B1C2",
    width: 24,
    textAlign: "center",
  },
  setField: { flex: 1, alignItems: "center" },
  setFieldSmall: { width: 50, alignItems: "center" },
  setFieldLabel: {
    fontFamily: "Sora",
    fontSize: 9,
    color: "#A7B1C2",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  setFieldValue: {
    fontFamily: "Roboto Mono",
    fontSize: 18,
    fontWeight: "700",
    color: "#F4F6F8",
    minWidth: 36,
    textAlign: "center",
  },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  adjustBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(53,208,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  adjustText: {
    fontFamily: "Roboto Mono",
    fontSize: 16,
    fontWeight: "700",
    color: "#35D0FF",
  },
  removeSetBtn: { width: 28, alignItems: "center" },
  addSetBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(141,153,174,0.15)",
    borderStyle: "dashed",
    marginTop: 4,
  },
  addSetText: { fontFamily: "Sora", fontSize: 13, color: "#35D0FF" },
  // Review
  reviewCard: { marginBottom: 16 },
  reviewTitle: {
    fontFamily: "Oswald",
    fontSize: 22,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 1,
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.06)",
  },
  reviewLabel: { fontFamily: "Sora", fontSize: 14, color: "#A7B1C2" },
  reviewValue: { fontFamily: "Roboto Mono", fontSize: 14, color: "#F4F6F8" },
  reviewValueAccent: {
    fontFamily: "Roboto Mono",
    fontSize: 14,
    color: "#35D0FF",
    fontWeight: "700",
  },
  reviewHint: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#A7B1C2",
    textAlign: "center",
    marginTop: 12,
  },
  // Footer
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(141,153,174,0.1)",
    backgroundColor: "#0E1116",
  },
  footerButton: { minWidth: 100 },
  footerSpacer: { flex: 1 },
});
