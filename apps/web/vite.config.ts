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
  envDir: resolve(import.meta.dirname, "../.."),
  build: {
    rolldownOptions: {
      output: {
        // Troceado explícito por grupos: la API nativa de rolldown, que es el
        // empaquetador de Vite desde la 8. `manualChunks` sigue aceptándose por
        // compatibilidad, pero rolldown NO lo respeta del todo: reasignaba
        // zustand a vendor-3d aunque la función lo mandara a vendor-state.
        //
        // Gana la `priority` más alta, y el módulo capturado se retira de los
        // demás grupos.
        codeSplitting: {
          // Rolldown, por defecto, mete tambien las DEPENDENCIAS de lo que
          // captura un grupo. Con eso vendor-3d se llevaba react/jsx-runtime,
          // scheduler e its-fine —nucleo que carga siempre— y el chunk 3D
          // acababa en el arranque. Rollup (Vite 6) nunca lo hizo: asignaba
          // solo el modulo que casaba, y es el reparto que queremos.
          includeDependenciesRecursively: false,
          groups: [
            // El helper de precarga de Vite lo comparten index y los chunks
            // perezosos: en un chunk propio diminuto nadie arrastra a nadie.
            { name: "preload", test: /vite[\\/]preload-helper/, priority: 50 },

            { name: "vendor-qr", test: /[\\/]node_modules[\\/](qrcode|pngjs)[\\/]/, priority: 40 },

            // ⚠️ vendor-state va POR DELANTE de vendor-3d a propósito. zustand
            // lo usan el store de la app (que carga siempre) y
            // @react-three/fiber (que carga en diferido). Si zustand cae del
            // lado del 3D, el chunk de 910 kB entra en el camino inicial porque
            // el store lo necesita al arrancar: pasó al subir a Vite 8 y el
            // index.html acabó precargándolo. Es la misma trampa anotada abajo
            // para react-reconciler e its-fine con react-konva.
            { name: "vendor-state", test: /[\\/]node_modules[\\/](idb|zustand|zod)[\\/]/, priority: 30 },

            // Motor 3D y transitivas de drei/fiber: chunk perezoso, nunca eager.
            // OJO: react-reconciler e its-fine NO van aquí — react-konva (eager)
            // también los usa y crearían un ciclo que arrastraría todo el 3D.
            {
              name: "vendor-3d",
              test: /[\\/]node_modules[\\/](three|three-stdlib|@react-three|maath|camera-controls|detect-gpu|glsl-noise|troika|meshline|stats-gl|stats\.js|three-mesh-bvh|suspend-react|webgl-sdf-generator|bidi-js|hls\.js|tunnel-rat|utility-types|react-composer|@mediapipe|draco)[\\/]/,
              priority: 20
            },

            { name: "vendor", test: /[\\/]node_modules[\\/]/, priority: 10 }
          ]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@edumind-board/shared": resolve(import.meta.dirname, "../../packages/shared/src")
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
