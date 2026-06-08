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
