// Los dos ensanchamientos del esquema que hicieron falta para archivos grandes
// y para enlazar la nube del centro. Se prueban aquí porque son justo el sitio
// donde una regla de seguridad se puede aflojar sin querer.
import { describe, expect, it } from "vitest";
import { assertBoardEmbedsAllowed, boardElementSchema, type BoardDocument } from "@edumind-board/shared";
import { createEmptyBoard } from "./boardFactory";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  x: 0, y: 0, width: 300, height: 200,
  rotation: 0, zIndex: 1, opacity: 1, locked: false
};

function tableroCon(elemento: unknown): BoardDocument {
  return { ...createEmptyBoard(), elements: [elemento] } as BoardDocument;
}

describe("archivos guardados en el navegador", () => {
  it("acepta una URL local:<id>", () => {
    const resultado = boardElementSchema.safeParse({
      ...base, type: "file",
      data: { url: "local:abc-123", name: "ficha.pdf", mimeType: "application/pdf", kind: "pdf" }
    });
    expect(resultado.success).toBe(true);
  });

  it("sigue rechazando esquemas que no son ninguno de los previstos", () => {
    const resultado = boardElementSchema.safeParse({
      ...base, type: "file",
      data: { url: "javascript:alert(1)", name: "x.pdf", mimeType: "application/pdf", kind: "pdf" }
    });
    expect(resultado.success).toBe(false);
  });
});

describe("tarjetas-lanzador hacia dominios no listados", () => {
  it("una tarjeta puede apuntar al Nextcloud del centro", () => {
    const resultado = boardElementSchema.safeParse({
      ...base, type: "iframe",
      data: { url: "https://nube.micentro.es/s/ab12cd34", title: "Ficha", mode: "launcher" }
    });
    expect(resultado.success).toBe(true);
  });

  it("pero EMPOTRAR ese mismo dominio sigue prohibido", () => {
    const resultado = boardElementSchema.safeParse({
      ...base, type: "iframe",
      data: { url: "https://nube.micentro.es/s/ab12cd34", title: "Ficha", mode: "embed" }
    });
    expect(resultado.success).toBe(false);
  });

  it("una tarjeta tampoco vale sin https", () => {
    const resultado = boardElementSchema.safeParse({
      ...base, type: "iframe",
      data: { url: "http://nube.micentro.es/s/ab12cd34", title: "Ficha", mode: "launcher" }
    });
    expect(resultado.success).toBe(false);
  });

  it("publicar un tablero acepta la tarjeta y rechaza el marco", () => {
    const tarjeta = { ...base, type: "iframe", data: { url: "https://nube.micentro.es/s/ab", title: "F", mode: "launcher" } };
    const marco = { ...base, type: "iframe", data: { url: "https://sitio-cualquiera.example/x", title: "F", mode: "embed" } };
    expect(() => assertBoardEmbedsAllowed(tableroCon(tarjeta))).not.toThrow();
    expect(() => assertBoardEmbedsAllowed(tableroCon(marco))).toThrow();
  });
});

describe("conectores con extremos libres", () => {
  it("por defecto son la flecha horizontal de siempre", () => {
    const resultado = boardElementSchema.parse({
      ...base, type: "connector",
      data: { label: "", color: "#1a5fa8", strokeWidth: 4, style: "straight", arrowStart: false, arrowEnd: true }
    });
    expect(resultado.type).toBe("connector");
    if (resultado.type !== "connector") return;
    expect(resultado.data.desde).toEqual({ x: 0, y: 0.5 });
    expect(resultado.data.hasta).toEqual({ x: 1, y: 0.5 });
  });
});
