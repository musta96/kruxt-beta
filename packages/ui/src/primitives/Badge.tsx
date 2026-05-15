import React from "react";
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "info" | "muted";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Badge text */
  label: string;
  /** Optional icon element rendered before the label */
  icon?: React.ReactNode;
  /** Size preset */
  size?: BadgeSize | string;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Badge({ theme, variant = "default", label, icon, size = "md", style }: BadgeProps) {
  const bg = getBadgeBg(variant, theme);
  const fg = getBadgeFg(variant, theme);
  const small = size === "sm";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderRadius: theme.radii.badge,
          paddingHorizontal: small ? theme.spacing.sm : theme.spacing.md,
          paddingVertical: small ? 2 : theme.spacing.xs,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[styles.label, small && styles.labelSmall, { color: fg, fontFamily: theme.typography.body }]}
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
    case "info":
      return `${theme.colors.accentPrimary}1F`;
    case "muted":
      return `${theme.colors.steel}1A`;
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
    case "info":
      return theme.colors.accentPrimary;
    case "muted":
      return theme.colors.textSecondary;
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
  labelSmall: {
    fontSize: 10,
  } as TextStyle,
});
