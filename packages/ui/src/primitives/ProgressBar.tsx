import React, { useEffect, useRef } from "react";
import {
  Animated,
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

export interface ProgressBarProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Progress value between 0 and 1 */
  progress: number;
  /** Label displayed above the bar */
  label?: string;
  /** Show percentage text */
  showPercent?: boolean;
  /** Bar height */
  height?: number;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressBar({
  theme,
  progress,
  label,
  showPercent = false,
  height = 8,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: clamped,
      duration: 400,
      useNativeDriver: false, // width animation requires layout
    }).start();
  }, [clamped, animValue]);

  const pct = Math.round(clamped * 100);

  return (
    <View style={style} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      {(label || showPercent) && (
        <View style={styles.labelRow}>
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
          {showPercent && (
            <Text
              style={[
                styles.percent,
                { color: theme.colors.textSecondary, fontFamily: theme.typography.numeric },
              ]}
            >
              {pct}%
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.track,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: `${theme.colors.steel}33`,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: theme.colors.accentPrimary,
              width: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  } as ViewStyle,
  label: {
    fontSize: 12,
    fontWeight: "500",
  } as TextStyle,
  percent: {
    fontSize: 12,
    fontWeight: "600",
  } as TextStyle,
  track: {
    overflow: "hidden",
  } as ViewStyle,
  fill: {} as ViewStyle,
});
