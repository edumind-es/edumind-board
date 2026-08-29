/**
 * El esquema que producen las migraciones tiene que coincidir con la
 * instantanea guardada en esquema.json.
 *
 * Cualquier cambio de esquema obliga a regenerar el fichero, asi que el
 * cambio se ve en la revision en lugar de colarse. Para regenerarlo:
 *   ACTUALIZAR_ESQUEMA=1 npm --workspace @edumind-board/api run test
 */
import Database from "better-sqlite3";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { aplicarMigraciones, MIGRACIONES, versionEsperada } from "../src/migraciones.js";
// @ts-expect-error -- utilidad compartida con el script de produccion, sin tipos
import { comparar, extraerEsquema } from "../scripts/esquema-lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTA_ESQUEMA = resolve(AQUI, "../esquema.json");

function baseNueva() {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    aplicarMigraciones(db);
    return db;
}

describe("migraciones", () => {
    it("dejan la base en la version que declara el codigo", () => {
        const db = baseNueva();
        expect(db.pragma("user_version", { simple: true })).toBe(versionEsperada());
        db.close();
    });

    it("son idempotentes: aplicarlas dos veces no cambia nada", () => {
        const db = baseNueva();
        const antes = extraerEsquema(db);
        aplicarMigraciones(db);
        expect(extraerEsquema(db)).toEqual(antes);
        db.close();
    });

    it("estan numeradas de forma consecutiva desde 1", () => {
        MIGRACIONES.forEach((m, i) => expect(m.version).toBe(i + 1));
    });

    it("producen el esquema guardado en esquema.json", () => {
        const db = baseNueva();
        const real = extraerEsquema(db);
        db.close();

        if (process.env.ACTUALIZAR_ESQUEMA === "1") {
            writeFileSync(RUTA_ESQUEMA, `${JSON.stringify(real, null, 2)}\n`);
            return;
        }

        const esperado = JSON.parse(readFileSync(RUTA_ESQUEMA, "utf8"));
        const fallos = comparar(esperado, real);
        expect(
            fallos,
            `El esquema ha cambiado. Si es a proposito, regenera la instantanea con:\n` +
                `  ACTUALIZAR_ESQUEMA=1 npm --workspace @edumind-board/api run test\n\n` +
                fallos.join("\n")
        ).toEqual([]);
    });
});
