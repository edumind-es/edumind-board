// @vitest-environment jsdom
/**
 * Los widgets, renderizados de verdad sobre un canvas.
 *
 * Hasta ahora ninguno tenía pruebas porque todos usan react-konva y en jsdom
 * konva exige el paquete nativo `canvas`. Con él instalado se puede
 * renderizar y consultar el árbol de escena, que es donde están los textos y
 * los colores que ve la clase.
 */
import { describe, expect, it } from "vitest";

import { boardElementTypeSchema } from "@edumind-board/shared";
import { createElement } from "../lib/boardFactory";
import { pintarWidget } from "../pruebas/lienzo";

// Estos no se dibujan en el canvas: su contenido vive en un overlay HTML y
// se prueba aparte (ReproductorMusica, FileCard…).
const EN_OVERLAY = new Set(["iframe", "musica", "file", "hub", "mates3d", "mindmap"]);
const EN_CANVAS = boardElementTypeSchema.options.filter((t) => !EN_OVERLAY.has(t));

describe("todos los widgets del canvas", () => {
    it.each(EN_CANVAS)("«%s» se dibuja sin reventar", (tipo) => {
        const { stage, vista } = pintarWidget(createElement(tipo));
        // Si un widget lanza al renderizar, la pizarra entera se cae en clase.
        expect(stage.find("Shape").length + stage.find("Text").length).toBeGreaterThan(0);
        vista.unmount();
    });

    it.each(EN_CANVAS)("«%s» cabe dentro de su marco", (tipo) => {
        const el = createElement(tipo);
        const { stage, vista } = pintarWidget(el);
        const desbordan = stage
            .find("Shape")
            .filter((n) => n.x() > el.width + 40 || n.y() > el.height + 40);
        expect(desbordan.map((n) => n.getClassName())).toEqual([]);
        vista.unmount();
    });
});

describe("nota", () => {
    it("pinta el texto que tiene y con su color de fondo", () => {
        const el = createElement("note");
        if (el.type !== "note") throw new Error("tipo inesperado");
        el.data.text = "Repasar fracciones";
        el.data.color = "#ffd966";

        const { textos, rellenos, vista } = pintarWidget(el);
        expect(textos()).toContain("Repasar fracciones");
        expect(rellenos()).toContain("#ffd966");
        vista.unmount();
    });

    it("con una nota más alta, la letra crece", () => {
        const base = createElement("note");
        const alta = { ...createElement("note"), height: base.height * 3 };
        const tam = (el: typeof base) => {
            const { stage, vista } = pintarWidget(el);
            const t = stage.findOne("Text")!;
            const s = (t as unknown as { fontSize(): number }).fontSize();
            vista.unmount();
            return s;
        };
        expect(tam(alta as typeof base)).toBeGreaterThan(tam(base));
    });
});

describe("semáforo", () => {
    it("pinta las tres luces", () => {
        const { cuantos, vista } = pintarWidget(createElement("semaphore"));
        expect(cuantos("Circle")).toBeGreaterThanOrEqual(3);
        vista.unmount();
    });
});

describe("dado", () => {
    it("muestra una cara válida", () => {
        const el = createElement("dice");
        const { textos, cuantos, vista } = pintarWidget(el);
        // Según el widget, la cara puede ser número o puntos: vale cualquiera,
        // pero algo tiene que dibujar.
        const numeros = textos().map(Number).filter((n) => Number.isInteger(n));
        expect(numeros.every((n) => n >= 1 && n <= 6)).toBe(true);
        expect(cuantos("Circle") + textos().length).toBeGreaterThan(0);
        vista.unmount();
    });
});

describe("temporizador", () => {
    it("muestra el tiempo en minutos y segundos", () => {
        const { textos, vista } = pintarWidget(createElement("timer"));
        expect(textos().some((t) => /^\d{1,2}:\d{2}$/.test(t))).toBe(true);
        vista.unmount();
    });
});
