import React from "react";
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Badge text */
  label: string;
  /** Optional icon element rendered before the label */
  icon?: React.ReactNode;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Badge({ theme, variant = "default", label, icon, style }: BadgeProps) {
  const bg = getBadgeBg(variant, theme);
  const fg = getBadgeFg(variant, theme);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderRadius: theme.radii.badge,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[styles.label, { color: fg, fontFamily: theme.typography.body }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBadgeBg(variant: BadgeVariant, theme: KruxtTheme): string {
  switch (variant) {
    case "default":
      return `${theme.colors.steel}33`;
    case "accent":
      return `${theme.colors.accentPrimary}26`;
    case "success":
      return `${theme.colors.success}26`;
    case "warning":
      return `${theme.colors.warning}26`;
    case "danger":
      return `${theme.colors.danger}26`;
  }
}

function getBadgeFg(variant: BadgeVariant, theme: KruxtTheme): string {
  switch (variant) {
    case "default":
      return theme.colors.steel;
    case "accent":
      return theme.colors.accentPrimary;
    case "success":
      return theme.colors.success;
    case "warning":
      return theme.colors.warning;
    case "danger":
      return theme.colors.danger;
  }
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  } as ViewStyle,
  icon: {
    marginRight: 4,
  } as ViewStyle,
  label: {
    fontSize: 12,
    fontWeight: "600",
  } as TextStyle,
});
