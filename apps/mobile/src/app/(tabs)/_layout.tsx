import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { darkTheme } from "@kruxt/ui/theme";

const theme = darkTheme;

const TAB_ICON_SIZE = 22;

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    feed: "\u{1F4F8}",
    log: "\u{1F4AA}",
    guild: "\u{1F6E1}\uFE0F",
    rank: "\u{1F3C6}",
    profile: "\u{1F464}",
  };

  return (
    <View style={styles.tabIconContainer}>
      <Text
        style={[
          styles.tabIcon,
          { opacity: focused ? 1 : 0.5 },
        ]}
      >
        {icons[name] ?? "\u2B24"}
      </Text>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.accentPrimary,
        tabBarInactiveTintColor: theme.colors.steel,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ focused }) => <TabIcon name="feed" focused={focused} />,
          tabBarAccessibilityLabel: "Proof Feed",
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ focused }) => <TabIcon name="log" focused={focused} />,
          tabBarAccessibilityLabel: "Log Workout",
        }}
      />
      <Tabs.Screen
        name="guild"
        options={{
          title: "Guild",
          tabBarIcon: ({ focused }) => <TabIcon name="guild" focused={focused} />,
          tabBarAccessibilityLabel: "Guild Hall",
        }}
      />
      <Tabs.Screen
        name="rank"
        options={{
          title: "Rank",
          tabBarIcon: ({ focused }) => <TabIcon name="rank" focused={focused} />,
          tabBarAccessibilityLabel: "Rank Ladder",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
          tabBarAccessibilityLabel: "Your Profile",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0E1116",
    borderTopWidth: 1,
    borderTopColor: "rgba(141,153,174,0.1)",
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tabLabel: {
    fontFamily: "Sora",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 28,
  },
  tabIcon: {
    fontSize: TAB_ICON_SIZE,
  },
  activeIndicator: {
    position: "absolute",
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#35D0FF",
  },
});
