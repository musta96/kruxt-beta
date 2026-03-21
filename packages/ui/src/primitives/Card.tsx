import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
  type GestureResponderEvent,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Card content */
  children: React.ReactNode;
  /** Optional header slot */
  header?: React.ReactNode;
  /** Optional footer slot */
  footer?: React.ReactNode;
  /** When provided the card becomes pressable */
  onPress?: (e: GestureResponderEvent) => void;
  /** Override container style */
  style?: ViewStyle;
  /** Accessibility label for pressable cards */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Card({
  theme,
  children,
  header,
  footer,
  onPress,
  style,
  accessibilityLabel,
}: CardProps) {
  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.baseSurface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: `${theme.colors.steel}33`, // ~20 % opacity
    overflow: "hidden",
  };

  const content = (
    <>
      {header && (
        <View style={[styles.section, { borderBottomWidth: 1, borderBottomColor: `${theme.colors.steel}1A` }]}>
          {header}
        </View>
      )}
      <View style={styles.section}>{children}</View>
      {footer && (
        <View style={[styles.section, { borderTopWidth: 1, borderTopColor: `${theme.colors.steel}1A` }]}>
          {footer}
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyle, style]} accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  section: {
    padding: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
