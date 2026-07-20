// Lienzo libre por widget con trazos persistidos.
import { useRef, useState } from "react";
import { Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";

export function DrawingWidget({
  element,
  liveControls
}: {
  element: Extract<BoardElement, { type: "drawing" }>;
  liveControls: boolean;
}) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const isDrawingRef = useRef(false);

  const canDraw = liveControls && element.data.drawMode;

  function getLocalPoint(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): { x: number; y: number } | null {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    // El padre del hit-Rect es el Group del ElementNode
    const group = e.target.getParent();
    if (!group) return null;
    return group.getAbsoluteTransform().copy().invert().point(pos);
  }

  function onStart(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!canDraw) return;
    e.cancelBubble = true;
    const pt = getLocalPoint(e);
    if (!pt) return;
    isDrawingRef.current = true;
    setCurrentPoints([pt.x, pt.y]);
  }

  function onMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!isDrawingRef.current || !canDraw) return;
    e.cancelBubble = true;
    const pt = getLocalPoint(e);
    if (!pt) return;
    setCurrentPoints((prev) => [...prev, pt.x, pt.y]);
  }

  function onEnd() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentPoints.length >= 4) {
      updateElementData(element.id, { strokes: [...element.data.strokes, currentPoints] });
    }
    setCurrentPoints([]);
  }

  const { strokeColor, strokeWidth, bgColor } = element.data;

  return (
    <>
      <Rect width={element.width} height={element.height} fill={bgColor} cornerRadius={8}
        stroke="#ded8ce" strokeWidth={1} />
      {element.data.strokes.map((stroke, i) =>
        stroke.length >= 4 ? (
          <Line key={i} points={stroke} stroke={strokeColor} strokeWidth={strokeWidth}
            lineCap="round" lineJoin="round" tension={0.4} />
        ) : null
      )}
      {currentPoints.length >= 4 && (
        <Line points={currentPoints} stroke={strokeColor} strokeWidth={strokeWidth}
          lineCap="round" lineJoin="round" tension={0.4} />
      )}
      {/* Hit area — captura eventos de dibujo sin interferir con el resto del canvas */}
      <Rect width={element.width} height={element.height} fill="transparent"
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} />
      {/* Indicador de modo en esquina */}
      {liveControls && (
        <Text text={element.data.drawMode ? "✏" : "↕"}
          x={element.width - 20} y={4} fontSize={13} fill="#a8a49c" />
      )}
    </>
  );
}
