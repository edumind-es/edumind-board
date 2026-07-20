// Motor de reglas puras del manipulativo matemático 3D (widget mates3d).
// Sin dependencias de render: todo es geometría y aritmética verificable.
//
// Contrato didáctico (idéntico al de base10.ts, ahora con volumen real):
// - 10 unidades = 1 decena, 10 decenas = 1 centena, 10 centenas = 1 millar
// - todo canje conserva el valor total
// - las dimensiones 3D respetan las proporciones matemáticas reales:
//   unidad 1×1×1, decena 10×1×1, centena 10×1×10, millar 10×10×10

import type { Mates3dPiece, Solid3dKind } from "@edumind-board/shared";

export type PieceKind = Mates3dPiece["kind"];

export const PIECE_VALUES: Record<PieceKind, number> = {
  unit: 1,
  rod: 10,
  flat: 100,
  cube: 1000
};

/** Dimensiones en unidades de mundo [ancho X, alto Y, fondo Z]. */
export const PIECE_DIMENSIONS: Record<PieceKind, [number, number, number]> = {
  unit: [1, 1, 1],
  rod: [10, 1, 1],
  flat: [10, 1, 10],
  cube: [10, 10, 10]
};

export const PIECE_COLORS: Record<PieceKind, string> = {
  unit: "#f3c969",
  rod: "#22a06b",
  flat: "#38bdf8",
  cube: "#f28c7a"
};

export const KIND_ORDER: PieceKind[] = ["cube", "flat", "rod", "unit"];

const NEXT_KIND: Partial<Record<PieceKind, PieceKind>> = {
  unit: "rod",
  rod: "flat",
  flat: "cube"
};

const PREV_KIND: Partial<Record<PieceKind, PieceKind>> = {
  rod: "unit",
  flat: "rod",
  cube: "flat"
};

/** Semiplano del suelo donde pueden vivir las piezas. */
export const FLOOR_HALF_EXTENT = 30;

export function piecesValue(pieces: Array<Pick<Mates3dPiece, "kind">>) {
  return pieces.reduce((total, piece) => total + PIECE_VALUES[piece.kind], 0);
}

export function countByKind(pieces: Array<Pick<Mates3dPiece, "kind">>) {
  const counts: Record<PieceKind, number> = { unit: 0, rod: 0, flat: 0, cube: 0 };
  for (const piece of pieces) counts[piece.kind] += 1;
  return counts;
}

export function snapToGrid(value: number, step = 0.5) {
  return Math.round(value / step) * step;
}

export function clampToFloor(value: number, halfSize: number) {
  const limit = FLOOR_HALF_EXTENT - halfSize;
  return Math.max(-limit, Math.min(limit, value));
}

/** Posición libre aproximada para una pieza nueva, evitando apilar en el mismo punto. */
export function spawnPosition(pieces: Mates3dPiece[], kind: PieceKind): { x: number; z: number } {
  const [width, , depth] = PIECE_DIMENSIONS[kind];
  const index = pieces.filter((piece) => piece.kind === kind).length;
  const perRow = Math.max(1, Math.floor((FLOOR_HALF_EXTENT * 1.2) / (width + 1)));
  const col = index % perRow;
  const row = Math.floor(index / perRow);
  const baseX = -FLOOR_HALF_EXTENT * 0.55 + col * (width + 1.2) + width / 2;
  const baseZ = FLOOR_HALF_EXTENT * 0.45 + row * (depth + 1.2) - depth / 2 - kindRowOffset(kind);
  return {
    x: clampToFloor(snapToGrid(baseX), width / 2),
    z: clampToFloor(snapToGrid(baseZ), depth / 2)
  };
}

function kindRowOffset(kind: PieceKind) {
  // Cada familia aparece en una franja distinta del suelo
  if (kind === "unit") return 0;
  if (kind === "rod") return 5;
  if (kind === "flat") return 17;
  return 32;
}

export function addPiece(pieces: Mates3dPiece[], kind: PieceKind, makeId: () => string): Mates3dPiece[] {
  const { x, z } = spawnPosition(pieces, kind);
  return [...pieces, { id: makeId(), kind, x, z, rotY: 0 }].slice(-200);
}

/**
 * Canje ascendente: retira las 10 piezas de `kind` más próximas entre sí y
 * añade 1 pieza del orden superior en su centroide. Conserva el valor total.
 */
export function exchangeUp(pieces: Mates3dPiece[], kind: PieceKind, makeId: () => string): Mates3dPiece[] {
  const target = NEXT_KIND[kind];
  if (!target) return pieces;
  const candidates = pieces.filter((piece) => piece.kind === kind);
  if (candidates.length < 10) return pieces;

  // Grupo de 10 más compacto: ancla en cada candidato y toma sus 9 vecinos
  let best: Mates3dPiece[] | null = null;
  let bestSpread = Infinity;
  for (const anchor of candidates) {
    const group = [...candidates]
      .sort((a, b) => distanceSq(a, anchor) - distanceSq(b, anchor))
      .slice(0, 10);
    const spread = group.reduce((sum, piece) => sum + distanceSq(piece, anchor), 0);
    if (spread < bestSpread) {
      bestSpread = spread;
      best = group;
    }
  }
  if (!best) return pieces;

  const removedIds = new Set(best.map((piece) => piece.id));
  const centroidX = best.reduce((sum, piece) => sum + piece.x, 0) / 10;
  const centroidZ = best.reduce((sum, piece) => sum + piece.z, 0) / 10;
  const [width, , depth] = PIECE_DIMENSIONS[target];

  return [
    ...pieces.filter((piece) => !removedIds.has(piece.id)),
    {
      id: makeId(),
      kind: target,
      x: clampToFloor(snapToGrid(centroidX), width / 2),
      z: clampToFloor(snapToGrid(centroidZ), depth / 2),
      rotY: 0
    }
  ];
}

