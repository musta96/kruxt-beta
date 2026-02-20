import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@kruxt/types": path.resolve(__dirname, "./packages/types/src/index.ts"),
      "@kruxt/ui": path.resolve(__dirname, "./packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 8080,
    host: "::",
  },
});
