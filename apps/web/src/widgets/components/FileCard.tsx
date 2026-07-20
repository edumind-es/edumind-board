// Tarjeta de archivo (imagen inline o placeholder PDF).
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { CanvasRaster } from "./shared";

export function FileCard({ element }: { element: Extract<BoardElement, { type: "file" }> }) {
  if (element.data.kind === "image") {
    return <CanvasRaster url={element.data.url} width={element.width} height={element.height} />;
  }
  return (
    <>
      <Rect width={element.width} height={element.height} fill="#fffaf0" stroke="#d94b3d" cornerRadius={12} />
      <Text text="PDF" x={18} y={18} fill="#d94b3d" fontSize={34} fontStyle="bold" />
      <Text text={element.data.name} x={18} y={70} width={element.width - 36} fill="#22302f" fontSize={20} />
      <Text text="Visible en presentacion y vista compartida" x={18} y={112} width={element.width - 36} fill="#687876" fontSize={15} />
    </>
  );
}
