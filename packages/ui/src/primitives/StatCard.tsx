import React from "react";
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = "up" | "down" | "neutral";
export type StatCardVariant = "compact" | "expanded";

export interface StatCardProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Stat label (e.g. "Total Volume") */
  label: string;
  /** Numeric value to display */
  value: string;
  /** Unit suffix (e.g. "kg", "reps") */
  unit?: string;
  /** Trend direction */
  trend?: TrendDirection;
  /** Trend delta text (e.g. "+12 %") */
  trendLabel?: string;
  /** Compact or expanded layout */
  variant?: StatCardVariant;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatCard({
  theme,
  label,
  value,
  unit,
  trend,
  trendLabel,
  variant = "compact",
  style,
}: StatCardProps) {
  const trendColor =
    trend === "up"
      ? theme.colors.success
      : trend === "down"
        ? theme.colors.danger
        : theme.colors.textSecondary;

  const trendArrow = trend === "up" ? "\u25B2" : trend === "down" ? "\u25BC" : "";

  const isExpanded = variant === "expanded";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.baseSurface,
          borderRadius: theme.radii.card,
          borderWidth: 1,
          borderColor: `${theme.colors.steel}33`,
          padding: isExpanded ? theme.spacing.xl : theme.spacing.lg,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
    >
      <Text
        style={[
          styles.label,
          { color: theme.colors.textSecondary, fontFamily: theme.typography.body },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      <View style={styles.valueRow}>
        <Text
          style={[
            isExpanded ? styles.valueLarge : styles.value,
            { color: theme.colors.textPrimary, fontFamily: theme.typography.numeric },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {unit && (
          <Text
            style={[
              styles.unit,
              { color: theme.colors.textSecondary, fontFamily: theme.typography.body },
            ]}
          >
            {unit}
          </Text>
        )}
      </View>

      {trend && trendLabel && (
        <View style={styles.trendRow}>
          {trendArrow !== "" && (
            <Text style={[styles.trendArrow, { color: trendColor }]}>{trendArrow}</Text>
          )}
          <Text
            style={[
              styles.trendLabel,
              { color: trendColor, fontFamily: theme.typography.body },
            ]}
          >
            {trendLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {} as ViewStyle,
  label: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  } as TextStyle,
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  } as ViewStyle,
  value: {
    fontSize: 24,
    fontWeight: "700",
  } as TextStyle,
  valueLarge: {
    fontSize: 36,
    fontWeight: "700",
  } as TextStyle,
  unit: {
    fontSize: 14,
    marginLeft: 4,
  } as TextStyle,
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  } as ViewStyle,
  trendArrow: {
    fontSize: 10,
    marginRight: 3,
  } as TextStyle,
  trendLabel: {
    fontSize: 12,
    fontWeight: "500",
  } as TextStyle,
});
