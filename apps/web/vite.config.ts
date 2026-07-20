import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Sustituye al sw.js manual: precachea automáticamente los assets
    // hasheados del build, con bump de versión implícito en cada release.
    // Modo "prompt": el registro (src/lib/registerPwa.ts) controla cuándo se
    // aplica la actualización — avisa al docente y la aplica al salir de la
    // pestaña, evitando recargas en mitad de una clase.
    VitePWA({
      filename: "sw.js",
      registerType: "prompt",
      // El manifest existente en public/ se mantiene como fuente de verdad
      manifest: false,
      injectRegister: null,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest,woff,woff2}"],
        navigateFallback: "/index.html",
        // El API y los streams SSE nunca pasan por el service worker
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Los bundles de Konva/React/three superan el límite por defecto (2MB)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  envDir: resolve(__dirname, "../.."),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // El helper de precarga de Vite lo comparten index y los chunks
          // perezosos: en un chunk propio diminuto nadie arrastra a nadie.
          if (id.includes("vite/preload-helper")) return "preload";
          if (!id.includes("node_modules")) return;
          if (id.includes("qrcode") || id.includes("pngjs")) return "vendor-qr";
          // Motor 3D y transitivas de drei/fiber: chunk perezoso, nunca eager.
          // OJO: react-reconciler e its-fine NO van aquí — react-konva (eager)
          // también los usa y crearían un ciclo que arrastraría todo el 3D.
          if (/[\\/]node_modules[\\/](three|three-stdlib|@react-three|maath|camera-controls|detect-gpu|glsl-noise|troika|meshline|stats-gl|stats\.js|three-mesh-bvh|suspend-react|webgl-sdf-generator|bidi-js|hls\.js|tunnel-rat|utility-types|react-composer|@mediapipe|draco)/.test(id)) {
            return "vendor-3d";
          }
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
    // Puertos dedicados al dev de board (esta máquina es compartida: 3100 y 5173
    // los ocupan otros servicios). El runner scripts/dev.mjs es la fuente de
    // verdad vía EDUMIND_DEV_WEB_PORT; ese caso fija el puerto (strictPort) para
    // no derivar en silencio y romper el proxy. En `dev:web` suelto usa 5180.
    port: Number(process.env.EDUMIND_DEV_WEB_PORT ?? 5180),
    strictPort: Boolean(process.env.EDUMIND_DEV_WEB_PORT),
    // En dev el frontend trabaja same-origin: /api y /health se reenvían al
    // backend. Así las cookies de sesión del SSO funcionan sin configurar CORS
    // ni VITE_API_BASE_URL. Los streams SSE (share/sala) también pasan por aquí.
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:3110",
        changeOrigin: true
      },
      "/health": {
        target: process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:3110",
        changeOrigin: true
      }
    }
  }
});
