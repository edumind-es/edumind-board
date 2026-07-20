// Semáforo de aula (rojo/amarillo/verde).
import { Circle, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";

export function Semaphore({
  element, liveControls
}: { element: Extract<BoardElement, { type: "semaphore" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const active = element.data.state;
  const { width, height } = element;

  // Dimensiones 100% proporcionales — escala correctamente con el Transformer
  const cornerR = Math.min(18, width * 0.1, height * 0.08);
  const labelH = Math.max(20, height * 0.13);
  const labelFz = Math.max(10, Math.min(20, labelH * 0.7));
  const lightArea = height - labelH - 12;
  const lightStep = lightArea / 3;
  const radius = Math.min(width * 0.28, lightStep * 0.42);
  const cx = width / 2;

  const LIGHTS = [
    { key: "red",    color: "#d94b3d", idx: 0 },
    { key: "yellow", color: "#e0a72e", idx: 1 },
    { key: "green",  color: "#2f9f72", idx: 2 }
  ];

  return (
    <>
      <Rect width={width} height={height} fill="#22302f" cornerRadius={cornerR} />
      <Text text={element.data.label} y={6} width={width} align="center" fill="#fffaf0" fontSize={labelFz} />
      {LIGHTS.map(({ key, color, idx }) => {
        const cy = labelH + lightStep * idx + lightStep / 2;
        const isActive = active === key;
        return (
          <Circle key={key} x={cx} y={cy} radius={radius} fill={color}
            opacity={isActive ? 1 : 0.22}
            shadowBlur={isActive ? radius * 0.9 : 0} shadowColor={color}
            onClick={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { state: key }); }}
            onTap={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { state: key }); }} />
        );
      })}
    </>
  );
}