/**
 * Descomposición: retira 1 pieza de `kind` y coloca 10 del orden inferior
 * alineadas donde estaba. Conserva el valor total (reversible con exchangeUp).
 */
export function splitDown(pieces: Mates3dPiece[], kind: PieceKind, makeId: () => string): Mates3dPiece[] {
  const target = PREV_KIND[kind];
  if (!target) return pieces;
  const source = pieces.find((piece) => piece.kind === kind);
  if (!source) return pieces;

  const [width, , depth] = PIECE_DIMENSIONS[target];
  const children: Mates3dPiece[] = Array.from({ length: 10 }, (_, index) => {
    // Las 10 hijas se disponen en la dirección natural de la pieza madre:
    // unidades en línea (como una decena), decenas en fila (como una centena),
    // centenas apiladas en franja (como un millar desplegado en planta)
    const offset = index - 4.5;
    const x = target === "rod" ? source.x : source.x + offset * (width + 0.15) * (target === "unit" ? 1 : 0);
    const z = target === "unit"
      ? source.z
      : source.z + offset * (depth + 0.15) * 0.2;
    const lineX = target === "unit" ? source.x + offset * 1.06 : x;
    return {
      id: makeId(),
      kind: target,
      x: clampToFloor(snapToGrid(target === "unit" ? lineX : source.x + (index % 5 - 2) * (width * 0.22 + 0.4)), width / 2),
      z: clampToFloor(snapToGrid(target === "unit" ? source.z : source.z + Math.floor(index / 5) * (depth * 0.24 + 0.6) - depth * 0.12), depth / 2),
      rotY: 0
    };
  });

  return [...pieces.filter((piece) => piece.id !== source.id), ...children].slice(-200);
}

/** Ordena todas las piezas por familias en franjas paralelas. */
export function arrangePieces(pieces: Mates3dPiece[]): Mates3dPiece[] {
  const arranged: Mates3dPiece[] = [];
  for (const kind of KIND_ORDER) {
    const family = pieces.filter((piece) => piece.kind === kind);
    const [width, , depth] = PIECE_DIMENSIONS[kind];
    const perRow = Math.max(1, Math.floor((FLOOR_HALF_EXTENT * 1.7) / (width + 1)));
    family.forEach((piece, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      arranged.push({
        ...piece,
        x: clampToFloor(snapToGrid(-FLOOR_HALF_EXTENT * 0.8 + width / 2 + col * (width + 1)), width / 2),
        z: clampToFloor(snapToGrid(-FLOOR_HALF_EXTENT * 0.7 + kindRowOffset(kind) + row * (depth + 1)), depth / 2),
        rotY: 0
      });
    });
  }
  return arranged;
}

function distanceSq(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

// ── Sólidos geométricos ──────────────────────────────────────────────────────

export type SolidFacts = {
  label: string;
  faces: number;
  edges: number;
  vertices: number;
  /** Cuerpos redondos: caras curvas, Euler no aplica en su forma poliédrica */
  curved: boolean;
};

const POLYGON_NAMES: Record<number, string> = {
  3: "triangular", 4: "cuadrangular", 5: "pentagonal", 6: "hexagonal",
  7: "heptagonal", 8: "octogonal", 9: "eneagonal", 10: "decagonal",
  11: "endecagonal", 12: "dodecagonal"
};

function clampSolidSides(sides: number) {
  return Math.max(3, Math.min(12, Math.round(sides)));
}

/**
 * Caras, aristas y vértices de cada sólido. Prisma y pirámide se calculan a
 * partir del número de lados de la base (n):
 *  - pirámide: F = n+1, A = 2n, V = n+1
 *  - prisma:   F = n+2, A = 3n, V = 2n
 * Ambos cumplen Euler (F + V − A = 2) para cualquier n.
 */
export function solidFacts(kind: Solid3dKind, sides = 4): SolidFacts {
  const n = clampSolidSides(sides);
  const shape = POLYGON_NAMES[n] ?? `${n} lados`;
  switch (kind) {
    case "cube":
      return { label: "Cubo (hexaedro)", faces: 6, edges: 12, vertices: 8, curved: false };
    case "pyramid":
      return { label: `Pirámide ${shape}`, faces: n + 1, edges: 2 * n, vertices: n + 1, curved: false };
    case "prism":
      return { label: `Prisma ${shape}`, faces: n + 2, edges: 3 * n, vertices: 2 * n, curved: false };
    case "cylinder":
      return { label: "Cilindro", faces: 3, edges: 2, vertices: 0, curved: true };
    case "cone":
      return { label: "Cono", faces: 2, edges: 1, vertices: 1, curved: true };
    case "sphere":
      return { label: "Esfera", faces: 1, edges: 0, vertices: 0, curved: true };
  }
}

/** Comprobación de Euler (F + V − A = 2) para poliedros convexos. */
export function satisfiesEuler(facts: SolidFacts) {
  if (facts.curved) return true;
  return facts.faces + facts.vertices - facts.edges === 2;
}
