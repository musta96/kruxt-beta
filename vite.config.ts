import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      // Host scaffold alias
      "@": path.resolve(__dirname, "./src"),
      // KRUXT monorepo apps – host scaffold only; business logic lives here
      "@mobile": path.resolve(__dirname, "./apps/mobile/src"),
    },
  },
  server: { port: 8080, host: "::" },
}));
