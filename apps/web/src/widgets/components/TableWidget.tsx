// Tabla editable con fila de cabecera opcional.
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function TableWidget({ element }: { element: Extract<BoardElement, { type: "table" }> }) {
  const { rows, cols, cells, headerRow, borderColor, headerBg, fontSize } = element.data;
  const cellW = (element.width - 2) / cols;
  const cellH = (element.height - 2) / rows;
  const pad = 5;
  const shapes: React.ReactNode[] = [];

  // Fondo y borde exterior
  shapes.push(
    <Rect key="bg" width={element.width} height={element.height}
      fill="#fffaf0" stroke={borderColor} strokeWidth={2} cornerRadius={4} />
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 1 + c * cellW;
      const y = 1 + r * cellH;
      const idx = r * cols + c;
      const text = cells[idx] ?? "";
      const isHeader = headerRow && r === 0;
      const fz = Math.min(fontSize, cellH * 0.55);

      shapes.push(
        <Rect key={`b${r}-${c}`} x={x} y={y} width={cellW} height={cellH}
          fill={isHeader ? headerBg : "transparent"}
          stroke={borderColor} strokeWidth={0.8} />
      );
      if (text) {
        shapes.push(
          <Text key={`t${r}-${c}`}
            text={text} x={x + pad} y={y + (cellH - fz) / 2}
            width={cellW - pad * 2} height={fz * 1.2}
            fill="#22302f" fontSize={fz}
            fontStyle={isHeader ? "bold" : "normal"}
            align="center" wrap="none" ellipsis />
        );
      }
    }
  }

  return <>{shapes}</>;
}
