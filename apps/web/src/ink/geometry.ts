import type { BoardInkObject } from "@edumind-board/shared";
import type { InkTool } from "../lib/store";
import { measureAngleFromVector, toLocalPoint, type Point, type RotationAnchor } from "../lib/geometry";

export const HIT_SPAN = 40000;
export const HIT_ORIGIN = -20000;
export const MIN_DRAG = 8;

export type StrokeObject = Extract<BoardInkObject, { kind: "stroke" }>;
export type ShapeObject = {
  kind: Exclude<InkTool, "select" | "pen" | "eraser">;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  width: number;
  sides?: number;
  showMeasurements?: boolean;
  anchorElementId?: string;
};
export type InkObject = BoardInkObject;
export type InkAnchor = RotationAnchor & { id: string };
export type InkBounds = { x: number; y: number; width: number; height: number };
const SNAP_DISTANCE = 8;
const SNAP_GRID = 10;

export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeNearPoint(stroke: StrokeObject, point: Point, radius: number) {
  for (let i = 0; i < stroke.points.length - 3; i += 2) {
    if (distanceToSegment(point.x, point.y, stroke.points[i], stroke.points[i + 1], stroke.points[i + 2], stroke.points[i + 3]) <= radius) {
      return true;
    }
  }
  return false;
}

