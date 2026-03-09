import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner, Button, Card, Field, Heading, Pill, ScreenScroll, SectionTitle } from "../ui";
import { palette, spacing } from "../theme";
import { createWorkoutLoggerRuntimeServices } from "../../workout-logger/runtime-services";
import type { ExerciseOption, WorkoutDraft } from "../../workout-logger/types";

const WORKOUT_TYPES = ["strength", "functional", "hyrox", "conditioning"] as const;
const VISIBILITIES = ["public", "followers", "gym", "private"] as const;

export function LogScreen() {
  const services = useMemo(() => createWorkoutLoggerRuntimeServices(), []);
  const [title, setTitle] = useState("Evening HYROX");
  const [notes, setNotes] = useState("");
  const [workoutType, setWorkoutType] = useState<(typeof WORKOUT_TYPES)[number]>("hyrox");
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>("public");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseOption[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null);
  const [reps, setReps] = useState("12");
  const [weightKg, setWeightKg] = useState("40");
  const [rpe, setRpe] = useState("7");
  const [loadingResults, setLoadingResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExerciseSearch(query: string) {
    setExerciseQuery(query);
    setSelectedExercise(null);

    if (query.trim().length < 2) {
      setExerciseResults([]);
      return;
    }

    setLoadingResults(true);
    try {
      const results = await services.searchExercises(query);
      setExerciseResults(results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to search exercises.");
    } finally {
      setLoadingResults(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!selectedExercise) {
        throw new Error("Select one exercise before submitting.");
      }

      const repCount = Number(reps);
      const weightValue = Number(weightKg);
      const rpeValue = Number(rpe);

      const draft: WorkoutDraft = {
        metadata: {
          title,
          workoutType,
          visibility,
          notes,
          startedAt: new Date().toISOString(),
          rpe: Number.isFinite(rpeValue) ? rpeValue : undefined
        },
        exercises: [
          {
            clientId: `native_ex_${Date.now()}`,
            exerciseId: selectedExercise.id,
            exerciseName: selectedExercise.name,
            blockType: "straight_set",
            notes,
            sets: [
              {
                clientId: `native_set_${Date.now()}`,
                reps: Number.isFinite(repCount) ? repCount : undefined,
                weightKg: Number.isFinite(weightValue) ? weightValue : undefined,
                rpe: Number.isFinite(rpeValue) ? rpeValue : undefined
              }
            ]
          }
        ]
      };

      const result = await services.submit(draft);
      setSuccess(
        `Workout logged. XP ${result.xpDelta.xpBefore} -> ${result.xpDelta.xpAfter}. Chain ${result.xpDelta.chainDaysBefore} -> ${result.xpDelta.chainDaysAfter}.`
      );
      setTitle("Evening HYROX");
      setNotes("");
      setExerciseQuery("");
      setExerciseResults([]);
      setSelectedExercise(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to log workout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Workout Logger"
        title="Log a training session"
        subtitle="This native baseline now submits a real minimal workout: one selected exercise with one set."
      />

      {success ? <Banner message={success} tone="success" /> : null}
      {error ? <Banner message={error} tone="danger" /> : null}

      <Card>
        <SectionTitle>Session metadata</SectionTitle>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Morning strength" />
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional session notes"
          multiline
        />
      </Card>

      <Card>
        <SectionTitle>Workout type</SectionTitle>
        <View style={styles.optionRow}>
          {WORKOUT_TYPES.map((option) => (
            <Button
              key={option}
              tone={workoutType === option ? "primary" : "secondary"}
              onPress={() => setWorkoutType(option)}
            >
              {option}
            </Button>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Visibility</SectionTitle>
        <View style={styles.optionRow}>
          {VISIBILITIES.map((option) => (
            <Button
              key={option}
              tone={visibility === option ? "primary" : "secondary"}
              onPress={() => setVisibility(option)}
            >
              {option}
            </Button>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Exercise</SectionTitle>
        <Field
          label="Search exercise"
          value={exerciseQuery}
          onChangeText={(value) => {
            void handleExerciseSearch(value);
          }}
          placeholder="Search exercise catalog"
          autoCapitalize="none"
        />
        {loadingResults ? <Text style={styles.note}>Searching exercises...</Text> : null}
        {selectedExercise ? (
          <View style={styles.selectedRow}>
            <Pill tone="primary">{selectedExercise.name}</Pill>
          </View>
        ) : null}
        <View style={styles.resultList}>
          {exerciseResults.map((result) => (
            <Pressable
              key={result.id}
              onPress={() => {
                setSelectedExercise(result);
                setExerciseQuery(result.name);
                setExerciseResults([]);
              }}
              style={styles.resultRow}
            >
              <Text style={styles.resultLabel}>{result.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Set</SectionTitle>
        <Field label="Reps" value={reps} onChangeText={setReps} placeholder="12" autoCapitalize="none" />
        <Field label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} placeholder="40" autoCapitalize="none" />
        <Field label="RPE" value={rpe} onChangeText={setRpe} placeholder="7" autoCapitalize="none" />
      </Card>

      <Button onPress={handleSubmit} loading={submitting}>Log workout</Button>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  optionRow: {
    gap: spacing.sm
  },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  selectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  resultList: {
    gap: spacing.xs
  },
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised
  },
  resultLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "600"
  }
});
