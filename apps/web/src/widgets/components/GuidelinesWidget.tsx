// Pauta de escritura (montessori, doble línea, normal).
import { Line, Rect } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function GuidelinesWidget({ element }: { element: Extract<BoardElement, { type: "guidelines" }> }) {
  const { style, lineColor, bgColor, lines: numRows } = element.data;
  const pad = 14;
  const innerW = element.width - pad * 2;
  const rowH = (element.height - pad * 2) / numRows;
  const shapes: React.ReactNode[] = [];

  shapes.push(<Rect key="bg" width={element.width} height={element.height} fill={bgColor} cornerRadius={6} stroke={lineColor} strokeWidth={0.5} />);

  for (let i = 0; i < numRows; i++) {
    const y0 = pad + i * rowH;

    if (style === "montessori") {
      // Zona central resaltada (el "cuerpo" de la letra)
      shapes.push(
        <Rect key={`z${i}`} x={pad} y={y0 + rowH * 0.33} width={innerW} height={rowH * 0.34}
          fill={`${lineColor}1a`} />
      );
      // 3 líneas: base (más gruesa), media, techo
      [y0 + rowH * 0.67, y0 + rowH * 0.33, y0].forEach((y, j) => {
        shapes.push(
          <Line key={`l${i}-${j}`} points={[pad, y, pad + innerW, y]}
            stroke={lineColor} strokeWidth={j === 0 ? 1.4 : 0.75}
            dash={j === 2 ? [6, 4] : undefined} />
        );
      });
    } else if (style === "double") {
      // Línea base + línea guía punteada a la mitad
      shapes.push(
        <Line key={`l${i}-b`} points={[pad, y0 + rowH * 0.7, pad + innerW, y0 + rowH * 0.7]}
          stroke={lineColor} strokeWidth={1.4} />
      );
      shapes.push(
        <Line key={`l${i}-g`} points={[pad, y0 + rowH * 0.35, pad + innerW, y0 + rowH * 0.35]}
          stroke={lineColor} strokeWidth={0.75} dash={[7, 5]} />
      );
    } else {
      // Normal: una línea base
      shapes.push(
        <Line key={`l${i}`} points={[pad, y0 + rowH * 0.75, pad + innerW, y0 + rowH * 0.75]}
          stroke={lineColor} strokeWidth={1.4} />
      );
    }
  }
  return <>{shapes}</>;
}
