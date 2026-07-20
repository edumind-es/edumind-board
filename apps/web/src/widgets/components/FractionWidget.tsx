// Fracciones con modelos de barra, círculo y conjunto.
import { Arc, Circle, Group, Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

function FractionBar({
  x, y, width, height, numerator, denominator, color
}: { x: number; y: number; width: number; height: number; numerator: number; denominator: number; color: string }) {
  const safeDen = Math.max(1, denominator);
  const cellW = width / safeDen;
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={width} height={height} fill="#ffffff" stroke="#172b2a" strokeWidth={1.4} cornerRadius={5} />
      {Array.from({ length: safeDen }, (_, i) => (
        <Rect key={i} x={x + i * cellW} y={y} width={cellW} height={height}
          fill={i < numerator ? color : "transparent"} opacity={i < numerator ? 0.78 : 1}
          stroke="#172b2a" strokeWidth={0.7} />
      ))}
    </Group>
  );
}

function FractionCircle({
  x, y, radius, numerator, denominator, color
}: { x: number; y: number; radius: number; numerator: number; denominator: number; color: string }) {
  const safeDen = Math.max(1, denominator);
  return (
    <Group listening={false}>
      {Array.from({ length: safeDen }, (_, i) => {
        const start = -90 + i * 360 / safeDen;
        const angle = 360 / safeDen;
        return (
          <Arc key={i} x={x} y={y} innerRadius={0} outerRadius={radius}
            angle={angle} rotation={start}
            fill={i < numerator ? color : "#ffffff"} stroke="#172b2a" strokeWidth={0.8}
            opacity={i < numerator ? 0.78 : 1} />
        );
      })}
      <Circle x={x} y={y} radius={radius} stroke="#172b2a" strokeWidth={1.4} />
    </Group>
  );
}

function FractionSet({
  x, y, width, numerator, denominator, color
}: { x: number; y: number; width: number; numerator: number; denominator: number; color: string }) {
  const cols = Math.ceil(Math.sqrt(denominator));
  const size = Math.min(34, (width - (cols - 1) * 8) / cols);
  return (
    <Group listening={false}>
      {Array.from({ length: denominator }, (_, i) => (
        <Circle key={i}
          x={x + (i % cols) * (size + 8) + size / 2}
          y={y + Math.floor(i / cols) * (size + 8) + size / 2}
          radius={size / 2}
          fill={i < numerator ? color : "#ffffff"}
          stroke="#172b2a"
          strokeWidth={1.2}
          opacity={i < numerator ? 0.82 : 1} />
      ))}
    </Group>
  );
}

export function FractionWidget({ element }: { element: Extract<BoardElement, { type: "fraction" }> }) {
  const { numerator, denominator, model, compareNumerator, compareDenominator, showCompare, showLabels, color } = element.data;
  const width = element.width;
  const height = element.height;
  const pad = Math.max(18, Math.min(28, width * 0.04));
  const safeNum = Math.min(numerator, denominator);
  const safeCompareNum = Math.min(compareNumerator, compareDenominator);
  const visualY = showLabels ? 76 : 44;
  const visualH = height - visualY - pad;
  const laneH = showCompare ? Math.max(72, visualH / 2 - 12) : visualH;

  function renderModel(y: number, num: number, den: number, secondary = false) {
    const modelColor = secondary ? "#0f8f83" : color;
    if (model === "circle") {
      return <FractionCircle x={width / 2} y={y + laneH / 2} radius={Math.min(laneH * 0.42, width * 0.18)} numerator={num} denominator={den} color={modelColor} />;
    }
    if (model === "set") {
      return <FractionSet x={pad} y={y + 6} width={width - pad * 2} numerator={num} denominator={den} color={modelColor} />;
    }
    return <FractionBar x={pad} y={y + laneH * 0.26} width={width - pad * 2} height={Math.max(34, laneH * 0.36)} numerator={num} denominator={den} color={modelColor} />;
  }

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={8} />
      <Rect width={width} height={5} fill={color} cornerRadius={8} />
      {showLabels && (
        <>
          <Text text="Fracciones" x={pad} y={pad} width={160} fill="#172b2a" fontSize={18} fontStyle="bold" />
          <Text text={`${safeNum}/${denominator}`} x={width - pad - 180} y={pad - 4} width={180} align="right" fill={color} fontSize={34} fontStyle="bold" />
        </>
      )}
      {renderModel(visualY, safeNum, denominator)}
      {showCompare && (
        <>
          <Line points={[pad, visualY + laneH + 8, width - pad, visualY + laneH + 8]} stroke="#d7e0e7" strokeWidth={1} />
          <Text text={`${safeCompareNum}/${compareDenominator}`} x={width - pad - 160} y={visualY + laneH + 18} width={160} align="right" fill="#0f8f83" fontSize={22} fontStyle="bold" />
          {renderModel(visualY + laneH + 26, safeCompareNum, compareDenominator, true)}
        </>
      )}
    </>
  );
}