export function shapeNearPoint(shape: ShapeObject, point: Point, radius: number) {
  const minX = Math.min(shape.x, shape.x + shape.w) - radius;
  const maxX = Math.max(shape.x, shape.x + shape.w) + radius;
  const minY = Math.min(shape.y, shape.y + shape.h) - radius;
  const maxY = Math.max(shape.y, shape.y + shape.h) + radius;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

export function normalizedRect(shape: ShapeObject) {
  return {
    x: Math.min(shape.x, shape.x + shape.w),
    y: Math.min(shape.y, shape.y + shape.h),
    width: Math.abs(shape.w),
    height: Math.abs(shape.h)
  };
}

export function isInkShape(item: BoardInkObject): item is ShapeObject {
  return item.kind !== "stroke";
}

export function inkObjectBounds(item: BoardInkObject): InkBounds {
  if (item.kind !== "stroke") {
    return normalizedRect(item as ShapeObject);
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < item.points.length - 1; index += 2) {
    xs.push(item.points[index]);
    ys.push(item.points[index + 1]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

export function moveInkObject(item: BoardInkObject, dx: number, dy: number): BoardInkObject {
  if (item.kind === "stroke") {
    return {
      ...item,
      points: item.points.map((value, index) => value + (index % 2 === 0 ? dx : dy))
    };
  }
  return {
    ...item,
    x: item.x + dx,
    y: item.y + dy
  };
}

export function resizeInkShape(item: ShapeObject, nextWidth: number, nextHeight: number): ShapeObject {
  const rect = normalizedRect(item);
  return {
    ...item,
    x: rect.x,
    y: rect.y,
    w: Math.max(MIN_DRAG, nextWidth),
    h: Math.max(MIN_DRAG, nextHeight)
  };
}

function nearestSnapDelta(value: number, targets: number[]) {
  let best = 0;
  let bestDistance = SNAP_DISTANCE + 1;
  for (const target of targets) {
    const delta = target - value;
    const distance = Math.abs(delta);
    if (distance < bestDistance) {
      best = delta;
      bestDistance = distance;
    }
  }
  return bestDistance <= SNAP_DISTANCE ? best : 0;
}

export function snapMovedInkObject(item: BoardInkObject, index: number, objects: BoardInkObject[], dx: number, dy: number) {
  const moved = moveInkObject(item, dx, dy);
  const bounds = inkObjectBounds(moved);
  const otherBounds = objects
    .filter((_, itemIndex) => itemIndex !== index)
    .map(inkObjectBounds);

  const xTargets = otherBounds.flatMap((rect) => [rect.x, rect.x + rect.width / 2, rect.x + rect.width]);
  const yTargets = otherBounds.flatMap((rect) => [rect.y, rect.y + rect.height / 2, rect.y + rect.height]);
  const xValues = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
  const yValues = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];

  const alignDx = xValues.map((value) => nearestSnapDelta(value, xTargets)).find((delta) => delta !== 0) ?? 0;
  const alignDy = yValues.map((value) => nearestSnapDelta(value, yTargets)).find((delta) => delta !== 0) ?? 0;
  const gridDx = Math.abs(alignDx) > 0 ? 0 : Math.round(bounds.x / SNAP_GRID) * SNAP_GRID - bounds.x;
  const gridDy = Math.abs(alignDy) > 0 ? 0 : Math.round(bounds.y / SNAP_GRID) * SNAP_GRID - bounds.y;

  return moveInkObject(moved, alignDx + gridDx, alignDy + gridDy);
}

export function snapSize(value: number) {
  return Math.max(MIN_DRAG, Math.round(value / SNAP_GRID) * SNAP_GRID);
}

export function boundedShape(start: Point, end: Point, tool: ShapeObject["kind"], color: string, width: number, sides = 5): ShapeObject {
  let w = end.x - start.x;
  let h = end.y - start.y;
  if (Math.abs(w) < MIN_DRAG && Math.abs(h) < MIN_DRAG) {
    const defaults: Partial<Record<ShapeObject["kind"], Point>> = {
      baseUnit: { x: 32, y: 32 },
      baseRod: { x: 180, y: 34 },
      baseFlat: { x: 150, y: 150 },
      cube: { x: 140, y: 120 },
      pyramid: { x: 140, y: 120 },
      triangularPrism: { x: 160, y: 115 },
      cylinder: { x: 130, y: 145 },
      cone: { x: 130, y: 145 },
      sphere: { x: 130, y: 130 },
      hexagon: { x: 120, y: 100 },
      polygon: { x: 130, y: 130 },
      angle: { x: 150, y: -90 },
      angleMeasure: { x: 150, y: -90 }
    };
    const fallback = defaults[tool] ?? { x: 140, y: 90 };
    w = fallback.x;
    h = fallback.y;
  }
  // Formas parametrizadas por número de lados: polígono regular y poliedros
  // generativos (pirámide y prisma de base n-gonal).
  const usesSides = tool === "polygon" || tool === "pyramid" || tool === "triangularPrism";
  return {
    kind: tool,
    x: start.x,
    y: start.y,
    w,
    h,
    color,
    width,
    ...(usesSides ? { sides, showMeasurements: tool === "polygon" } : {})
  };
}

export function polygonMeasurements(sides: number, radius: number) {
  const side = 2 * radius * Math.sin(Math.PI / sides);
  const apothem = radius * Math.cos(Math.PI / sides);
  return {
    side,
    radius,
    apothem,
    perimeter: side * sides,
    interiorAngle: ((sides - 2) * 180) / sides
  };
}

export function angleMeasure(shape: ShapeObject) {
  return measureAngleFromVector(shape.w, shape.h);
}

export function inkHitPoint(point: Point, item: BoardInkObject, anchor: InkAnchor | null | undefined) {
  return item.anchorElementId && anchor ? toLocalPoint(point, anchor) : point;
}

export function anchorStroke(points: number[], anchor: InkAnchor) {
  const next: number[] = [];
  for (let i = 0; i < points.length - 1; i += 2) {
    const local = toLocalPoint({ x: points[i], y: points[i + 1] }, anchor);
    next.push(local.x, local.y);
  }
  return next;
}

export function anchorShape(shape: ShapeObject, anchor: InkAnchor): ShapeObject {
  const start = toLocalPoint({ x: shape.x, y: shape.y }, anchor);
  const end = toLocalPoint({ x: shape.x + shape.w, y: shape.y + shape.h }, anchor);
  return {
    ...shape,
    x: start.x,
    y: start.y,
    w: end.x - start.x,
    h: end.y - start.y,
    anchorElementId: anchor.id
  };
}
