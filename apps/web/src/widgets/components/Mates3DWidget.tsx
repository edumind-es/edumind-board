// Marco Konva del widget mates3d. La escena WebGL real vive en el overlay
// HTML (ver BoardCanvas); este marco es visible mientras carga el chunk 3D
// y en exportaciones/capturas del canvas.
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { solidFacts } from "../../manipulatives/space3d";

export function Mates3DWidget({ element }: { element: Extract<BoardElement, { type: "mates3d" }> }) {
  const { width, height } = element;
  const subtitle = element.data.mode === "base10"
    ? "Bloques Base 10 con volumen real"
    : solidFacts(element.data.solid, element.data.solidSides).label;

  return (
    <>
      <Rect width={width} height={height} fill="#0d1b2b" stroke="#3d5a73" strokeWidth={1.5} cornerRadius={12} />
      <Rect width={width} height={5} fill="#38bdf8" cornerRadius={12} />
      <Text text="Mates 3D" x={18} y={16} width={width - 36} fill="#e8f1ff" fontSize={20} fontStyle="bold" />
      <Text text={subtitle} x={18} y={44} width={width - 36} fill="#8fb0c9" fontSize={14} />
      <Text text="Cargando escena 3D…" width={width} y={height / 2 - 10}
        align="center" fill="#5d7d99" fontSize={15} />
    </>
  );
}
