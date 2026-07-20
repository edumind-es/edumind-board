import { useEffect, useRef, useState } from "react";
import { Arc, Circle, Group, Layer, Line, Rect, RegularPolygon, Text } from "react-konva";
import type Konva from "konva";
import type { BoardInkObject } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { createMates3dSolid, type Mates3dSolidKind } from "../lib/boardFactory";
import { toast } from "./ui/feedback";
import { angleVectorFromDegrees, clampSides, ellipsePolygonPoints, type Point } from "../lib/geometry";
import {
  HIT_ORIGIN,
  HIT_SPAN,
  anchorShape,
  anchorStroke,
  angleMeasure,
  boundedShape,
  inkHitPoint,
  inkObjectBounds,
  isInkShape,
  moveInkObject,
  normalizedRect,
  polygonMeasurements,
  resizeInkShape,
  shapeNearPoint,
  snapMovedInkObject,
  snapSize,
  strokeNearPoint,
  type InkAnchor,
  type InkObject,
  type ShapeObject
} from "../ink/geometry";

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

type CommonProps = { stroke: string; strokeWidth: number; listening: boolean };
type Rect = { x: number; y: number; width: number; height: number };

// Convierte el array plano de Konva [x0,y0,x1,y1,…] en pares de puntos.
function toPairs(flat: number[]): Array<{ x: number; y: number }> {
  const pairs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < flat.length - 1; i += 2) pairs.push({ x: flat[i], y: flat[i + 1] });
  return pairs;
}

// Un vértice está "detrás" si cae en la mitad lejana de la elipse (menor y).
const isBehind = (y: number, cy: number) => y < cy - 0.5;

// Pirámide de base n-gonal proyectada: aristas ocultas en discontinuo.
function renderPyramid(shape: ShapeObject, rect: Rect, common: CommonProps, key?: string | number) {
  const sides = clampSides(shape.sides ?? 4, 3, 12);
  const cx = rect.x + rect.width / 2;
  const rx = rect.width / 2;
  const ry = Math.max(6, rect.height * 0.16);
  const baseCy = rect.y + rect.height - ry;
  const apex = { x: cx, y: rect.y };
  const base = toPairs(ellipsePolygonPoints(cx, baseCy, rx, ry, sides, -90));
  const fill = "rgba(94, 143, 163, 0.1)";

  const baseEdges = base.map((p, i) => {
    const q = base[(i + 1) % sides];
    const hidden = isBehind((p.y + q.y) / 2, baseCy);
    return <Line key={`b${i}`} points={[p.x, p.y, q.x, q.y]} {...common} dash={hidden ? [5, 5] : undefined} />;
  });
  const lateralEdges = base.map((p, i) => {
    const hidden = isBehind(p.y, baseCy);
    return <Line key={`l${i}`} points={[apex.x, apex.y, p.x, p.y]} {...common} dash={hidden ? [5, 5] : undefined} />;
  });

  return (
    <Group key={key} listening={false}>
      <Line points={ellipsePolygonPoints(cx, baseCy, rx, ry, sides, -90)} closed
        fill={fill} stroke="transparent" listening={false} />
      {baseEdges}
      {lateralEdges}
    </Group>
  );
}

