import { useEffect, useRef, useState } from "react";
import { Arc, Circle, Group, Layer, Line, Rect, RegularPolygon, Text } from "react-konva";
import type Konva from "konva";
import type { BoardInkObject } from "@edumind-board/shared";
import { useBoardStore, type InkTool } from "../lib/store";
import { measureAngleFromVector, toLocalPoint, type Point, type RotationAnchor } from "../lib/geometry";

const HIT_SPAN = 40000;
const HIT_ORIGIN = -20000;
const MIN_DRAG = 8;

type StrokeObject = Extract<BoardInkObject, { kind: "stroke" }>;
type ShapeObject = {
  kind: Exclude<InkTool, "pen" | "eraser">;
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
type InkObject = BoardInkObject;
type InkAnchor = RotationAnchor & { id: string };

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function strokeNearPoint(stroke: StrokeObject, point: Point, radius: number) {
  for (let i = 0; i < stroke.points.length - 3; i += 2) {
    if (distanceToSegment(point.x, point.y, stroke.points[i], stroke.points[i + 1], stroke.points[i + 2], stroke.points[i + 3]) <= radius) {
      return true;
    }
  }
  return false;
}

function shapeNearPoint(shape: ShapeObject, point: Point, radius: number) {
  const minX = Math.min(shape.x, shape.x + shape.w) - radius;
  const maxX = Math.max(shape.x, shape.x + shape.w) + radius;
  const minY = Math.min(shape.y, shape.y + shape.h) - radius;
  const maxY = Math.max(shape.y, shape.y + shape.h) + radius;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function normalizedRect(shape: ShapeObject) {
  return {
    x: Math.min(shape.x, shape.x + shape.w),
    y: Math.min(shape.y, shape.y + shape.h),
    width: Math.abs(shape.w),
    height: Math.abs(shape.h)
  };
}

function boundedShape(start: Point, end: Point, tool: ShapeObject["kind"], color: string, width: number, sides = 5): ShapeObject {
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
  return {
    kind: tool,
    x: start.x,
    y: start.y,
    w,
    h,
    color,
    width,
    ...(tool === "polygon" ? { sides, showMeasurements: true } : {})
  };
}

function polygonMeasurements(sides: number, radius: number) {
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

function BaseTenGrid({ shape, rows, cols }: { shape: ShapeObject; rows: number; cols: number }) {
  const rect = normalizedRect(shape);
  const lines = [];
  for (let c = 1; c < cols; c += 1) {
    const x = rect.x + rect.width * c / cols;
    lines.push(<Line key={`c-${c}`} points={[x, rect.y, x, rect.y + rect.height]} stroke={shape.color} strokeWidth={1} listening={false} />);
  }
  for (let r = 1; r < rows; r += 1) {
    const y = rect.y + rect.height * r / rows;
    lines.push(<Line key={`r-${r}`} points={[rect.x, y, rect.x + rect.width, y]} stroke={shape.color} strokeWidth={1} listening={false} />);
  }
  return (
    <>
      <Rect {...rect} fill="rgba(255, 214, 102, 0.22)" stroke={shape.color} strokeWidth={shape.width} cornerRadius={3} listening={false} />
      {lines}
    </>
  );
}

function ProtractorTicks({ shape, radius, angle, rotation }: { shape: ShapeObject; radius: number; angle: number; rotation: number }) {
  return (
    <>
      {Array.from({ length: Math.floor(angle / 10) + 1 }, (_, i) => {
        const deg = rotation + i * 10;
        const rad = deg * Math.PI / 180;
        const major = i % 3 === 0;
        const inner = radius - (major ? 12 : 7);
        return (
          <Line key={i}
            points={[
              shape.x + inner * Math.cos(rad),
              shape.y + inner * Math.sin(rad),
              shape.x + radius * Math.cos(rad),
              shape.y + radius * Math.sin(rad)
            ]}
            stroke={shape.color} strokeWidth={major ? 1.2 : 0.7} opacity={0.75} listening={false} />
        );
      })}
    </>
  );
}

export function renderInkObject(item: BoardInkObject, key?: string | number) {
  if (item.kind === "stroke") {
    return (
      <Line key={key} points={item.points} stroke={item.color} strokeWidth={item.width}
        lineCap="round" lineJoin="round" tension={0.4} listening={false} />
    );
  }

  const shape = item as ShapeObject;
  const rect = normalizedRect(shape);
  const common = { stroke: shape.color, strokeWidth: shape.width, listening: false };
  const endX = shape.x + shape.w;
  const endY = shape.y + shape.h;
  const rayLen = Math.max(48, Math.hypot(shape.w, shape.h));

  switch (shape.kind) {
    case "line":
      return <Line key={key} points={[shape.x, shape.y, endX, endY]} {...common} lineCap="round" />;
    case "rect":
      return <Rect key={key} {...rect} {...common} cornerRadius={4} />;
    case "ellipse":
      return <Circle key={key} x={rect.x + rect.width / 2} y={rect.y + rect.height / 2}
        radiusX={rect.width / 2} radiusY={rect.height / 2} {...common} />;
    case "triangle":
      return <Line key={key} points={[rect.x + rect.width / 2, rect.y, rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height]}
        {...common} closed lineJoin="round" />;
    case "polygon": {
      const sides = Math.max(3, Math.min(24, shape.sides ?? 5));
      const radius = Math.min(rect.width, rect.height) / 2;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const measurements = polygonMeasurements(sides, radius);
      return (
        <Group key={key} listening={false}>
          <RegularPolygon x={cx} y={cy} sides={sides} radius={radius} rotation={-90}
            {...common} fill="rgba(94, 143, 163, 0.08)" />
          {shape.showMeasurements !== false && (
            <>
              <Line points={[cx, cy, cx + radius, cy]} stroke={shape.color} strokeWidth={1} dash={[4, 4]} listening={false} />
              <Text text={`${sides} lados · l ${Math.round(measurements.side)} · R ${Math.round(measurements.radius)} · a ${Math.round(measurements.apothem)} · P ${Math.round(measurements.perimeter)} · α ${Math.round(measurements.interiorAngle)}°`}
                x={rect.x} y={rect.y + rect.height + 8} width={Math.max(300, rect.width)}
                fill={shape.color} fontSize={13} fontStyle="bold" listening={false} />
            </>
          )}
        </Group>
      );
    }
    case "hexagon":
      return <RegularPolygon key={key} x={rect.x + rect.width / 2} y={rect.y + rect.height / 2}
        sides={6} radius={Math.min(rect.width, rect.height) / 2} {...common} />;
    case "angle":
    case "angleMeasure": {
      const radius = Math.min(88, Math.max(30, rayLen * 0.34));
      const { angle, rotation } = measureAngleFromVector(shape.w, shape.h);
      return (
        <Group key={key} listening={false}>
          <Line points={[shape.x, shape.y, shape.x + rayLen, shape.y]} {...common} lineCap="round" />
          <Line points={[shape.x, shape.y, endX, endY]} {...common} lineCap="round" />
          <Arc x={shape.x} y={shape.y} innerRadius={radius - 4} outerRadius={radius}
            angle={angle} rotation={rotation} fill={shape.color} opacity={0.24} listening={false} />
          {shape.kind === "angleMeasure" && (
            <>
              <ProtractorTicks shape={shape} radius={radius + 10} angle={angle} rotation={rotation} />
              <Text text={`${angle}°`} x={shape.x + radius + 12} y={shape.y - 26} fill={shape.color}
                fontSize={18} fontStyle="bold" listening={false} />
            </>
          )}
        </Group>
      );
    }
    case "baseUnit":
      return <BaseTenGrid key={key} shape={shape} rows={1} cols={1} />;
    case "baseRod":
      return <BaseTenGrid key={key} shape={shape} rows={1} cols={10} />;
    case "baseFlat":
      return <BaseTenGrid key={key} shape={shape} rows={10} cols={10} />;
    case "cube": {
      const dx = Math.min(34, rect.width * 0.22);
      const dy = Math.min(28, rect.height * 0.22);
      return (
        <Group key={key} listening={false}>
          <Rect x={rect.x} y={rect.y + dy} width={rect.width - dx} height={rect.height - dy} {...common} fill="rgba(60, 125, 255, 0.08)" />
          <Line points={[rect.x + dx, rect.y, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height - dy, rect.x + rect.width - dx, rect.y + rect.height, rect.x + rect.width - dx, rect.y + dy, rect.x + dx, rect.y, rect.x, rect.y + dy]} {...common} />
          <Line points={[rect.x + rect.width, rect.y, rect.x + rect.width - dx, rect.y + dy]} {...common} />
        </Group>
      );
    }
    case "pyramid":
      return (
        <Group key={key} listening={false}>
          <Line points={[rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height, rect.x + rect.width * 0.62, rect.y + rect.height * 0.72, rect.x + rect.width * 0.18, rect.y + rect.height * 0.72, rect.x, rect.y + rect.height]} {...common} />
          <Line points={[rect.x + rect.width * 0.5, rect.y, rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height, rect.x + rect.width * 0.5, rect.y, rect.x + rect.width * 0.18, rect.y + rect.height * 0.72]} {...common} />
          <Line points={[rect.x + rect.width * 0.5, rect.y, rect.x + rect.width * 0.62, rect.y + rect.height * 0.72]} {...common} dash={[5, 5]} />
        </Group>
      );
    case "triangularPrism": {
      const dx = Math.min(42, rect.width * 0.24);
      const dy = Math.min(34, rect.height * 0.22);
      const front = [
        rect.x, rect.y + rect.height,
        rect.x + rect.width * 0.38, rect.y + rect.height * 0.18,
        rect.x + rect.width * 0.76, rect.y + rect.height
      ];
      const back = front.map((value, index) => value + (index % 2 === 0 ? dx : -dy));
      return (
        <Group key={key} listening={false}>
          <Line points={back} {...common} closed fill="rgba(156, 203, 123, 0.12)" />
          <Line points={front} {...common} closed fill="rgba(94, 143, 163, 0.1)" />
          <Line points={[front[0], front[1], back[0], back[1], front[2], front[3], back[2], back[3], front[4], front[5], back[4], back[5]]} {...common} />
        </Group>
      );
    }
    case "cylinder": {
      const ellipseH = Math.max(16, rect.height * 0.18);
      return (
        <Group key={key} listening={false}>
          <Rect x={rect.x} y={rect.y + ellipseH / 2} width={rect.width} height={rect.height - ellipseH}
            stroke={shape.color} strokeWidth={shape.width} fill="rgba(94, 143, 163, 0.1)" />
          <Circle x={rect.x + rect.width / 2} y={rect.y + ellipseH / 2}
            radiusX={rect.width / 2} radiusY={ellipseH / 2} {...common} fill="rgba(156, 203, 123, 0.12)" />
          <Circle x={rect.x + rect.width / 2} y={rect.y + rect.height - ellipseH / 2}
            radiusX={rect.width / 2} radiusY={ellipseH / 2} {...common} fill="rgba(94, 143, 163, 0.08)" />
        </Group>
      );
    }
    case "cone": {
      const ellipseH = Math.max(16, rect.height * 0.18);
      return (
        <Group key={key} listening={false}>
          <Line points={[rect.x + rect.width / 2, rect.y, rect.x, rect.y + rect.height - ellipseH / 2, rect.x + rect.width, rect.y + rect.height - ellipseH / 2, rect.x + rect.width / 2, rect.y]}
            {...common} fill="rgba(242, 140, 122, 0.1)" closed />
          <Circle x={rect.x + rect.width / 2} y={rect.y + rect.height - ellipseH / 2}
            radiusX={rect.width / 2} radiusY={ellipseH / 2} {...common} fill="rgba(243, 201, 105, 0.12)" />
        </Group>
      );
    }
    case "sphere": {
      const radius = Math.min(rect.width, rect.height) / 2;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      return (
        <Group key={key} listening={false}>
          <Circle x={cx} y={cy} radius={radius} {...common} fill="rgba(94, 143, 163, 0.1)" />
          <Circle x={cx} y={cy} radiusX={radius * 0.94} radiusY={radius * 0.28} {...common} dash={[5, 5]} />
          <Circle x={cx} y={cy} radiusX={radius * 0.32} radiusY={radius * 0.94} {...common} dash={[5, 5]} />
        </Group>
      );
    }
    default:
      return null;
  }
}

function PolygonControls({
  shape, onChange
}: {
  shape: ShapeObject;
  onChange: (sides: number) => void;
}) {
  const rect = normalizedRect(shape);
  const sides = Math.max(3, Math.min(24, shape.sides ?? 5));
  const x = rect.x + rect.width + 10;
  const y = rect.y;
  const button = (label: string, dx: number, disabled: boolean, run: () => void) => (
    <Group x={x + dx} y={y + 34} opacity={disabled ? 0.38 : 1}
      onMouseDown={(e) => { e.cancelBubble = true; if (!disabled) run(); }}
      onTouchStart={(e) => { e.cancelBubble = true; if (!disabled) run(); }}>
      <Rect width={28} height={26} fill="#ffffff" stroke={shape.color} strokeWidth={1.2} cornerRadius={6} />
      <Text text={label} y={4} width={28} align="center" fill={shape.color} fontSize={14} fontStyle="bold" />
    </Group>
  );

  return (
    <Group listening>
      <Rect x={rect.x} y={rect.y} width={rect.width} height={rect.height}
        fill="rgba(0,0,0,0.001)" stroke={shape.color} strokeWidth={1} dash={[4, 4]} cornerRadius={4} />
      <Group x={x} y={y}>
        <Rect width={78} height={28} fill="#ffffff" stroke={shape.color} strokeWidth={1.2} cornerRadius={7} />
        <Text text={`${sides} lados`} y={6} width={78} align="center" fill={shape.color} fontSize={12} fontStyle="bold" />
      </Group>
      {button("-", 0, sides <= 3, () => onChange(sides - 1))}
      {button("+", 34, sides >= 24, () => onChange(sides + 1))}
    </Group>
  );
}

function anchorStroke(points: number[], anchor: InkAnchor) {
  const next: number[] = [];
  for (let i = 0; i < points.length - 1; i += 2) {
    const local = toLocalPoint({ x: points[i], y: points[i + 1] }, anchor);
    next.push(local.x, local.y);
  }
  return next;
}

function anchorShape(shape: ShapeObject, anchor: InkAnchor): ShapeObject {
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

export function GlobalInkLayer({
  active = true,
  objects: objectsProp,
  anchor
}: {
  active?: boolean;
  objects?: BoardInkObject[];
  anchor?: InkAnchor | null;
}) {
  const inkTool = useBoardStore((s) => s.inkTool);
  const inkColor = useBoardStore((s) => s.inkColor);
  const inkWidth = useBoardStore((s) => s.inkWidth);
  const inkPolygonSides = useBoardStore((s) => s.inkPolygonSides);
  const storeObjects = useBoardStore((s) => s.board?.ink ?? []);
  const addInkObject = useBoardStore((s) => s.addInkObject);
  const setInkObjects = useBoardStore((s) => s.setInkObjects);

  const objects = (objectsProp ?? storeObjects) as InkObject[];
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [previewShape, setPreviewShape] = useState<ShapeObject | null>(null);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const onClear = () => setInkObjects([]);
    const onUndo = () => {
      const current = useBoardStore.getState().board?.ink ?? [];
      setInkObjects(current.slice(0, -1));
    };
    window.addEventListener("ink:clear", onClear);
    window.addEventListener("ink:undo", onUndo);
    return () => {
      window.removeEventListener("ink:clear", onClear);
      window.removeEventListener("ink:undo", onUndo);
    };
  }, [setInkObjects]);

  useEffect(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex >= objects.length) setSelectedPolygonIndex(null);
  }, [objects.length, selectedPolygonIndex]);

  useEffect(() => () => {
    setCurrentPoints([]);
    setPreviewShape(null);
  }, []);

  function getPoint(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    return stage?.getRelativePointerPosition() ?? null;
  }

  function eraseAt(point: Point) {
    const radius = Math.max(16, inkWidth * 2.5);
    const next = [...objects];
    for (let i = next.length - 1; i >= 0; i -= 1) {
      const item = next[i];
      if (item) {
        if (item.anchorElementId && item.anchorElementId !== anchor?.id) continue;
        if (!item.anchorElementId && anchor) continue;
        const hitPoint = item.anchorElementId && anchor ? toLocalPoint(point, anchor) : point;
        const hit = item.kind === "stroke" ? strokeNearPoint(item, hitPoint, radius) : shapeNearPoint(item, hitPoint, radius);
        if (hit) {
          next.splice(i, 1);
          break;
        }
      }
    }
    setInkObjects(next);
  }

  function onStart(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!active) return;
    e.cancelBubble = true;
    const point = getPoint(e);
    if (!point) return;
    if (inkTool === "eraser") {
      eraseAt(point);
      return;
    }
    isDrawingRef.current = true;
    startPointRef.current = point;
    if (inkTool === "pen") {
      setCurrentPoints([point.x, point.y]);
    } else {
      setPreviewShape(boundedShape(point, point, inkTool, inkColor, inkWidth, inkPolygonSides));
    }
  }

  function onMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!active) return;
    const point = getPoint(e);
    if (!point) return;
    if (inkTool === "eraser") {
      e.cancelBubble = true;
      eraseAt(point);
      return;
    }
    if (!isDrawingRef.current || !startPointRef.current) return;
    e.cancelBubble = true;
    if (inkTool === "pen") {
      setCurrentPoints((prev) => [...prev, point.x, point.y]);
    } else {
      setPreviewShape(boundedShape(startPointRef.current, point, inkTool, inkColor, inkWidth, inkPolygonSides));
    }
  }

  function onEnd(e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e) e.cancelBubble = true;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (inkTool === "pen" && currentPoints.length >= 4) {
      addInkObject({
        kind: "stroke",
        points: anchor ? anchorStroke(currentPoints, anchor) : currentPoints,
        color: inkColor,
        width: inkWidth,
        ...(anchor ? { anchorElementId: anchor.id } : {})
      });
    } else if (previewShape) {
      addInkObject(anchor ? anchorShape(previewShape, anchor) : previewShape);
    }
    startPointRef.current = null;
    setCurrentPoints([]);
    setPreviewShape(null);
  }

  function adjustPolygon(index: number, sides: number) {
    const next = objects.map((item, itemIndex) =>
      itemIndex === index && item.kind === "polygon"
        ? { ...item, sides: Math.max(3, Math.min(24, Math.round(sides))), showMeasurements: true }
        : item
    );
    setInkObjects(next);
  }

  return (
    <Layer>
      {active && (
        <Rect
          x={HIT_ORIGIN} y={HIT_ORIGIN}
          width={HIT_SPAN} height={HIT_SPAN}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        />
      )}

      {objects.map((item, index) => (
        item.anchorElementId ? null : renderInkObject(item, index)
      ))}

      {active && objects.map((item, index) => {
        if (item.anchorElementId || item.kind !== "polygon") return null;
        const shape = item as ShapeObject;
        const rect = normalizedRect(shape);
        return (
          <Rect key={`polygon-hit-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height}
            fill="rgba(0,0,0,0.001)" listening
            onMouseDown={(e) => { e.cancelBubble = true; setSelectedPolygonIndex(index); }}
            onTouchStart={(e) => { e.cancelBubble = true; setSelectedPolygonIndex(index); }} />
        );
      })}

      {active && selectedPolygonIndex !== null && objects[selectedPolygonIndex]?.kind === "polygon" && (
        <PolygonControls shape={objects[selectedPolygonIndex] as ShapeObject}
          onChange={(sides) => adjustPolygon(selectedPolygonIndex, sides)} />
      )}

      {currentPoints.length >= 4 && (
        <Line points={currentPoints} stroke={inkColor} strokeWidth={inkWidth}
          lineCap="round" lineJoin="round" tension={0.4} listening={false} />
      )}

      {previewShape && renderInkObject(previewShape, "preview")}
    </Layer>
  );
}
