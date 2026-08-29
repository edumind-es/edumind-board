import { describe, expect, it } from "vitest";
import { isAllowedEmbedUrl } from "@edumind-board/shared";
import { ESTRATEGIAS_BREATH, esIframeBreath, esPatron, tituloBreath, urlBreath } from "./breath";

const cuadrada = ESTRATEGIAS_BREATH.find((e) => e.id === "caja")!;

describe("urlBreath", () => {
  it("el modo guiado va empotrado y sin controles", () => {
    const url = new URL(urlBreath(cuadrada, "guiada"));
    expect(url.searchParams.get("embed")).toBe("1");
    expect(url.searchParams.get("panel")).toBeNull();
  });

  it("el modo ajustable pide los controles aun empotrado", () => {
    const url = new URL(urlBreath(cuadrada, "ajustable"));
    expect(url.searchParams.get("embed")).toBe("1");
    expect(url.searchParams.get("panel")).toBe("1");
  });

  it("la app completa no lleva embed: es Breath entero", () => {
    const url = new URL(urlBreath(null, "completa"));
    expect(url.searchParams.get("embed")).toBeNull();
    expect(url.searchParams.get("lados")).toBeNull();
  });

  it("lleva la estrategia elegida, no siempre la cuadrada", () => {
    // El fallo que motivó todo esto: daba igual qué se quisiera, salía 4×4.
    const triangular = ESTRATEGIAS_BREATH.find((e) => e.id === "triangular")!;
    const url = new URL(urlBreath(triangular, "guiada"));
    expect(url.searchParams.get("lados")).toBe("3");
    expect(url.searchParams.get("segundos")).toBe("3.5");
    expect(url.searchParams.get("preset")).toBe("calm");
  });

  it("un patrón asimétrico se pide por id, no por lados y segundos", () => {
    // 4-7-8 y el suspiro no caben en un polígono de fases iguales: si se
    // tradujeran a lados/segundos sonaría otra cosa con el mismo nombre.
    const url = new URL(urlBreath(ESTRATEGIAS_BREATH.find((e) => e.id === "cuatro-siete-ocho")!, "guiada"));
    expect(url.searchParams.get("patron")).toBe("cuatro-siete-ocho");
    expect(url.searchParams.get("lados")).toBeNull();
    expect(url.searchParams.get("segundos")).toBeNull();
  });

  it("las rondas solo se piden cuando se indican", () => {
    expect(urlBreath(cuadrada, "guiada")).not.toContain("rondas");
    expect(urlBreath(cuadrada, "guiada", false, 5)).toContain("rondas=5");
  });

  it("todas las estrategias generan una URL embebible por el tablero", () => {
    for (const estrategia of ESTRATEGIAS_BREATH) {
      expect(isAllowedEmbedUrl(urlBreath(estrategia, "guiada"))).toBe(true);
    }
  });

  it("las figuras están dentro de lo que acepta la app", () => {
    for (const estrategia of ESTRATEGIAS_BREATH) {
      if (esPatron(estrategia)) continue;
      expect(estrategia.lados).toBeGreaterThanOrEqual(3);
      expect(estrategia.lados).toBeLessThanOrEqual(8);
      expect(estrategia.segundos).toBeGreaterThanOrEqual(1);
      expect(estrategia.segundos).toBeLessThanOrEqual(10);
    }
  });

  it("los patrones que se piden existen en Breath", () => {
    // Si alguien renombra un patrón en geobreath_react, Breath lo ignoraría en
    // silencio y sonaría el ciclo por defecto con el nombre equivocado.
    const conocidos = ["resonancia", "caja", "cuatro-siete-ocho", "suspiro"];
    for (const estrategia of ESTRATEGIAS_BREATH) {
      if (esPatron(estrategia)) expect(conocidos).toContain(estrategia.patron);
    }
  });

  it("autoplay solo cuando se pide", () => {
    expect(urlBreath(cuadrada, "guiada")).not.toContain("auto=1");
    expect(urlBreath(cuadrada, "guiada", true)).toContain("auto=1");
  });
});

describe("esIframeBreath", () => {
  it("distingue Breath de otros embebidos", () => {
    expect(esIframeBreath("https://breath.edumind.es/?embed=1")).toBe(true);
    expect(esIframeBreath("https://motion.edumind.es/")).toBe(false);
    expect(esIframeBreath("cualquier cosa")).toBe(false);
  });
});

describe("tituloBreath", () => {
  it("nombra la estrategia salvo en la app completa", () => {
    expect(tituloBreath(cuadrada, "guiada")).toContain(cuadrada.nombre);
    expect(tituloBreath(null, "completa")).toBe("Breath EDUmind");
  });
});
