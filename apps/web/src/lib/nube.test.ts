import { describe, expect, it } from "vitest";
import { detectarProveedor, resolverEnlaceNube } from "./nube";

describe("detectarProveedor", () => {
  it("reconoce los cuatro proveedores previstos", () => {
    expect(detectarProveedor("https://drive.google.com/file/d/ABC/view")).toBe("drive");
    expect(detectarProveedor("https://docs.google.com/document/d/ABC/edit")).toBe("drive");
    expect(detectarProveedor("https://1drv.ms/b/s!ABC")).toBe("onedrive");
    expect(detectarProveedor("https://micentro.sharepoint.com/x")).toBe("onedrive");
    expect(detectarProveedor("https://www.dropbox.com/s/abc/f.pdf?dl=0")).toBe("dropbox");
    // Nextcloud se reconoce por la forma del enlace: el dominio lo pone el centro.
    expect(detectarProveedor("https://nube.micentro.es/s/ab12cd34ef56")).toBe("nextcloud");
  });

  it("no confunde una web cualquiera con una nube", () => {
    expect(detectarProveedor("https://edumind.es/recursos")).toBe("desconocido");
  });
});

describe("resolverEnlaceNube", () => {
  it("convierte un enlace de Drive en su vista previa embebible", () => {
    const nube = resolverEnlaceNube("https://drive.google.com/file/d/ABC123/view?usp=sharing");
    expect(nube?.url).toBe("https://drive.google.com/file/d/ABC123/preview");
    expect(nube?.modo).toBe("embed");
  });

  it("convierte un documento de Google en /preview", () => {
    const nube = resolverEnlaceNube("https://docs.google.com/document/d/XYZ/edit?tab=t.0");
    expect(nube?.url).toBe("https://docs.google.com/document/d/XYZ/preview");
  });

  it("pide el archivo crudo a Dropbox en vez del visor con dl=0", () => {
    const nube = resolverEnlaceNube("https://www.dropbox.com/s/abc/ficha.pdf?dl=0");
    expect(nube?.url).toContain("raw=1");
    expect(nube?.url).not.toContain("dl=0");
  });

  it("un Nextcloud autoalojado se añade como tarjeta, no como marco", () => {
    // Su dominio no se puede conocer de antemano, así que no está en la lista
    // de dominios embebibles: mejor abrirlo fuera que un marco en blanco.
    const nube = resolverEnlaceNube("https://nube.micentro.es/s/ab12cd34ef56");
    expect(nube?.modo).toBe("launcher");
    expect(nube?.url).toBe("https://nube.micentro.es/s/ab12cd34ef56");
  });

  it("rechaza lo que no es una URL https", () => {
    expect(resolverEnlaceNube("no soy una url")).toBeNull();
    expect(resolverEnlaceNube("http://drive.google.com/file/d/A/view")).toBeNull();
  });

  it("respeta el título que ponga el docente", () => {
    const nube = resolverEnlaceNube("https://drive.google.com/file/d/A/view", "  Ficha unidad 3 ");
    expect(nube?.titulo).toBe("Ficha unidad 3");
  });
});
