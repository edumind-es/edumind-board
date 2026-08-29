import { describe, expect, it } from "vitest";
import type { BoardElement } from "@edumind-board/shared";
import {
  elementoEnPunto,
  marcoEntreCajas,
  marcoEntrePuntos,
  puntoEnBorde,
  reanclarConectores
} from "./conectores";

function caja(x: number, y: number, width = 100, height = 60) {
  return { x, y, width, height };
}

function elemento(id: string, x: number, y: number, extra: Partial<BoardElement> = {}): BoardElement {
  return {
    id, type: "note", x, y, width: 100, height: 60,
    rotation: 0, zIndex: 1, opacity: 1, locked: false,
    data: { text: "", color: "#fff3c4" },
    ...extra
  } as BoardElement;
}

function conector(id: string, anclaDesde?: string, anclaHasta?: string): BoardElement {
  return {
    id, type: "connector", x: 0, y: 0, width: 100, height: 24,
    rotation: 0, zIndex: 5, opacity: 1, locked: false,
    data: {
      label: "", color: "#1a5fa8", strokeWidth: 4, style: "straight",
      arrowStart: false, arrowEnd: true,
      desde: { x: 0, y: 0.5 }, hasta: { x: 1, y: 0.5 },
      anclaDesde, anclaHasta
    }
  } as BoardElement;
}

describe("puntoEnBorde", () => {
  it("sale por el lado derecho cuando el destino está a la derecha", () => {
    const punto = puntoEnBorde(caja(0, 0), { x: 500, y: 30 });
    expect(punto.x).toBe(100);
    expect(punto.y).toBe(30);
  });

  it("sale por arriba cuando el destino está encima", () => {
    const punto = puntoEnBorde(caja(0, 0), { x: 50, y: -500 });
    expect(punto.y).toBe(0);
    expect(punto.x).toBe(50);
  });

  it("devuelve el centro si el destino coincide con él", () => {
    expect(puntoEnBorde(caja(0, 0), { x: 50, y: 30 })).toEqual({ x: 50, y: 30 });
  });
});

describe("marcoEntrePuntos", () => {
  it("envuelve los dos puntos y los normaliza dentro del recuadro", () => {
    const marco = marcoEntrePuntos({ x: 100, y: 100 }, { x: 300, y: 200 });
    expect(marco).toMatchObject({ x: 100, y: 100, width: 200, height: 100 });
    expect(marco.desde).toEqual({ x: 0, y: 0 });
    expect(marco.hasta).toEqual({ x: 1, y: 1 });
  });

  it("da un lado mínimo agarrable cuando la flecha es horizontal", () => {
    const marco = marcoEntrePuntos({ x: 0, y: 50 }, { x: 200, y: 50 });
    expect(marco.height).toBeGreaterThanOrEqual(24);
    // La línea sigue centrada verticalmente en el recuadro.
    expect(marco.desde.y).toBeCloseTo(0.5, 5);
    expect(marco.hasta.y).toBeCloseTo(0.5, 5);
  });
});

describe("marcoEntreCajas", () => {
  it("une borde con borde, no centro con centro", () => {
    const marco = marcoEntreCajas(caja(0, 0), caja(300, 0));
    // Sale del borde derecho del origen y llega al izquierdo del destino.
    expect(marco.x).toBeGreaterThanOrEqual(100);
    expect(marco.x + marco.width).toBeLessThanOrEqual(300);
  });
});

describe("reanclarConectores", () => {
  it("recoloca la flecha cuando se mueve uno de sus extremos", () => {
    const elementos = [elemento("a", 0, 0), elemento("b", 400, 300), conector("c", "a", "b")];
    const resultado = reanclarConectores(elementos, ["b"]);
    const flecha = resultado.find((e) => e.id === "c")!;
    expect(flecha).not.toBe(elementos[2]);
    expect(flecha.width).toBeGreaterThan(100);
  });

  it("no toca las flechas sin anclaje", () => {
    const elementos = [elemento("a", 0, 0), conector("c")];
    expect(reanclarConectores(elementos, ["a"])).toBe(elementos);
  });

  it("devuelve la misma lista si no se ha movido nada relevante", () => {
    const elementos = [elemento("a", 0, 0), elemento("b", 400, 0), elemento("z", 900, 0), conector("c", "a", "b")];
    expect(reanclarConectores(elementos, ["z"])).toBe(elementos);
  });

  it("respeta la flecha si lo que se ha movido es ella misma", () => {
    const elementos = [elemento("a", 0, 0), elemento("b", 400, 0), conector("c", "a", "b")];
    expect(reanclarConectores(elementos, ["c"])).toBe(elementos);
  });

  it("deja la flecha suelta si le borran un extremo, en vez de romperse", () => {
    const elementos = [elemento("a", 0, 0), conector("c", "a", "desaparecido")];
    expect(reanclarConectores(elementos, ["a"])).toBe(elementos);
  });

  it("es idempotente: reanclar dos veces no cambia nada", () => {
    const elementos = [elemento("a", 0, 0), elemento("b", 400, 300), conector("c", "a", "b")];
    const una = reanclarConectores(elementos);
    expect(reanclarConectores(una)).toBe(una);
  });
});

describe("elementoEnPunto", () => {
  it("elige el de encima cuando se solapan", () => {
    const abajo = elemento("abajo", 0, 0);
    const arriba = elemento("arriba", 0, 0, { zIndex: 9 });
    expect(elementoEnPunto([abajo, arriba], { x: 10, y: 10 })?.id).toBe("arriba");
  });

  it("nunca devuelve el elemento excluido ni una flecha", () => {
    const elementos = [elemento("a", 0, 0), conector("c", "a", "a")];
    expect(elementoEnPunto(elementos, { x: 10, y: 10 }, "a")).toBeUndefined();
  });
});
