import React from "react";
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import { Button } from "./Button";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Icon element rendered above the title */
  icon?: React.ReactNode;
  /** Title text */
  title: string;
  /** Descriptive message */
  message?: string;
  /** Optional CTA button label */
  ctaLabel?: string;
  /** CTA press handler */
  onCtaPress?: () => void;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmptyState({
  theme,
  icon,
  title,
  message,
  ctaLabel,
  onCtaPress,
  style,
}: EmptyStateProps) {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="text"
      accessibilityLabel={`${title}${message ? `. ${message}` : ""}`}
    >
      {icon && <View style={styles.icon}>{icon}</View>}

      <Text
        style={[
          styles.title,
          { color: theme.colors.textPrimary, fontFamily: theme.typography.headline },
        ]}
      >
        {title}
      </Text>

      {message && (
        <Text
          style={[
            styles.message,
            { color: theme.colors.textSecondary, fontFamily: theme.typography.body },
          ]}
        >
          {message}
        </Text>
      )}

      {ctaLabel && onCtaPress && (
        <Button
          theme={theme}
          label={ctaLabel}
          onPress={onCtaPress}
          variant="primary"
          size="md"
          style={styles.cta}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  } as ViewStyle,
  icon: {
    marginBottom: 16,
  } as ViewStyle,
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  } as TextStyle,
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  } as TextStyle,
  cta: {
    marginTop: 20,
  } as ViewStyle,
});
