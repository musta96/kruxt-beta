import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";

import { AuthLandingScreen } from "./screens/AuthLandingScreen";
import { FeedScreen } from "./screens/FeedScreen";
import { LogScreen } from "./screens/LogScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { NativeSessionProvider, useNativeSession } from "./session";
import { palette } from "./theme";

const Tabs = createBottomTabNavigator();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.primary,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
    notification: palette.danger
  }
};

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.background,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800" }}>KRUXT</Text>
      <Text style={{ color: palette.textMuted, marginTop: 8 }}>Loading your mobile workspace...</Text>
    </View>
  );
}

function emojiForRoute(routeName: string): string {
  if (routeName === "Feed") return "🔥";
  if (routeName === "Log") return "✍️";
  return "👤";
}

function AuthenticatedTabs() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tabs.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            height: 70,
            paddingBottom: 10,
            paddingTop: 10
          },
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18, marginTop: 2 }}>{emojiForRoute(route.name)}</Text>
          )
        })}
      >
        <Tabs.Screen name="Feed" component={FeedScreen} />
        <Tabs.Screen name="Log" component={LogScreen} />
        <Tabs.Screen name="Profile" component={ProfileScreen} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

function NativeRoot() {
  const { state } = useNativeSession();

  if (state.status === "loading") {
    return <LoadingScreen />;
  }

  if (!state.access.user) {
    return <AuthLandingScreen />;
  }

  return <AuthenticatedTabs />;
}

export function NativeApp() {
  return (
    <NativeSessionProvider>
      <NativeRoot />
    </NativeSessionProvider>
  );
}
