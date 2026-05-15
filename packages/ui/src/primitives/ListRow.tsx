import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
  type GestureResponderEvent,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListRowProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Title text */
  title?: string;
  /** Compatibility alias for title */
  label?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Compact trailing value */
  value?: string;
  /** Show a chevron when there is no custom trailing element */
  chevron?: boolean;
  /** Override title/label text style */
  labelStyle?: TextStyle;
  /** Leading icon / avatar element */
  leading?: React.ReactNode;
  /** Trailing element (chevron, toggle, badge, etc.) */
  trailing?: React.ReactNode;
  /** Press handler; makes the row pressable */
  onPress?: (e: GestureResponderEvent) => void;
  /** Show bottom divider */
  divider?: boolean;
  /** Override container style */
  style?: ViewStyle;
  /** Accessibility label override */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListRow({
  theme,
  title,
  label,
  subtitle,
  value,
  chevron = false,
  leading,
  trailing,
  onPress,
  divider = false,
  style,
  labelStyle,
  accessibilityLabel,
}: ListRowProps) {
  const resolvedTitle = title ?? label ?? "";
  const resolvedTrailing =
    trailing ??
    (value ? (
      <Text style={[styles.value, { color: theme.colors.textSecondary, fontFamily: theme.typography.body }]}>
        {value}
      </Text>
    ) : chevron ? (
      <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>{"\u203A"}</Text>
    ) : null);

  const inner = (
    <>
      {leading && <View style={styles.leading}>{leading}</View>}

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: theme.colors.textPrimary, fontFamily: theme.typography.body },
            labelStyle,
          ]}
          numberOfLines={1}
        >
          {resolvedTitle}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.body }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {resolvedTrailing && <View style={styles.trailing}>{resolvedTrailing}</View>}
    </>
  );

  const containerStyles: ViewStyle[] = [
    styles.container,
    divider ? { borderBottomWidth: 1, borderBottomColor: `${theme.colors.steel}1A` } : {},
    style as ViewStyle,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? resolvedTitle}
        style={({ pressed }) => [...containerStyles, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={containerStyles} accessibilityLabel={accessibilityLabel ?? resolvedTitle}>
      {inner}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  } as ViewStyle,
  leading: {
    marginRight: 12,
  } as ViewStyle,
  content: {
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,
  title: {
    fontSize: 15,
    fontWeight: "500",
  } as TextStyle,
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  } as TextStyle,
  value: {
    fontSize: 13,
    fontWeight: "500",
  } as TextStyle,
  chevron: {
    fontSize: 26,
    lineHeight: 28,
  } as TextStyle,
  trailing: {
    marginLeft: 12,
  } as ViewStyle,
  pressed: {
    opacity: 0.7,
  } as ViewStyle,
});
