// Conector con flechas para diagramas.
import { Arrow, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function ConnectorWidget({ element }: { element: Extract<BoardElement, { type: "connector" }> }) {
  const { label, color, strokeWidth, style, arrowStart, arrowEnd } = element.data;
  const width = element.width;
  const height = element.height;
  const midY = height / 2;
  const pad = Math.max(18, strokeWidth * 4);
  const points = style === "elbow"
    ? [pad, midY, width / 2, midY, width / 2, Math.max(pad, height - pad), width - pad, Math.max(pad, height - pad)]
    : [pad, midY, width - pad, midY];

  return (
    <>
      <Rect width={width} height={height} fill="rgba(255,255,255,0.001)" />
      <Arrow points={points}
        stroke={color}
        fill={color}
        strokeWidth={strokeWidth}
        pointerLength={arrowEnd ? Math.max(10, strokeWidth * 3) : 0}
        pointerWidth={arrowEnd ? Math.max(10, strokeWidth * 3) : 0}
        pointerAtBeginning={arrowStart}
        tension={0}
        dash={style === "dashed" ? [12, 8] : undefined}
        lineCap="round"
        lineJoin="round" />
      {label ? (
        <>
          <Rect x={width / 2 - 76} y={midY - 18} width={152} height={36} fill="#ffffff" stroke="#d7e0e7" cornerRadius={6} />
          <Text text={label} x={width / 2 - 68} y={midY - 9} width={136} height={20}
            align="center" fill="#22302f" fontSize={14} ellipsis />
        </>
      ) : null}
    </>
  );
}
