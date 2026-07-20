export type Point = { x: number; y: number };
export type RotationAnchor = { x: number; y: number; rotation: number };

export function measureAngleFromVector(width: number, height: number) {
  const raw = Math.atan2(-height, width) * 180 / Math.PI;
  const normalized = (raw + 360) % 360;
  const reflex = normalized > 180;
  const angle = Math.round(reflex ? 360 - normalized : normalized);

  return {
    angle: Math.max(0, Math.min(180, angle)),
    rotation: reflex ? -angle : 0
  };
}

export function toLocalPoint(point: Point, anchor: RotationAnchor): Point {
  const angle = -(anchor.rotation || 0) * Math.PI / 180;
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;

  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle)
  };
}

export function clampSides(sides: number, min = 3, max = 24) {
  return Math.max(min, Math.min(max, Math.round(sides)));
}

/**
 * Vértices de un polígono regular de `sides` lados proyectado sobre una elipse
 * (radios rx, ry). Devuelve un array plano [x0,y0,x1,y1,…] para Konva.Line.
 * rotationDeg gira el polígono (por defecto un vértice arriba, a las 12).
 */
export function ellipsePolygonPoints(
  cx: number, cy: number, rx: number, ry: number, sides: number, rotationDeg = -90
): number[] {
  const n = clampSides(sides);
  const rot = rotationDeg * Math.PI / 180;
  const points: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = rot + (i * 2 * Math.PI) / n;
    points.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return points;
}

/**
 * Deriva el vector (w, h) de un ángulo a partir de los grados deseados,
 * manteniendo la longitud del rayo. El primer rayo del ángulo es horizontal;
 * este vector define el segundo rayo. Inverso de measureAngleFromVector.
 */
export function angleVectorFromDegrees(degrees: number, rayLength: number): { w: number; h: number } {
  const clamped = Math.max(0, Math.min(180, Math.round(degrees)));
  const rad = clamped * Math.PI / 180;
  return { w: rayLength * Math.cos(rad), h: -rayLength * Math.sin(rad) };
}
