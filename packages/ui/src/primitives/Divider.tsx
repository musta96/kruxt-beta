import React from "react";
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DividerProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Optional label rendered in the centre of the line */
  label?: string;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Divider({ theme, label, style }: DividerProps) {
  const lineColor = `${theme.colors.steel}33`;

  if (!label) {
    return (
      <View
        style={[styles.line, { backgroundColor: lineColor }, style]}
        accessibilityRole="none"
      />
    );
  }

  return (
    <View style={[styles.container, style]} accessibilityRole="none">
      <View style={[styles.flex, { backgroundColor: lineColor }]} />
      <Text
        style={[
          styles.label,
          { color: theme.colors.textSecondary, fontFamily: theme.typography.body },
        ]}
      >
        {label}
      </Text>
      <View style={[styles.flex, { backgroundColor: lineColor }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  line: {
    height: 1,
    width: "100%",
  } as ViewStyle,
  container: {
    flexDirection: "row",
    alignItems: "center",
  } as ViewStyle,
  flex: {
    flex: 1,
    height: 1,
  } as ViewStyle,
  label: {
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 12,
  } as TextStyle,
});
