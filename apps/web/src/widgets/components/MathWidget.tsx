// Operación matemática simple en vertical u horizontal.
import { Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function MathWidget({ element }: { element: Extract<BoardElement, { type: "math" }> }) {
  const { operation, operandA, operandB, result, showResult, fontSize: fs } = element.data;
  const fontSize = fs ?? 48;
  const pad = 20;
  const numW = element.width - pad * 2;
  const opSymbol: Record<string, string> = { sum: "+", subtract: "−", multiply: "×", divide: "÷" };
  const sym = opSymbol[operation] ?? "+";

  if (operation === "divide") {
    // División horizontal: A ÷ B = R
    const expr = `${operandA || "__"} ÷ ${operandB || "__"} = ${showResult ? (result || "__") : "__"}`;
    const fz = Math.min(fontSize, Math.floor(element.width / (expr.length * 0.62)));
    return (
      <>
        <Rect width={element.width} height={element.height} fill="#fffaf0" cornerRadius={10} />
        <Text text={expr} width={element.width} y={element.height / 2 - Math.round(fz * 0.6)}
          align="center" fill="#22302f" fontSize={fz} fontStyle="bold" />
      </>
    );
  }

  // Vertical: A, op+B, línea, resultado
  const lineSpacing = fontSize * 1.35;
  const blockH = lineSpacing * (showResult ? 3.2 : 2.5);
  const topY = (element.height - blockH) / 2;

  return (
    <>
      <Rect width={element.width} height={element.height} fill="#fffaf0" cornerRadius={10} />
      {/* Primer operando */}
      <Text text={operandA || "__"} x={pad} y={topY}
        width={numW} align="right" fill="#22302f" fontSize={fontSize} fontStyle="bold" />
      {/* Operador */}
      <Text text={sym} x={pad} y={topY + lineSpacing}
        width={32} align="left" fill="#c45d3e" fontSize={fontSize} fontStyle="bold" />
      {/* Segundo operando */}
      <Text text={operandB || "__"} x={pad} y={topY + lineSpacing}
        width={numW} align="right" fill="#22302f" fontSize={fontSize} fontStyle="bold" />
      {/* Línea horizontal */}
      <Line points={[pad, topY + lineSpacing * 2.1, element.width - pad, topY + lineSpacing * 2.1]}
        stroke="#22302f" strokeWidth={2.5} />
      {/* Resultado */}
      {showResult && (
        <Text text={result || "__"} x={pad} y={topY + lineSpacing * 2.25}
          width={numW} align="right" fill="#2a7a6d" fontSize={fontSize} fontStyle="bold" />
      )}
    </>
  );
}
