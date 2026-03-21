import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InputProps extends Omit<TextInputProps, "style"> {
  /** Theme object */
  theme: KruxtTheme;
  /** Label displayed above the input */
  label?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Error message (replaces helper text, triggers error styling) */
  error?: string;
  /** Use monospaced font for numeric inputs */
  mono?: boolean;
  /** Override container style */
  style?: ViewStyle;
  /** Override input style */
  inputStyle?: TextStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Input({
  theme,
  label,
  helperText,
  error,
  mono = false,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accentPrimary
      : `${theme.colors.steel}33`;

  const fontFamily = mono ? theme.typography.numeric : theme.typography.body;

  return (
    <View style={style}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: theme.colors.textSecondary, fontFamily: theme.typography.body },
          ]}
        >
          {label}
        </Text>
      )}

      <TextInput
        {...rest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor={theme.colors.textSecondary}
        selectionColor={theme.colors.accentPrimary}
        accessibilityLabel={label}
        accessibilityState={{ disabled: rest.editable === false }}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.basePanel,
            borderColor,
            borderRadius: theme.radii.button,
            color: theme.colors.textPrimary,
            fontFamily,
          },
          inputStyle,
        ]}
      />

      {(error || helperText) && (
        <Text
          style={[
            styles.helper,
            {
              color: error ? theme.colors.danger : theme.colors.textSecondary,
              fontFamily: theme.typography.body,
            },
          ]}
        >
          {error ?? helperText}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  } as TextStyle,
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 15,
  } as TextStyle,
  helper: {
    fontSize: 12,
    marginTop: 4,
  } as TextStyle,
});
