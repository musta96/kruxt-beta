import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Field, Heading, Pill, ScreenScroll, SectionTitle } from "../ui";
import { palette, spacing } from "../theme";

const WORKOUT_TYPES = ["strength", "hyrox", "engine", "open_gym"] as const;
const VISIBILITIES = ["public", "gym", "private"] as const;

export function LogScreen() {
  const [title, setTitle] = useState("Evening HYROX");
  const [notes, setNotes] = useState("");
  const [workoutType, setWorkoutType] = useState<(typeof WORKOUT_TYPES)[number]>("hyrox");
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>("public");

  const checklist = useMemo(
    () => [
      "Session metadata",
      "Exercise blocks and sets",
      "Proof visibility review",
      "Atomic submit and feed publish"
    ],
    []
  );

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Workout Logger"
        title="Native logging shell"
        subtitle="This is the production app shell for the future native logger. The full exercise/sets submit flow is the next implementation slice."
      />

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
        <SectionTitle>Flow status</SectionTitle>
        <View style={styles.checklist}>
          {checklist.map((item, index) => (
            <View key={item} style={styles.checklistRow}>
              <Pill tone={index === 0 ? "primary" : "default"}>{index === 0 ? "Now" : "Next"}</Pill>
              <Text style={styles.checklistLabel}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Current draft: <Text style={styles.strong}>{title}</Text> · {workoutType} · {visibility}
        </Text>
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  optionRow: {
    gap: spacing.sm
  },
  checklist: {
    gap: spacing.sm
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  checklistLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "600"
  },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  strong: {
    color: palette.text,
    fontWeight: "700"
  }
});
