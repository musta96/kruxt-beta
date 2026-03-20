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
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Leading icon / avatar element */
  leading?: React.ReactNode;
  /** Trailing element (chevron, toggle, badge, etc.) */
  trailing?: React.ReactNode;
  /** Press handler – makes the row pressable */
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
  subtitle,
  leading,
  trailing,
  onPress,
  divider = false,
  style,
  accessibilityLabel,
}: ListRowProps) {
  const inner = (
    <>
      {leading && <View style={styles.leading}>{leading}</View>}

      <View style={styles.content}>
        <Text
          style={[styles.title, { color: theme.colors.textPrimary, fontFamily: theme.typography.body }]}
          numberOfLines={1}
        >
          {title}
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

      {trailing && <View style={styles.trailing}>{trailing}</View>}
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
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [...containerStyles, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={containerStyles} accessibilityLabel={accessibilityLabel ?? title}>
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
  trailing: {
    marginLeft: 12,
  } as ViewStyle,
  pressed: {
    opacity: 0.7,
  } as ViewStyle,
});
