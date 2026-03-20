import React from "react";
import { Image, StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import type { KruxtTheme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Size preset */
  size?: AvatarSize;
  /** Image URI – when absent, initials are rendered */
  imageUri?: string;
  /** Initials (1-2 chars) shown when no image */
  initials?: string;
  /** Show an online indicator dot */
  online?: boolean;
  /** Show accent ring (rank / achievement highlight) */
  ring?: boolean;
  /** Override container style */
  style?: ViewStyle;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 36,
};

const DOT_SIZE_MAP: Record<AvatarSize, number> = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Avatar({
  theme,
  size = "md",
  imageUri,
  initials,
  online,
  ring = false,
  style,
  accessibilityLabel,
}: AvatarProps) {
  const dim = SIZE_MAP[size];
  const half = dim / 2;
  const dotDim = DOT_SIZE_MAP[size];

  const containerStyle: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: half,
    backgroundColor: theme.colors.basePanel,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...(ring
      ? { borderWidth: 2, borderColor: theme.colors.accentPrimary }
      : {}),
  };

  return (
    <View
      style={[containerStyle, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? initials ?? "Avatar"}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: dim, height: dim, borderRadius: half }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize: FONT_SIZE_MAP[size],
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.headline,
            },
          ]}
          numberOfLines={1}
        >
          {initials?.toUpperCase() ?? "?"}
        </Text>
      )}

      {online && (
        <View
          style={[
            styles.dot,
            {
              width: dotDim,
              height: dotDim,
              borderRadius: dotDim / 2,
              backgroundColor: theme.colors.success,
              borderColor: theme.colors.baseSurface,
              borderWidth: 2,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  initials: {
    fontWeight: "700",
    textAlign: "center",
  } as TextStyle,
  dot: {
    position: "absolute",
  } as ViewStyle,
});
