import type { BoardElement } from "@edumind-board/shared";

export type BaseTenData = Extract<BoardElement, { type: "base10" }>["data"];
export type BaseTenPiece = BaseTenData["pieces"][number];
export type BaseTenPieceKind = BaseTenPiece["kind"];

export const BASE10_FREE_UNIT = 14;
export const BASE10_GAP_UNIT = 6;

export function baseTenKindValue(kind: BaseTenPieceKind) {
  if (kind === "cube") return 1000;
  if (kind === "flat") return 100;
  if (kind === "rod") return 10;
  return 1;
}

export function baseTenPiecesValue(pieces: BaseTenPiece[]) {
  return pieces.reduce((sum, piece) => sum + baseTenKindValue(piece.kind), 0);
}

export function nextBaseTenKind(kind: "unit" | "rod" | "flat"): BaseTenPieceKind {
  if (kind === "unit") return "rod";
  if (kind === "rod") return "flat";
  return "cube";
}

export function previousBaseTenKind(kind: "rod" | "flat" | "cube"): BaseTenPieceKind {
  if (kind === "rod") return "unit";
  if (kind === "flat") return "rod";
  return "flat";
}

export function baseTenPieceMetrics(kind: BaseTenPieceKind, unit = BASE10_FREE_UNIT) {
  if (kind === "unit") return { width: unit, height: unit };
  if (kind === "rod") return { width: unit * 10, height: unit };
  return { width: unit * 10, height: unit * 10 };
}

export function baseTenPieceMetrics3D(kind: BaseTenPieceKind, unit = BASE10_FREE_UNIT) {
  const metrics = baseTenPieceMetrics(kind, unit);
  if (kind === "unit") return { width: metrics.width + unit * 0.34, height: metrics.height + unit * 0.28 };
  if (kind === "rod") return { width: metrics.width + unit * 0.95, height: metrics.height + unit * 0.7 };
  if (kind === "flat") return { width: metrics.width + metrics.width * 0.08, height: metrics.height + metrics.height * 0.06 };
  return { width: metrics.width, height: metrics.height };
}

export function clampBaseTenPiece(
  piece: BaseTenPiece,
  width: number,
  height: number,
  unit: number,
  pad: number,
  contentY: number,
  contentH: number
) {
  const metrics = baseTenPieceMetrics3D(piece.kind, unit);
  return {
    ...piece,
    x: Math.max(pad, Math.min(width - pad - metrics.width, piece.x)),
    y: Math.max(contentY + 8, Math.min(contentY + contentH - metrics.height - 8, piece.y))
  };
}

export function createBaseTenPieces(
  data: BaseTenData,
  width: number,
  unit = BASE10_FREE_UNIT,
  startY = 88,
  createId: () => string = () => crypto.randomUUID()
): BaseTenPiece[] {
  const kinds: Array<{ kind: BaseTenPieceKind; count: number }> = [
    { kind: "cube", count: data.cubeCount },
    { kind: "flat", count: data.flatCount },
    { kind: "rod", count: data.rodCount },
    { kind: "unit", count: data.unitCount }
  ];
  const pieces: BaseTenPiece[] = [];
  let cursorX = 24;
  let cursorY = startY;

  for (const group of kinds) {
    const metrics = baseTenPieceMetrics3D(group.kind, unit);
    for (let index = 0; index < group.count; index += 1) {
      pieces.push({
        id: createId(),
        kind: group.kind,
        x: cursorX,
        y: cursorY
      });
      cursorX += metrics.width + BASE10_GAP_UNIT * 2;
      if (cursorX > width - Math.max(120, metrics.width + 28)) {
        cursorX = 24;
        cursorY += metrics.height + BASE10_GAP_UNIT * 3;
      }
    }
    cursorX = 24;
    cursorY += metrics.height + BASE10_GAP_UNIT * 4;
  }

  return pieces.slice(0, 300);
}

