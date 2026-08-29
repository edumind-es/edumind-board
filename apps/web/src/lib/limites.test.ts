/**
 * Las cifras de tamaño y, sobre todo, la regla de la que salen: EDUmind Board
 * NO guarda archivos de nadie. Si alguien vuelve a añadir una subida, esta
 * prueba debería ser lo primero que se lo diga.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    enMegas,
    MAX_CUERPO_PETICION_BYTES,
    MAX_LOCAL_BYTES,
    NGINX_MAX_BODY_MB
} from "@edumind-board/shared";

function leer(ruta: string) {
    return readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");
}

describe("límites de tamaño", () => {
    it("nginx cubre el cuerpo de petición más grande que enviamos", () => {
        expect(NGINX_MAX_BODY_MB * 1024 * 1024).toBeGreaterThanOrEqual(MAX_CUERPO_PETICION_BYTES);
    });

    it("lo que cabe en el navegador es mucho mayor que lo que viaja al servidor", () => {
        // No es casualidad: el archivo no viaja, así que el límite lo pone el
        // navegador del docente y no nuestro disco.
        expect(MAX_LOCAL_BYTES).toBeGreaterThan(MAX_CUERPO_PETICION_BYTES);
    });

    it("los mensajes salen en castellano y con coma decimal", () => {
        expect(enMegas(8 * 1024 * 1024)).toBe("8 MB");
        expect(enMegas(1.5 * 1024 * 1024)).toBe("1,5 MB");
    });
});

describe("ningún archivo llega al servidor", () => {
    it("el cliente del API no tiene función de subida", () => {
        expect(leer("./api.ts")).not.toContain("uploadAsset");
    });

    it("importar un archivo solo escribe en el almacén local", () => {
        const app = leer("../App.tsx");
        expect(app).toContain("guardarArchivoLocal");
        // Ni subida al servidor ni base64 empotrado (que acabaría en nuestra
        // base en cuanto el docente publicase el tablero).
        expect(app).not.toContain("uploadAsset");
        expect(app).not.toContain("readAsDataURL");
    });

    it("el API no expone ninguna ruta de subida", () => {
        expect(leer("../../../api/src/app.ts")).not.toContain("uploadRoutes");
    });
});
