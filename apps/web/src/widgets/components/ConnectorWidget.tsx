// Conector con flechas para diagramas.
//
// Los extremos viven en `data.desde` / `data.hasta` en coordenadas normalizadas
// del propio recuadro, así que la flecha puede ir en cualquier dirección. El
// valor por defecto (0,0.5 → 1,0.5) es la flecha horizontal de siempre.
import { Arrow, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function ConnectorWidget({ element }: { element: Extract<BoardElement, { type: "connector" }> }) {
  const { label, color, strokeWidth, style, arrowStart, arrowEnd, desde, hasta } = element.data;
  const width = element.width;
  const height = element.height;
  const pad = Math.max(18, strokeWidth * 4);

  // El margen antiguo (pad) solo tenía sentido con la flecha horizontal; aquí
  // se aplica encogiendo el segmento hacia su centro, valga la dirección que
  // valga, y nunca más de un tercio para que no se coma la flecha corta.
  const bruto = {
    a: { x: desde.x * width, y: desde.y * height },
    b: { x: hasta.x * width, y: hasta.y * height }
  };
  const largo = Math.hypot(bruto.b.x - bruto.a.x, bruto.b.y - bruto.a.y) || 1;
  const recorte = Math.min(pad, largo / 3) / largo;
  const a = {
    x: bruto.a.x + (bruto.b.x - bruto.a.x) * recorte,
    y: bruto.a.y + (bruto.b.y - bruto.a.y) * recorte
  };
  const b = {
    x: bruto.b.x - (bruto.b.x - bruto.a.x) * recorte,
    y: bruto.b.y - (bruto.b.y - bruto.a.y) * recorte
  };

  const points = style === "elbow"
    ? [a.x, a.y, (a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x, b.y]
    : [a.x, a.y, b.x, b.y];

  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

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
          <Rect x={midX - 76} y={midY - 18} width={152} height={36} fill="#ffffff" stroke="#d7e0e7" cornerRadius={6} />
          <Text text={label} x={midX - 68} y={midY - 9} width={136} height={20}
            align="center" fill="#22302f" fontSize={14} ellipsis />
        </>
      ) : null}
    </>
  );
}
