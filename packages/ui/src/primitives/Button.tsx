import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  type TextStyle,
  type GestureResponderEvent,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Button label */
  label: string;
  /** Press handler */
  onPress?: (e: GestureResponderEvent) => void;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** Theme object (required) */
  theme: KruxtTheme;
  /** Override container style */
  style?: ViewStyle;
  /** Accessibility label override */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: 32, px: 12, fontSize: 13 },
  md: { height: 44, px: 20, fontSize: 15 },
  lg: { height: 54, px: 28, fontSize: 17 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  variant = "primary",
  size = "md",
  label,
  onPress,
  loading = false,
  disabled = false,
  theme,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const s = SIZE_MAP[size];
  const isDisabled = disabled || loading;

  // -- haptic placeholder --------------------------------------------------
  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      // TODO: integrate react-native-haptics or expo-haptics here
      onPress?.(e);
    },
    [onPress],
  );

  // -- variant styles -------------------------------------------------------
  const containerStyle = getContainerStyle(variant, theme, s, isDisabled);
  const textColor = getTextColor(variant, theme, isDisabled);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        containerStyle,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            { color: textColor, fontSize: s.fontSize, fontFamily: theme.typography.body },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getContainerStyle(
  variant: ButtonVariant,
  theme: KruxtTheme,
  s: { height: number; px: number },
  isDisabled: boolean,
): ViewStyle {
  const base: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.px,
    borderRadius: theme.radii.button,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    opacity: isDisabled ? 0.45 : 1,
  };

  switch (variant) {
    case "primary":
      return { ...base, backgroundColor: theme.colors.accentPrimary };
    case "secondary":
      return {
        ...base,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: theme.colors.steel,
      };
    case "danger":
      return { ...base, backgroundColor: theme.colors.danger };
    case "ghost":
      return { ...base, backgroundColor: "transparent" };
  }
}

function getTextColor(variant: ButtonVariant, theme: KruxtTheme, isDisabled: boolean): string {
  if (isDisabled && variant === "ghost") return theme.colors.textSecondary;
  switch (variant) {
    case "primary":
      return theme.mode === "dark" ? "#0E1116" : "#FFFFFF";
    case "secondary":
      return theme.colors.steel;
    case "danger":
      return "#FFFFFF";
    case "ghost":
      return theme.colors.accentPrimary;
  }
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    textAlign: "center",
  } as TextStyle,
  pressed: {
    opacity: 0.78,
  },
});
