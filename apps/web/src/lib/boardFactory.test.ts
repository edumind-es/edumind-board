/**
 * La fábrica de elementos, contra el esquema de verdad.
 *
 * Es una prueba pequeña que cubre mucho: recorre TODOS los tipos de elemento
 * declarados y comprueba que lo que fabrica pasa el esquema zod que valida
 * el servidor. Si alguien añade un tipo y se olvida de la fábrica, o cambia
 * el esquema y deja la fábrica desfasada, falla aquí y no en clase.
 */
import { boardElementSchema, boardElementTypeSchema } from "@edumind-board/shared";
import { describe, expect, it } from "vitest";

import { createElement, createIframePreset, createMusicaPreset } from "./boardFactory";

const TIPOS = boardElementTypeSchema.options;

describe("createElement", () => {
    it("cubre todos los tipos declarados, sin olvidarse de ninguno", () => {
        expect(TIPOS.length).toBeGreaterThan(20);
        for (const tipo of TIPOS) {
            expect(() => createElement(tipo)).not.toThrow();
        }
    });

    it.each(TIPOS)("«%s» produce un elemento que el servidor aceptaría", (tipo) => {
        const elemento = createElement(tipo);
        const resultado = boardElementSchema.safeParse(elemento);
        expect(
            resultado.success ? [] : resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
        ).toEqual([]);
    });

    it.each(TIPOS)("«%s» tiene tamaño y posición utilizables", (tipo) => {
        const e = createElement(tipo);
        expect(e.type).toBe(tipo);
        expect(e.width).toBeGreaterThan(0);
        expect(e.height).toBeGreaterThan(0);
        expect(Number.isFinite(e.x)).toBe(true);
        expect(Number.isFinite(e.y)).toBe(true);
    });

    it("cada elemento nace con su propio identificador", () => {
        const ids = TIPOS.map((t) => createElement(t).id);
        expect(new Set(ids).size).toBe(ids.length);
        // Y dos del mismo tipo tampoco lo comparten.
        expect(createElement("text").id).not.toBe(createElement("text").id);
    });
});

describe("presets", () => {
    it("el de música apunta al modo pedido y es válido", () => {
        const e = createMusicaPreset("grupal", "Música · Grupal");
        expect(boardElementSchema.safeParse(e).success).toBe(true);
        expect(e.type).toBe("musica");
        if (e.type === "musica") {
            expect(e.data.modeId).toBe("grupal");
            expect(e.data.titulo).toBe("Música · Grupal");
        }
    });

    it("el de iframe conserva la URL y el título", () => {
        const e = createIframePreset("https://w.soundcloud.com/player/?url=abc", "Música · Individual");
        expect(boardElementSchema.safeParse(e).success).toBe(true);
        if (e.type === "iframe") {
            expect(e.data.url).toContain("w.soundcloud.com");
            expect(e.data.title).toBe("Música · Individual");
        }
    });

    it("Spotify ya no es un dominio embebible", () => {
        // Se retiró del panel de música: incrustado sólo sonaba 30 s. Si volviera
        // a colarse en la lista de dominios, esto lo cazaría.
        const e = createIframePreset("https://open.spotify.com/embed/playlist/abc", "Prueba");
        expect(boardElementSchema.safeParse(e).success).toBe(false);
    });

    it("un iframe con una URL no permitida no pasa el esquema", () => {
        // El esquema restringe los dominios embebibles: si esto dejara de ser
        // cierto, cualquier sitio podría colarse dentro de la pizarra.
        const e = createIframePreset("https://sitio-cualquiera.example/loquesea", "Prueba");
        expect(boardElementSchema.safeParse(e).success).toBe(false);
    });
});
