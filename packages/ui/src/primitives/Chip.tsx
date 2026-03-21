import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChipProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Chip label */
  label: string;
  /** Whether the chip is selected */
  selected?: boolean;
  /** Toggle handler */
  onPress?: () => void;
  /** Show a close "x" button */
  closeable?: boolean;
  /** Close handler (only relevant when closeable) */
  onClose?: () => void;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Chip({
  theme,
  label,
  selected = false,
  onPress,
  closeable = false,
  onClose,
  style,
}: ChipProps) {
  const bg = selected ? `${theme.colors.accentPrimary}26` : `${theme.colors.steel}1A`;
  const border = selected ? theme.colors.accentPrimary : `${theme.colors.steel}33`;
  const fg = selected ? theme.colors.accentPrimary : theme.colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: theme.radii.badge,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: fg, fontFamily: theme.typography.body },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {closeable && (
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
        >
          <Text style={[styles.close, { color: fg }]}>{"\u2715"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  } as ViewStyle,
  label: {
    fontSize: 13,
    fontWeight: "500",
  } as TextStyle,
  close: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: "600",
  } as TextStyle,
  pressed: {
    opacity: 0.75,
  } as ViewStyle,
});
