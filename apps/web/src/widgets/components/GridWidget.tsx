// Cuadrícula matemática configurable.
import { Line, Rect } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function GridWidget({ element }: { element: Extract<BoardElement, { type: "grid" }> }) {
  const { cellSize, lineColor, bgColor, boldEvery } = element.data;
  const shapes: React.ReactNode[] = [];

  shapes.push(
    <Rect key="bg" width={element.width} height={element.height}
      fill={bgColor} cornerRadius={6} stroke={lineColor} strokeWidth={0.5} />
  );

  const colCount = Math.ceil(element.width / cellSize);
  for (let i = 1; i < colCount; i++) {
    const x = i * cellSize;
    const bold = i % boldEvery === 0;
    shapes.push(
      <Line key={`v${i}`} points={[x, 0, x, element.height]}
        stroke={lineColor} strokeWidth={bold ? 1.2 : 0.4} listening={false} />
    );
  }

  const rowCount = Math.ceil(element.height / cellSize);
  for (let i = 1; i < rowCount; i++) {
    const y = i * cellSize;
    const bold = i % boldEvery === 0;
    shapes.push(
      <Line key={`h${i}`} points={[0, y, element.width, y]}
        stroke={lineColor} strokeWidth={bold ? 1.2 : 0.4} listening={false} />
    );
  }

  return <>{shapes}</>;
}
