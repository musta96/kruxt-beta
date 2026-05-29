import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "KRUXT",
  slug: "kruxt-mobile",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "kruxt",
  userInterfaceStyle: "dark",
  assetBundlePatterns: ["assets/**/*"],
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    backgroundColor: "#0E1116",
    resizeMode: "contain",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.kruxt.mobile",
    buildNumber: "1",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription: "KRUXT uses your photo library when you choose a profile avatar."
    }
  },
  android: {
    package: "com.kruxt.mobile",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0E1116"
    }
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
