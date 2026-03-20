import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "KRUXT",
  slug: "kruxt",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "kruxt",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    backgroundColor: "#0E1116",
    resizeMode: "contain",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.kruxt.app",
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
