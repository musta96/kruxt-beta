import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Width (number or string like "100%") */
  width?: number | string;
  /** Height */
  height?: number;
  /** Border radius override */
  borderRadius?: number;
  /** Override container style */
  style?: ViewStyle;
}

export interface SkeletonPresetProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Core shimmer component
// ---------------------------------------------------------------------------

export function Skeleton({
  theme,
  width = "100%",
  height = 16,
  borderRadius = 6,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="none"
      accessibilityLabel="Loading"
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: theme.colors.basePanel,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Preset: Card skeleton
// ---------------------------------------------------------------------------

export function CardSkeleton({ theme, style }: SkeletonPresetProps) {
  return (
    <View
      style={[
        skeletonStyles.card,
        {
          backgroundColor: theme.colors.baseSurface,
          borderRadius: theme.radii.card,
          borderWidth: 1,
          borderColor: `${theme.colors.steel}33`,
          padding: theme.spacing.lg,
        },
        style,
      ]}
    >
      <Skeleton theme={theme} width="40%" height={12} style={{ marginBottom: 12 }} />
      <Skeleton theme={theme} width="70%" height={24} style={{ marginBottom: 8 }} />
      <Skeleton theme={theme} width="55%" height={12} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset: Row skeleton
// ---------------------------------------------------------------------------

export function RowSkeleton({ theme, style }: SkeletonPresetProps) {
  return (
    <View style={[skeletonStyles.row, style]}>
      <Skeleton theme={theme} width={40} height={40} borderRadius={20} />
      <View style={skeletonStyles.rowText}>
        <Skeleton theme={theme} width="60%" height={14} style={{ marginBottom: 6 }} />
        <Skeleton theme={theme} width="40%" height={12} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset: Stat skeleton
// ---------------------------------------------------------------------------

export function StatSkeleton({ theme, style }: SkeletonPresetProps) {
  return (
    <View
      style={[
        skeletonStyles.stat,
        {
          backgroundColor: theme.colors.baseSurface,
          borderRadius: theme.radii.card,
          borderWidth: 1,
          borderColor: `${theme.colors.steel}33`,
          padding: theme.spacing.lg,
        },
        style,
      ]}
    >
      <Skeleton theme={theme} width="50%" height={10} style={{ marginBottom: 8 }} />
      <Skeleton theme={theme} width="35%" height={28} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const skeletonStyles = StyleSheet.create({
  card: {} as ViewStyle,
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  } as ViewStyle,
  rowText: {
    flex: 1,
    marginLeft: 12,
  } as ViewStyle,
  stat: {} as ViewStyle,
});
