// Lógica matemática infantil: series, conteo y clasificación.
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

function LogicShape({ shape, x, y, size, color }: { shape: string; x: number; y: number; size: number; color: string }) {
  if (shape === "circle") return <Circle x={x + size / 2} y={y + size / 2} radius={size / 2} fill={color} stroke="#172b2a" strokeWidth={1.2} />;
  if (shape === "triangle") return <Line points={[x + size / 2, y, x + size, y + size, x, y + size]} fill={color} stroke="#172b2a" strokeWidth={1.2} closed />;
  if (shape === "star") {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const pts: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? size / 2 : size / 4;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    return <Line points={pts} fill={color} stroke="#172b2a" strokeWidth={1.2} closed />;
  }
  return <Rect x={x} y={y} width={size} height={size} fill={color} stroke="#172b2a" strokeWidth={1.2} cornerRadius={5} />;
}

export function LogicWidget({ element }: { element: Extract<BoardElement, { type: "logic" }> }) {
  const { mode, pattern, colors, repeatCount, hiddenIndex, showAnswer, targetCount } = element.data;
  const width = element.width;
  const height = element.height;
  const pad = 22;
  const size = Math.max(34, Math.min(58, (width - pad * 2) / Math.max(8, repeatCount) - 8));
  const cols = Math.max(4, Math.floor((width - pad * 2) / (size + 10)));
  const sequence = Array.from({ length: repeatCount }, (_, index) => ({
    shape: pattern[index % pattern.length],
    color: colors[index % colors.length] ?? "#e75f3c"
  }));

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={8} />
      <Rect width={width} height={5} fill="#0f8f83" cornerRadius={8} />
      <Text text={mode === "count" ? "Conteo" : mode === "sort" ? "Clasificación" : "Serie lógica"} x={pad} y={pad} width={220} fill="#172b2a" fontSize={18} fontStyle="bold" />
      {mode === "count" && (
        <Text text={String(targetCount)} x={width - pad - 90} y={pad - 6} width={90} align="right" fill="#e75f3c" fontSize={36} fontStyle="bold" />
      )}
      {sequence.map((item, index) => {
        const hidden = mode === "pattern" && hiddenIndex === index && !showAnswer;
        const x = pad + (index % cols) * (size + 10);
        const y = 76 + Math.floor(index / cols) * (size + 14);
        return hidden ? (
          <Group key={index} listening={false}>
            <Rect x={x} y={y} width={size} height={size} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.4} dash={[6, 4]} cornerRadius={7} />
            <Text text="?" x={x} y={y + size * 0.18} width={size} align="center" fill="#64748b" fontSize={size * 0.56} fontStyle="bold" />
          </Group>
        ) : <LogicShape key={index} shape={item.shape} x={x} y={y} size={size} color={item.color} />;
      })}
    </>
  );
}