export function countBaseTenPieces(pieces: BaseTenPiece[]) {
  const next = { unitCount: 0, rodCount: 0, flatCount: 0, cubeCount: 0 };
  for (const piece of pieces) {
    if (piece.kind === "unit") next.unitCount += 1;
    if (piece.kind === "rod") next.rodCount += 1;
    if (piece.kind === "flat") next.flatCount += 1;
    if (piece.kind === "cube") next.cubeCount += 1;
  }
  return next;
}

export function normalizeBaseTenCounts(pieces: BaseTenPiece[]) {
  const next = countBaseTenPieces(pieces);
  next.rodCount += Math.floor(next.unitCount / 10);
  next.unitCount %= 10;
  next.flatCount += Math.floor(next.rodCount / 10);
  next.rodCount %= 10;
  next.cubeCount += Math.floor(next.flatCount / 10);
  next.flatCount %= 10;
  return next;
}

export function orderBaseTenPieces(
  pieces: BaseTenPiece[],
  width: number,
  unit: number,
  startY: number,
  createId: () => string = () => crypto.randomUUID()
) {
  const data = countBaseTenPieces(pieces) as BaseTenData;
  return createBaseTenPieces(data, width, unit, startY, createId);
}

export function exchangeTenNearbyPieces(
  pieces: BaseTenPiece[],
  kind: "unit" | "rod" | "flat",
  unit: number,
  createId: () => string = () => crypto.randomUUID()
) {
  const candidates = pieces
    .filter((piece) => piece.kind === kind)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (candidates.length < 10) return pieces;

  const metrics = baseTenPieceMetrics(kind, unit);
  const maxSpreadX = kind === "unit" ? metrics.width * 13 : metrics.width * 1.35;
  const maxSpreadY = kind === "unit" ? metrics.height * 3.6 : metrics.height * 16;
  let selected = candidates.slice(0, 10);

  for (const seed of candidates) {
    const cluster = candidates
      .map((piece) => ({
        piece,
        distance: Math.hypot(piece.x - seed.x, piece.y - seed.y)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)
      .map((item) => item.piece);
    const minX = Math.min(...cluster.map((piece) => piece.x));
    const maxX = Math.max(...cluster.map((piece) => piece.x));
    const minY = Math.min(...cluster.map((piece) => piece.y));
    const maxY = Math.max(...cluster.map((piece) => piece.y));
    if (maxX - minX <= maxSpreadX && maxY - minY <= maxSpreadY) {
      selected = cluster;
      break;
    }
  }

  const selectedIds = new Set(selected.map((piece) => piece.id));
  const minX = Math.min(...selected.map((piece) => piece.x));
  const minY = Math.min(...selected.map((piece) => piece.y));
  return [
    ...pieces.filter((piece) => !selectedIds.has(piece.id)),
    { id: createId(), kind: nextBaseTenKind(kind), x: minX, y: minY }
  ].sort((a, b) => baseTenKindValue(b.kind) - baseTenKindValue(a.kind) || a.y - b.y || a.x - b.x);
}

export function splitOneBaseTenPiece(
  pieces: BaseTenPiece[],
  kind: "rod" | "flat" | "cube",
  unit: number,
  createId: () => string = () => crypto.randomUUID()
) {
  const source = pieces
    .filter((piece) => piece.kind === kind)
    .sort((a, b) => a.y - b.y || a.x - b.x)[0];
  if (!source) return pieces;

  const childKind = previousBaseTenKind(kind);
  const childMetrics = baseTenPieceMetrics3D(childKind, unit);
  const stepX = childKind === "unit" ? unit + 2 : Math.min(childMetrics.width + BASE10_GAP_UNIT, unit * 10 + BASE10_GAP_UNIT);
  const stepY = childKind === "unit" ? unit + 2 : childMetrics.height + BASE10_GAP_UNIT;
  const children = Array.from({ length: 10 }, (_, index): BaseTenPiece => ({
    id: createId(),
    kind: childKind,
    x: source.x + (childKind === "unit" ? index * stepX : 0),
    y: source.y + (childKind === "unit" ? 0 : index * stepY)
  }));

  return [
    ...pieces.filter((piece) => piece.id !== source.id),
    ...children
  ].sort((a, b) => baseTenKindValue(b.kind) - baseTenKindValue(a.kind) || a.y - b.y || a.x - b.x);
}
