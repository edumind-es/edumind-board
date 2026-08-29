// Geometría pura de los conectores (flechas) del tablero.
//
// Por qué existe: unir dos cajas exigía añadir una flecha y colocarla a mano,
// lo que en una pizarra delante de la clase es inviable. Aquí vive el cálculo
// que permite arrastrar de una caja a otra y que la flecha quede puesta, y el
// que la recoloca sola cuando cualquiera de los dos extremos se mueve.
//
// Sin React ni Konva: solo números, para poder probarlo sin lienzo.
import type { BoardElement } from "@edumind-board/shared";

export type Punto = { x: number; y: number };
export type Caja = { x: number; y: number; width: number; height: number };

/** Marco de un conector: su recuadro más los extremos normalizados (0..1). */
export type MarcoConector = {
  x: number;
  y: number;
  width: number;
  height: number;
  desde: Punto;
  hasta: Punto;
};

/** Lado mínimo del recuadro de un conector: por debajo no se puede agarrar. */
const LADO_MINIMO = 24;

export function centro(caja: Caja): Punto {
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

/**
 * Punto del borde de la caja en el que la recta hacia `hacia` la abandona.
 *
 * Se resuelve por proporciones en vez de intersectando los cuatro lados: el
 * factor que primero saca al punto del rectángulo es el menor de los dos ejes.
 */
export function puntoEnBorde(caja: Caja, hacia: Punto, margen = 0): Punto {
  const c = centro(caja);
  const dx = hacia.x - c.x;
  const dy = hacia.y - c.y;
  if (dx === 0 && dy === 0) return c;

  const mediaAncho = caja.width / 2 + margen;
  const mediaAlto = caja.height / 2 + margen;
  const escalaX = dx === 0 ? Infinity : mediaAncho / Math.abs(dx);
  const escalaY = dy === 0 ? Infinity : mediaAlto / Math.abs(dy);
  const escala = Math.min(escalaX, escalaY);
  return { x: c.x + dx * escala, y: c.y + dy * escala };
}

/**
 * Marco de un conector que une dos puntos del tablero.
 *
 * El recuadro es la caja que los envuelve, con un mínimo para que siga siendo
 * seleccionable cuando la flecha es casi horizontal o casi vertical.
 */
export function marcoEntrePuntos(a: Punto, b: Punto): MarcoConector {
  const izquierda = Math.min(a.x, b.x);
  const arriba = Math.min(a.y, b.y);
  const ancho = Math.max(LADO_MINIMO, Math.abs(b.x - a.x));
  const alto = Math.max(LADO_MINIMO, Math.abs(b.y - a.y));

  // Cuando un eje se queda en el mínimo, el recuadro se centra sobre la línea
  // para que la flecha no salga pegada a un borde.
  const x = Math.abs(b.x - a.x) < LADO_MINIMO ? (a.x + b.x) / 2 - ancho / 2 : izquierda;
  const y = Math.abs(b.y - a.y) < LADO_MINIMO ? (a.y + b.y) / 2 - alto / 2 : arriba;

  const normalizar = (p: Punto): Punto => ({
    x: Math.min(1, Math.max(0, (p.x - x) / ancho)),
    y: Math.min(1, Math.max(0, (p.y - y) / alto))
  });

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(ancho),
    height: Math.round(alto),
    desde: normalizar(a),
    hasta: normalizar(b)
  };
}

/** Marco de un conector que une dos elementos, borde con borde. */
export function marcoEntreCajas(origen: Caja, destino: Caja, margen = 6): MarcoConector {
  const a = puntoEnBorde(origen, centro(destino), margen);
  const b = puntoEnBorde(destino, centro(origen), margen);
  return marcoEntrePuntos(a, b);
}

type Conector = Extract<BoardElement, { type: "connector" }>;

export function esConector(element: BoardElement): element is Conector {
  return element.type === "connector";
}

/** Elementos que un conector puede tomar como extremo (todos menos él mismo). */
export function esAnclable(element: BoardElement) {
  return element.type !== "connector";
}

/**
 * Recoloca los conectores anclados a alguno de los elementos indicados.
 *
 * Devuelve la misma lista si no hay nada que recolocar: el store la compara por
 * identidad para no marcar el tablero como sucio sin motivo.
 */
export function reanclarConectores(
  elements: BoardElement[],
  idsMovidos?: Iterable<string>
): BoardElement[] {
  const movidos = idsMovidos ? new Set(idsMovidos) : null;
  const porId = new Map(elements.map((element) => [element.id, element]));
  let cambio = false;

  const siguiente = elements.map((element) => {
    if (!esConector(element)) return element;
    const { anclaDesde, anclaHasta } = element.data;
    if (!anclaDesde || !anclaHasta) return element;
    // Si se ha movido el propio conector, manda lo que ha hecho el docente.
    if (movidos && movidos.has(element.id)) return element;
    if (movidos && !movidos.has(anclaDesde) && !movidos.has(anclaHasta)) return element;

    const origen = porId.get(anclaDesde);
    const destino = porId.get(anclaHasta);
    // Un extremo borrado deja la flecha suelta en vez de desaparecer: el
    // docente ve lo que ha pasado y decide.
    if (!origen || !destino) return element;

    const marco = marcoEntreCajas(origen, destino);
    if (
      element.x === marco.x && element.y === marco.y &&
      element.width === marco.width && element.height === marco.height &&
      element.data.desde.x === marco.desde.x && element.data.desde.y === marco.desde.y &&
      element.data.hasta.x === marco.hasta.x && element.data.hasta.y === marco.hasta.y
    ) {
      return element;
    }
    cambio = true;
    return {
      ...element,
      x: marco.x,
      y: marco.y,
      width: marco.width,
      height: marco.height,
      rotation: 0,
      data: { ...element.data, desde: marco.desde, hasta: marco.hasta }
    } satisfies Conector;
  });

  return cambio ? siguiente : elements;
}

/** Primer elemento anclable cuyo recuadro contiene el punto (el de encima). */
export function elementoEnPunto(elements: BoardElement[], punto: Punto, excluirId?: string) {
  return [...elements]
    .filter((element) => esAnclable(element) && element.id !== excluirId)
    .sort((a, b) => b.zIndex - a.zIndex)
    .find((element) =>
      punto.x >= element.x && punto.x <= element.x + element.width &&
      punto.y >= element.y && punto.y <= element.y + element.height
    );
}
