// Marco Konva del widget mindmap. La edición real vive en el overlay HTML/SVG
// (MindMapCanvas, ver BoardCanvas); este marco se ve en capturas y presentación.
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function MindmapWidget({ element }: { element: Extract<BoardElement, { type: "mindmap" }> }) {
  const { width, height } = element;
  const subtitle = element.data.variant === "concept" ? "Mapa conceptual" : "Mapa mental";
  const count = element.data.nodes.length;
  return (
    <>
      <Rect width={width} height={height} fill={element.data.background} stroke="#d7cfc0" strokeWidth={1.5} cornerRadius={12} />
      <Rect width={width} height={5} fill={element.data.accent} cornerRadius={12} />
      <Text text={subtitle} x={18} y={16} width={width - 36} fill="#22302f" fontSize={18} fontStyle="bold" />
      <Text text={count > 0 ? `${count} idea${count === 1 ? "" : "s"}` : "Mapa vacío"} x={18} y={42} width={width - 36} fill="#7a7267" fontSize={14} />
    </>
  );
}
