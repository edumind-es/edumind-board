import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Por defecto entorno node: la lógica (store, geometría, plantillas) no
// necesita navegador y así las pruebas son instantáneas. Los componentes
// piden jsdom fichero a fichero con `// @vitest-environment jsdom`, que es
// explícito y no encarece al resto.
export default defineConfig({
    resolve: {
        alias: {
            // El mismo alias que vite.config.ts. Sin él, las pruebas resolvían
            // `@edumind-board/shared` a su `dist` COMPILADO: validaban la
            // versión desplegada del esquema, no la que se está tocando, y un
            // cambio en los esquemas pasaba en verde sin haberse probado.
            "@edumind-board/shared": resolve(__dirname, "../../packages/shared/src")
        }
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        setupFiles: ["./src/pruebas/preparar.ts"]
    }
});
