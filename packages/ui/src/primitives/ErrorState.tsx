import React from "react";
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import { Button } from "./Button";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorStateProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Error icon element */
  icon?: React.ReactNode;
  /** Error message */
  message: string;
  /** Retry button handler */
  onRetry?: () => void;
  /** Retry button label override */
  retryLabel?: string;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ErrorState({
  theme,
  icon,
  message,
  onRetry,
  retryLabel = "Retry",
  style,
}: ErrorStateProps) {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      {icon && <View style={styles.icon}>{icon}</View>}

      <Text
        style={[
          styles.title,
          { color: theme.colors.danger, fontFamily: theme.typography.headline },
        ]}
      >
        Something went wrong
      </Text>

      <Text
        style={[
          styles.message,
          { color: theme.colors.textSecondary, fontFamily: theme.typography.body },
        ]}
      >
        {message}
      </Text>

      {onRetry && (
        <Button
          theme={theme}
          label={retryLabel}
          onPress={onRetry}
          variant="secondary"
          size="md"
          style={styles.retryButton}
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
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  } as TextStyle,
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  } as TextStyle,
  retryButton: {
    marginTop: 20,
  } as ViewStyle,
});
