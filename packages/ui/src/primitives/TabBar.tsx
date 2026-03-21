import React from "react";
import {
  Pressable,
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

export interface TabBarItem {
  /** Unique key */
  key: string;
  /** Display label */
  label: string;
  /** Icon element – receives `color` via cloneElement or render prop */
  icon: (color: string) => React.ReactNode;
}

export interface TabBarProps {
  /** Theme object */
  theme: KruxtTheme;
  /** Tab definitions (max 5 recommended) */
  items: TabBarItem[];
  /** Currently active tab key */
  activeKey: string;
  /** Called when a tab is pressed */
  onTabPress: (key: string) => void;
  /** Bottom safe-area inset (pass from useSafeAreaInsets) */
  bottomInset?: number;
  /** Override container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabBar({
  theme,
  items,
  activeKey,
  onTabPress,
  bottomInset = 0,
  style,
}: TabBarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.baseSurface,
          borderTopColor: `${theme.colors.steel}1A`,
          paddingBottom: bottomInset,
        },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const color = active ? theme.colors.accentPrimary : theme.colors.textSecondary;

        return (
          <Pressable
            key={item.key}
            onPress={() => onTabPress(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            {item.icon(color)}
            <Text
              style={[
                styles.label,
                { color, fontFamily: theme.typography.body },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
  } as ViewStyle,
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  } as ViewStyle,
  label: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  } as TextStyle,
});
