import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  envDir: resolve(__dirname, "../.."),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("qrcode") || id.includes("pngjs")) return "vendor-qr";
          if (id.includes("idb") || id.includes("zustand") || id.includes("zod")) return "vendor-state";
          return "vendor";
        }
      }
    }
  },
  resolve: {
    alias: {
      "@edumind-board/shared": resolve(__dirname, "../../packages/shared/src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  }
});
