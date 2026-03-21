import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    command === "serve" && mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mobile": path.resolve(__dirname, "./apps/mobile/src"),
      "@admin": path.resolve(__dirname, "./apps/admin/src"),
      "@kruxt/types": path.resolve(__dirname, "./packages/types/src/index.ts"),
    },
  },
  server: { port: 8080, host: "::" },
}));