// Prisma de base n-gonal (dos bases + aristas verticales).
function renderPrism(shape: ShapeObject, rect: Rect, common: CommonProps, key?: string | number) {
  const sides = clampSides(shape.sides ?? 3, 3, 12);
  const cx = rect.x + rect.width / 2;
  const rx = rect.width / 2;
  const ry = Math.max(6, rect.height * 0.14);
  const topCy = rect.y + ry;
  const bottomCy = rect.y + rect.height - ry;
  const top = toPairs(ellipsePolygonPoints(cx, topCy, rx, ry, sides, -90));
  const bottom = toPairs(ellipsePolygonPoints(cx, bottomCy, rx, ry, sides, -90));

  const vertical = top.map((p, i) => {
    const hidden = isBehind(p.y, topCy);
    return <Line key={`v${i}`} points={[p.x, p.y, bottom[i].x, bottom[i].y]} {...common} dash={hidden ? [5, 5] : undefined} />;
  });
  const bottomEdges = bottom.map((p, i) => {
    const q = bottom[(i + 1) % sides];
    const hidden = isBehind((p.y + q.y) / 2, bottomCy);
    return <Line key={`be${i}`} points={[p.x, p.y, q.x, q.y]} {...common} dash={hidden ? [5, 5] : undefined} />;
  });

  return (
    <Group key={key} listening={false}>
      <Line points={ellipsePolygonPoints(cx, topCy, rx, ry, sides, -90)} closed
        fill="rgba(156, 203, 123, 0.12)" stroke="transparent" listening={false} />
      {bottomEdges}
      {vertical}
      {/* Base superior visible: siempre en trazo continuo, encima del resto */}
      <Line points={ellipsePolygonPoints(cx, topCy, rx, ry, sides, -90)} closed {...common} />
    </Group>
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
      const { angle, rotation } = angleMeasure(shape);
      return (
        <Group key={key} listening={false}>
          <Line points={[shape.x, shape.y, shape.x + rayLen, shape.y]} {...common} lineCap="round" />
          <Line points={[shape.x, shape.y, endX, endY]} {...common} lineCap="round" />
          <Arc x={shape.x} y={shape.y} innerRadius={radius - 4} outerRadius={radius}
            angle={angle} rotation={rotation} fill={shape.color} opacity={0.24} listening={false} />
          {shape.kind === "angleMeasure" && (
            <ProtractorTicks shape={shape} radius={radius + 10} angle={angle} rotation={rotation} />
          )}
          {/* Los grados se muestran en ambos: crear y medir */}
          <Text text={`${angle}°`} x={shape.x + radius + 12} y={shape.y - 26} fill={shape.color}
            fontSize={18} fontStyle="bold" listening={false} />
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
      return renderPyramid(shape, rect, common, key);
    case "triangularPrism":
      return renderPrism(shape, rect, common, key);
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

// Parámetro editable contextual de una forma seleccionada: número de lados
// (polígono/poliedros) o grados (ángulos). Devuelve null si la forma no tiene.
type ShapeParam = { label: (v: number) => string; value: number; min: number; max: number; step: number };

export function shapeParamFor(shape: ShapeObject): ShapeParam | null {
  if (shape.kind === "polygon") {
    return { label: (v) => `${v} lados`, value: clampSides(shape.sides ?? 5), min: 3, max: 24, step: 1 };
  }
  if (shape.kind === "pyramid" || shape.kind === "triangularPrism") {
    return { label: (v) => `${v} lados`, value: clampSides(shape.sides ?? (shape.kind === "pyramid" ? 4 : 3), 3, 12), min: 3, max: 12, step: 1 };
  }
  if (shape.kind === "angle" || shape.kind === "angleMeasure") {
    return { label: (v) => `${v}°`, value: angleMeasure(shape).angle, min: 0, max: 180, step: 5 };
  }
  return null;
}

// Mapea una figura del lienzo a su cuerpo 3D equivalente. Los sólidos van
// directos; las figuras planas se convierten por EXTRUSIÓN (dar profundidad):
// triángulo→prisma triangular, cuadrado→cubo, círculo→cilindro, polígono n→
// prisma de n lados. En el inspector del 3D se puede cambiar el cuerpo luego.
// Devuelve null para lo que no tiene sentido en 3D (líneas, ángulos, base 10).
export function inkShapeToMates3d(shape: ShapeObject): { solid: Mates3dSolidKind; sides: number } | null {
  switch (shape.kind) {
    // Sólidos (proyección 2D → cuerpo real)
    case "cube": return { solid: "cube", sides: 4 };
    case "sphere": return { solid: "sphere", sides: 4 };
    case "cylinder": return { solid: "cylinder", sides: 4 };
    case "cone": return { solid: "cone", sides: 4 };
    case "pyramid": return { solid: "pyramid", sides: clampSides(shape.sides ?? 4, 3, 12) };
    case "triangularPrism": return { solid: "prism", sides: clampSides(shape.sides ?? 3, 3, 12) };
    // Figuras planas → extrusión
    case "triangle": return { solid: "prism", sides: 3 };
    case "rect": return { solid: "cube", sides: 4 };
    case "ellipse": return { solid: "cylinder", sides: 4 };
    case "hexagon": return { solid: "prism", sides: 6 };
    case "polygon": return { solid: "prism", sides: clampSides(shape.sides ?? 5, 3, 12) };
    default: return null;
  }
}

function Open3DButton({
  x, y, color, onOpen
}: {
  x: number;
  y: number;
  color: string;
  onOpen: () => void;
}) {
  return (
    <Group x={x} y={y}
      onMouseDown={(e) => { e.cancelBubble = true; onOpen(); }}
      onTouchStart={(e) => { e.cancelBubble = true; onOpen(); }}>
      <Rect width={104} height={28} fill={color} cornerRadius={7} />
      <Text text="Abrir en 3D ↗" y={7} width={104} align="center" fill="#ffffff" fontSize={12} fontStyle="bold" />
    </Group>
  );
}

function ShapeParamControls({
  shape, param, onChange
}: {
  shape: ShapeObject;
  param: ShapeParam;
  onChange: (value: number) => void;
}) {
  const rect = normalizedRect(shape);
  // Los ángulos se dibujan desde el vértice (shape.x, shape.y); el resto desde su caja
  const anchorX = shape.kind === "angle" || shape.kind === "angleMeasure" ? shape.x : rect.x + rect.width;
  const anchorY = shape.kind === "angle" || shape.kind === "angleMeasure" ? shape.y + 30 : rect.y;
  const x = anchorX + 12;
  const y = anchorY;
  const boxW = 80;
  const button = (label: string, dx: number, disabled: boolean, run: () => void) => (
    <Group x={x + dx} y={y + 34} opacity={disabled ? 0.38 : 1}
      onMouseDown={(e) => { e.cancelBubble = true; if (!disabled) run(); }}
      onTouchStart={(e) => { e.cancelBubble = true; if (!disabled) run(); }}>
      <Rect width={30} height={28} fill="#ffffff" stroke={shape.color} strokeWidth={1.2} cornerRadius={6} />
      <Text text={label} y={5} width={30} align="center" fill={shape.color} fontSize={16} fontStyle="bold" />
    </Group>
  );

  return (
    <Group listening>
      <Group x={x} y={y}>
        <Rect width={boxW} height={28} fill="#ffffff" stroke={shape.color} strokeWidth={1.2} cornerRadius={7} />
        <Text text={param.label(param.value)} y={6} width={boxW} align="center" fill={shape.color} fontSize={13} fontStyle="bold" />
      </Group>
      {button("−", 0, param.value <= param.min, () => onChange(param.value - param.step))}
      {button("+", 36, param.value >= param.max, () => onChange(param.value + param.step))}
    </Group>
  );
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
  const selectedInkIndex = useBoardStore((s) => s.selectedInkIndex);
  const addInkObject = useBoardStore((s) => s.addInkObject);
  const addElementObject = useBoardStore((s) => s.addElementObject);
  const setGlobalInkMode = useBoardStore((s) => s.setGlobalInkMode);
  const setInkObjects = useBoardStore((s) => s.setInkObjects);
  const setSelectedInkIndex = useBoardStore((s) => s.setSelectedInkIndex);
  const setInkColor = useBoardStore((s) => s.setInkColor);
  const setInkWidth = useBoardStore((s) => s.setInkWidth);

  const objects = (objectsProp ?? storeObjects) as InkObject[];
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [previewShape, setPreviewShape] = useState<ShapeObject | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const dragOriginRef = useRef<Point | null>(null);
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
    if (selectedInkIndex !== null && selectedInkIndex >= objects.length) setSelectedInkIndex(null);
  }, [objects.length, selectedInkIndex]);

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
        const hitPoint = inkHitPoint(point, item, anchor);
        const hit = item.kind === "stroke" ? strokeNearPoint(item, hitPoint, radius) : shapeNearPoint(item, hitPoint, radius);
        if (hit) {
          next.splice(i, 1);
          break;
        }
      }
    }
    setInkObjects(next);
  }

  function findInkAt(point: Point) {
    const radius = Math.max(10, inkWidth * 2);
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      const item = objects[index];
      if (!item) continue;
      if (item.anchorElementId && item.anchorElementId !== anchor?.id) continue;
      if (!item.anchorElementId && anchor) continue;
      const hitPoint = inkHitPoint(point, item, anchor);
      const hit = item.kind === "stroke" ? strokeNearPoint(item, hitPoint, radius) : shapeNearPoint(item, hitPoint, radius);
      if (hit) return index;
    }
    return null;
  }

  function updateInkObject(index: number, nextItem: BoardInkObject) {
    setInkObjects(objects.map((item, itemIndex) => itemIndex === index ? nextItem : item));
  }

  function onStart(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!active) return;
    e.cancelBubble = true;
    const point = getPoint(e);
    if (!point) return;
    if (inkTool === "select") {
      const nextSelection = findInkAt(point);
      setSelectedInkIndex(nextSelection);
      const selected = nextSelection !== null ? objects[nextSelection] : null;
      if (selected) {
        setInkColor(selected.color);
        setInkWidth(selected.width);
      }
      return;
    }
    if (inkTool === "eraser") {
      eraseAt(point);
      setSelectedInkIndex(null);
      return;
    }
    setSelectedInkIndex(null);
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
    if (inkTool === "select") return;
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
      // Autoselección de la figura recién dibujada (solo en el lienzo global):
      // muestra al instante los controles contextuales y "Abrir en 3D" sin
      // tener que cambiar a la herramienta de selección.
      if (!anchor) setSelectedInkIndex(objects.length);
    }
    startPointRef.current = null;
    setCurrentPoints([]);
    setPreviewShape(null);
  }

  // Ajusta el parámetro editable de la forma seleccionada: nº de lados en
  // polígonos/poliedros, o grados en ángulos (recalculando el vector del rayo).
  function adjustShapeParam(index: number, value: number) {
    const item = objects[index];
    if (!item || item.kind === "stroke") return;
    let nextItem: BoardInkObject = item;
    if (item.kind === "polygon") {
      nextItem = { ...item, sides: clampSides(value, 3, 24), showMeasurements: true };
    } else if (item.kind === "pyramid" || item.kind === "triangularPrism") {
      nextItem = { ...item, sides: clampSides(value, 3, 12) };
    } else if (item.kind === "angle" || item.kind === "angleMeasure") {
      const rayLength = Math.max(60, Math.hypot(item.w, item.h));
      const { w, h } = angleVectorFromDegrees(value, rayLength);
      nextItem = { ...item, w, h };
    } else {
      return;
    }
    setInkObjects(objects.map((current, currentIndex) => (currentIndex === index ? nextItem : current)));
  }

  function moveSelected(index: number, dx: number, dy: number) {
    const item = objects[index];
    if (!item) return;
    updateInkObject(index, snapMovedInkObject(item, index, objects, dx, dy));
  }

  function resizeSelectedShape(index: number, width: number, height: number) {
    const item = objects[index];
    if (!item || !isInkShape(item)) return;
    updateInkObject(index, resizeInkShape(item, snapSize(width), snapSize(height)));
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

      {active && selectedInkIndex !== null && objects[selectedInkIndex] && (() => {
        const item = objects[selectedInkIndex];
        const bounds = inkObjectBounds(item);
        const isShape = isInkShape(item);
        return (
          <Group key={`ink-selection-${selectedInkIndex}`} listening>
            <Rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              fill="rgba(0,0,0,0.001)"
              stroke="#f28c7a"
              strokeWidth={1.4}
              dash={[6, 5]}
              draggable
              onDragStart={(e) => {
                e.cancelBubble = true;
                dragOriginRef.current = { x: e.target.x(), y: e.target.y() };
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const origin = dragOriginRef.current ?? { x: bounds.x, y: bounds.y };
                moveSelected(selectedInkIndex, e.target.x() - origin.x, e.target.y() - origin.y);
                e.target.position({ x: bounds.x, y: bounds.y });
                dragOriginRef.current = null;
              }}
            />
            {isShape && (
              <Group
                x={bounds.x + bounds.width - 6}
                y={bounds.y + bounds.height - 6}
                draggable
                onDragStart={(e) => {
                  e.cancelBubble = true;
                }}
                onDragEnd={(e) => {
                  e.cancelBubble = true;
                  resizeSelectedShape(selectedInkIndex, e.target.x() - bounds.x + 6, e.target.y() - bounds.y + 6);
                  e.target.position({ x: bounds.x + bounds.width - 6, y: bounds.y + bounds.height - 6 });
                }}
              >
                <Rect width={12} height={12} fill="#ffffff" stroke="#f28c7a" strokeWidth={1.6} cornerRadius={3} />
              </Group>
            )}
          </Group>
        );
      })()}

      {active && selectedInkIndex !== null && objects[selectedInkIndex] && isInkShape(objects[selectedInkIndex]) && (() => {
        const shape = objects[selectedInkIndex] as ShapeObject;
        const param = shapeParamFor(shape);
        if (!param) return null;
        return (
          <ShapeParamControls shape={shape} param={param}
            onChange={(value) => adjustShapeParam(selectedInkIndex, value)} />
        );
      })()}

      {/* Enlace lienzo → 3D: abre el sólido seleccionado como manipulativo real */}
      {active && selectedInkIndex !== null && objects[selectedInkIndex] && !objects[selectedInkIndex].anchorElementId && (() => {
        const shape = objects[selectedInkIndex] as ShapeObject;
        const map = inkShapeToMates3d(shape);
        if (!map) return null;
        const rect = normalizedRect(shape);
        return (
          <Open3DButton x={rect.x} y={rect.y + rect.height + 8} color={shape.color}
            onOpen={() => {
              addElementObject(createMates3dSolid(map.solid, map.sides, { x: rect.x + rect.width + 40, y: rect.y }));
              setSelectedInkIndex(null);
              setGlobalInkMode(false);
              toast("Sólido abierto en 3D: rótalo y explora caras, aristas y vértices.", "success");
            }} />
        );
      })()}

      {currentPoints.length >= 4 && (
        <Line points={currentPoints} stroke={inkColor} strokeWidth={inkWidth}
          lineCap="round" lineJoin="round" tension={0.4} listening={false} />
      )}

      {previewShape && renderInkObject(previewShape, "preview")}
    </Layer>
  );
}
