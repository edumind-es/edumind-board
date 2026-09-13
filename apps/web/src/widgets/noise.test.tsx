// @vitest-environment jsdom
/**
 * El medidor de ruido, dibujado de verdad.
 *
 * Lo que se protege: que la escalera de niveles de voz esté completa y en
 * orden (arriba el patio, abajo el silencio) y que el límite que fija el
 * docente se vea marcado en el escalón correcto.
 */
import { describe, expect, it } from "vitest";

import { createElement } from "../lib/boardFactory";
import { NIVELES_VOZ, nivelDesdeVolumen } from "../lib/nivelesVoz";
import { pintarWidget } from "../pruebas/lienzo";

function medidor(limite: number) {
    const el = createElement("noise");
    if (el.type !== "noise") throw new Error("no es un medidor");
    return { ...el, data: { ...el.data, limite } };
}

describe("medidor de ruido", () => {
    it("enseña los seis niveles de voz con su nombre", () => {
        const { textos, vista } = pintarWidget(medidor(2));
        for (const n of NIVELES_VOZ) expect(textos()).toContain(n.nombre);
        vista.unmount();
    });

    it("el silencio va abajo y el patio arriba: es una escalera, no una lista", () => {
        const { stage, vista } = pintarWidget(medidor(2));
        const y = (nombre: string) =>
            stage.find("Text").find((t) => (t as never as { text(): string }).text() === nombre)!.getAbsolutePosition().y;
        expect(y("Silencio")).toBeGreaterThan(y("Patio"));
        expect(y("Voz baja")).toBeGreaterThan(y("Voz normal"));
        vista.unmount();
    });

    it("marca el límite a la altura del escalón elegido", () => {
        const alturaLimite = (limite: number) => {
            const { stage, vista } = pintarWidget(medidor(limite));
            // La línea del límite lleva la altura en sus puntos, no en su posición.
            const puntos = (stage.find("Line")[0] as never as { points(): number[] }).points();
            vista.unmount();
            return puntos[1]!;
        };
        // Un límite más alto = la línea más arriba en pantalla.
        expect(alturaLimite(4)).toBeLessThan(alturaLimite(1));
    });

    it("el contador de avisos empieza a cero", () => {
        const { textos, vista } = pintarWidget(medidor(2));
        expect(textos()).toContain("Avisos: 0");
        vista.unmount();
    });
});

describe("niveles de voz", () => {
    it("un volumen de biblioteca es nivel 0 y uno de patio, 5", () => {
        expect(nivelDesdeVolumen(0)).toBe(0);
        expect(nivelDesdeVolumen(95)).toBe(5);
    });

    it("no baja de escalón por un bache: sin histéresis parpadearía", () => {
        // Justo por debajo del borde del nivel 3, viniendo del 3.
        expect(nivelDesdeVolumen(NIVELES_VOZ[3]!.desde - 2, 3)).toBe(3);
        // Si baja de verdad, sí cambia.
        expect(nivelDesdeVolumen(NIVELES_VOZ[3]!.desde - 10, 3)).toBeLessThan(3);
    });
});
