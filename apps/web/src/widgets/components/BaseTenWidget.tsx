// Material manipulativo Base 10 (bloques multibase 2D/2.5D).
// Las reglas didácticas puras viven en src/manipulatives/base10.ts.
import { Group, Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";
import { newId } from "../../lib/ids";
import {
  BASE10_FREE_UNIT,
  baseTenPieceMetrics,
  baseTenPieceMetrics3D,
  baseTenPiecesValue,
  clampBaseTenPiece,
  countBaseTenPieces,
  createBaseTenPieces,
  exchangeTenNearbyPieces,
  normalizeBaseTenCounts,
  orderBaseTenPieces,
  splitOneBaseTenPiece,
  type BaseTenPiece
} from "../../manipulatives/base10";
import { CountBadge, MiniControl, responsiveUnit, withAlpha } from "./shared";

const BASE10_COLORS = {
  unit: "#f3c969",
  rod: "#22a06b",
  flat: "#38bdf8",
  cube: "#f28c7a",
  outline: "#1e293b"
};

function BaseTenFlat({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const cell = size / 10;
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < 10; i += 1) {
    const p = i * cell;
    lines.push(<Line key={`v-${i}`} points={[x + p, y, x + p, y + size]} stroke={color} strokeWidth={0.45} listening={false} />);
    lines.push(<Line key={`h-${i}`} points={[x, y + p, x + size, y + p]} stroke={color} strokeWidth={0.45} listening={false} />);
  }
  return (
    <>
      <Rect x={x} y={y} width={size} height={size} fill={withAlpha(color, 0.28)} stroke={BASE10_COLORS.outline} strokeWidth={1.4} cornerRadius={3} listening={false} />
      {lines}
    </>
  );
}

function BaseTenRod({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) {
  const cell = width / 10;
  return (
    <>
      <Rect x={x} y={y} width={width} height={height} fill={withAlpha(color, 0.34)} stroke={BASE10_COLORS.outline} strokeWidth={1.4} cornerRadius={3} listening={false} />
      {Array.from({ length: 9 }, (_, i) => (
        <Line key={i} points={[x + cell * (i + 1), y, x + cell * (i + 1), y + height]} stroke={BASE10_COLORS.outline} strokeWidth={0.6} opacity={0.65} listening={false} />
      ))}
    </>
  );
}

function BaseTenUnit3D({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const dx = size * 0.34;
  const dy = size * 0.28;
  return (
    <Group listening={false}>
      <Rect x={x} y={y + dy} width={size} height={size} fill={withAlpha(color, 0.72)} stroke={BASE10_COLORS.outline} strokeWidth={1.05} cornerRadius={1.5} />
      <Line points={[x, y + dy, x + dx, y, x + size + dx, y, x + size, y + dy]} fill={withAlpha(color, 0.56)} stroke={BASE10_COLORS.outline} strokeWidth={1.05} closed />
      <Line points={[x + size, y + dy, x + size + dx, y, x + size + dx, y + size, x + size, y + size + dy]} fill={withAlpha(color, 0.42)} stroke={BASE10_COLORS.outline} strokeWidth={1.05} closed />
    </Group>
  );
}

function BaseTenRod3D({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) {
  const dx = height * 0.95;
  const dy = height * 0.7;
  const cell = width / 10;
  return (
    <Group listening={false}>
      <Rect x={x} y={y + dy} width={width} height={height} fill={withAlpha(color, 0.5)} stroke={BASE10_COLORS.outline} strokeWidth={1.15} cornerRadius={2} />
      <Line points={[x, y + dy, x + dx, y, x + width + dx, y, x + width, y + dy]} fill={withAlpha(color, 0.34)} stroke={BASE10_COLORS.outline} strokeWidth={1.15} closed />
      <Line points={[x + width, y + dy, x + width + dx, y, x + width + dx, y + height, x + width, y + height + dy]} fill={withAlpha(color, 0.27)} stroke={BASE10_COLORS.outline} strokeWidth={1.15} closed />
      {Array.from({ length: 9 }, (_, i) => (
        <Line key={i} points={[x + cell * (i + 1), y + dy, x + cell * (i + 1) + dx, y]} stroke={BASE10_COLORS.outline} strokeWidth={0.45} opacity={0.58} />
      ))}
    </Group>
  );
}

function BaseTenFlat3D({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const dx = size * 0.08;
  const dy = size * 0.06;
  const cell = size / 10;
  return (
    <Group listening={false}>
      <Rect x={x} y={y + dy} width={size} height={size} fill={withAlpha(color, 0.38)} stroke={BASE10_COLORS.outline} strokeWidth={1.25} cornerRadius={3} />
      <Line points={[x, y + dy, x + dx, y, x + size + dx, y, x + size, y + dy]} fill={withAlpha(color, 0.24)} stroke={BASE10_COLORS.outline} strokeWidth={1.25} closed />
      <Line points={[x + size, y + dy, x + size + dx, y, x + size + dx, y + size, x + size, y + size + dy]} fill={withAlpha(color, 0.19)} stroke={BASE10_COLORS.outline} strokeWidth={1.25} closed />
      {Array.from({ length: 9 }, (_, i) => {
        const p = (i + 1) * cell;
        return (
          <Group key={i} listening={false}>
            <Line points={[x + p, y + dy, x + p, y + size + dy]} stroke={color} strokeWidth={0.38} opacity={0.72} />
            <Line points={[x, y + p + dy, x + size, y + p + dy]} stroke={color} strokeWidth={0.38} opacity={0.72} />
          </Group>
        );
      })}
    </Group>
  );
}

function BaseTenCube({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const dx = size * 0.18;
  const dy = size * 0.14;
  const frontSize = size - dx;
  const cell = frontSize / 10;
  return (
    <Group listening={false}>
      <Rect x={x} y={y + dy} width={frontSize} height={frontSize} fill={withAlpha(color, 0.38)} stroke={BASE10_COLORS.outline} strokeWidth={1.35} cornerRadius={2} />
      <Line points={[x, y + dy, x + dx, y, x + size, y, x + frontSize, y + dy]} stroke={BASE10_COLORS.outline} strokeWidth={1.35} fill={withAlpha(color, 0.24)} closed />
      <Line points={[x + frontSize, y + dy, x + size, y, x + size, y + frontSize, x + frontSize, y + size]} stroke={BASE10_COLORS.outline} strokeWidth={1.35} fill={withAlpha(color, 0.18)} closed />
      {Array.from({ length: 9 }, (_, i) => {
        const p = (i + 1) * cell;
        return (
          <Group key={i} listening={false}>
            <Line points={[x + p, y + dy, x + p, y + frontSize + dy]} stroke={color} strokeWidth={0.35} opacity={0.62} />
            <Line points={[x, y + p + dy, x + frontSize, y + p + dy]} stroke={color} strokeWidth={0.35} opacity={0.62} />
            <Line points={[x + p, y + dy, x + p + dx, y]} stroke={BASE10_COLORS.outline} strokeWidth={0.3} opacity={0.46} />
          </Group>
        );
      })}
    </Group>
  );
}

function BaseTenPieceShape({
  piece, color, unit = BASE10_FREE_UNIT, dimensional = false
}: { piece: BaseTenPiece; color: string; unit?: number; dimensional?: boolean }) {
  if (piece.kind === "unit") {
    return dimensional
      ? <BaseTenUnit3D x={0} y={0} size={unit} color={BASE10_COLORS.unit} />
      : <Rect width={unit} height={unit} fill={withAlpha(BASE10_COLORS.unit, 0.78)} stroke={BASE10_COLORS.outline} strokeWidth={1.1} cornerRadius={2} />;
  }
  if (piece.kind === "rod") {
    return dimensional
      ? <BaseTenRod3D x={0} y={0} width={unit * 10} height={unit} color={BASE10_COLORS.rod} />
      : <BaseTenRod x={0} y={0} width={unit * 10} height={unit} color={BASE10_COLORS.rod} />;
  }
  if (piece.kind === "flat") {
    return dimensional
      ? <BaseTenFlat3D x={0} y={0} size={unit * 10} color={BASE10_COLORS.flat} />
      : <BaseTenFlat x={0} y={0} size={unit * 10} color={BASE10_COLORS.flat} />;
  }
  return <BaseTenCube x={0} y={0} size={unit * 10} color={color} />;
}

export function BaseTenWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "base10" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const {
    unitCount,
    rodCount,
    flatCount,
    cubeCount,
    mode = "placeValue",
    pieces = [],
    style,
    showValue,
    showPlaceLabels
  } = element.data;
  const freeValue = baseTenPiecesValue(pieces);
  const value = mode === "free" ? freeValue : unitCount + rodCount * 10 + flatCount * 100 + cubeCount * 1000;
  const width = element.width;
  const height = element.height;
  const scale = responsiveUnit(width, height, 720, 420);
  const pad = Math.max(8, Math.min(38, width * 0.035));
  const gap = Math.max(5, Math.min(26, width * 0.02));
  const headerH = showValue ? Math.max(26, Math.min(92, height * 0.15)) : Math.max(8, 18 * scale);
  const controlH = liveControls ? Math.max(52, Math.min(112, height * 0.22)) : Math.max(8, 12 * scale);
  const labelH = showPlaceLabels ? Math.max(18, Math.min(34, 26 * scale)) : 4;
  const contentY = pad + headerH;
  const contentH = Math.max(56, height - contentY - controlH - pad);
  const colW = (width - pad * 2 - gap * 3) / 4;
  const blockColor = style === "3d" ? BASE10_COLORS.cube : BASE10_COLORS.flat;
  const accent = BASE10_COLORS.cube;
  const dimensional = style === "3d";
  const freeUnit = Math.max(7, Math.min(32, (width - pad * 2) / 42, Math.max(7, contentH / 16)));
  const titleFont = Math.max(12, Math.min(34, headerH * 0.44, width / 18));
  const valueFont = Math.max(18, Math.min(62, headerH * 0.72, width / 10));
  const labelFont = Math.max(8, Math.min(17, 12 * scale));
  const controlBtnH = Math.max(22, Math.min(34, 28 * scale));
  const controlFont = Math.max(8, Math.min(13, 11 * scale));

  const adjust = (key: "unitCount" | "rodCount" | "flatCount" | "cubeCount", delta: number, max: number) => {
    const current = Number(element.data[key]);
    updateElementData(element.id, { [key]: Math.max(0, Math.min(max, current + delta)) });
  };

  const exchange = (from: "unit" | "rod" | "flat") => {
    if (from === "unit" && unitCount >= 10) updateElementData(element.id, { unitCount: unitCount - 10, rodCount: Math.min(99, rodCount + 1) });
    if (from === "rod" && rodCount >= 10) updateElementData(element.id, { rodCount: rodCount - 10, flatCount: Math.min(30, flatCount + 1) });
    if (from === "flat" && flatCount >= 10) updateElementData(element.id, { flatCount: flatCount - 10, cubeCount: Math.min(10, cubeCount + 1) });
  };

  const split = (from: "rod" | "flat" | "cube") => {
    if (from === "rod" && rodCount >= 1) updateElementData(element.id, { rodCount: rodCount - 1, unitCount: Math.min(99, unitCount + 10) });
    if (from === "flat" && flatCount >= 1) updateElementData(element.id, { flatCount: flatCount - 1, rodCount: Math.min(99, rodCount + 10) });
    if (from === "cube" && cubeCount >= 1) updateElementData(element.id, { cubeCount: cubeCount - 1, flatCount: Math.min(30, flatCount + 10) });
  };

  const enterFreeMode = () => {
    updateElementData(element.id, { mode: "free", pieces: createBaseTenPieces(element.data, width, freeUnit, contentY + 16, newId) });
  };

  const normalizeFromPieces = () => {
    const next = countBaseTenPieces(pieces);
    updateElementData(element.id, { ...next, mode: "placeValue", pieces: [] });
  };

  const updatePiecePosition = (pieceId: string, x: number, y: number) => {
    updateElementData(element.id, {
      pieces: pieces.map((piece) => piece.id === pieceId
        ? clampBaseTenPiece({ ...piece, x, y }, width, height, freeUnit, pad, contentY, contentH)
        : piece)
    });
  };

  const addPiece = (kind: BaseTenPiece["kind"]) => {
    const metrics = baseTenPieceMetrics3D(kind, freeUnit);
    const offset = pieces.length % 8;
    updateElementData(element.id, {
      mode: "free",
      pieces: [
        ...pieces,
        {
          id: newId(),
          kind,
          x: Math.max(pad, Math.min(width - pad - metrics.width - 18, pad + 18 + offset * 24)),
          y: Math.max(contentY, Math.min(contentY + contentH - metrics.height - 18, contentY + 18 + offset * 18))
        }
      ].slice(-300)
    });
  };

  const regroupPieces = () => {
    const next = normalizeBaseTenCounts(pieces);
    const data = { ...element.data, ...next };
    updateElementData(element.id, { ...next, pieces: createBaseTenPieces(data, width, freeUnit, contentY + 16, newId), mode: "free" });
  };

  const orderPieces = () => {
    updateElementData(element.id, {
      mode: "free",
      pieces: orderBaseTenPieces(pieces, width, freeUnit, contentY + 16, newId)
    });
  };

  const exchangeFreePieces = (kind: "unit" | "rod" | "flat") => {
    const exchanged = exchangeTenNearbyPieces(pieces, kind, freeUnit, newId)
      .map((piece) => clampBaseTenPiece(piece, width, height, freeUnit, pad, contentY, contentH));
    updateElementData(element.id, { mode: "free", pieces: exchanged });
  };

  const splitFreePiece = (kind: "rod" | "flat" | "cube") => {
    const splitPieces = splitOneBaseTenPiece(pieces, kind, freeUnit, newId)
      .map((piece) => clampBaseTenPiece(piece, width, height, freeUnit, pad, contentY, contentH));
    updateElementData(element.id, { mode: "free", pieces: splitPieces });
  };

  const columnX = (index: number) => pad + index * (colW + gap);
  const labelY = pad + headerH - labelH + 6;
  const visualTop = contentY + labelH;
  const placeBadgeY = contentY + contentH - 36;
  const placeVisualBottom = placeBadgeY - 8;
  const placeVisualH = Math.max(60, placeVisualBottom - visualTop);
  const placeUnit = Math.max(3.8, Math.min(22, (colW - Math.max(18, 36 * scale)) / 11.2, (placeVisualH - Math.max(8, 20 * scale)) / 10.8));
  const placeTen = placeUnit * 10;
  const placeGap = Math.max(0.8, Math.min(5, placeUnit * 0.22));

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={8} />
      <Rect width={width} height={5} fill={BASE10_COLORS.rod} cornerRadius={8} />
      {showValue && (
        <>
          <Text text="Base 10" x={pad} y={pad + 4} width={Math.max(110, width * 0.32)} fill="#172b2a" fontSize={titleFont} fontStyle="bold" />
          <Text text={String(value)} x={width - pad - Math.max(120, width * 0.32)} y={pad} width={Math.max(120, width * 0.32)} align="right"
            fill={accent} fontSize={valueFont} fontStyle="bold" />
        </>
      )}

      {mode === "free" && (
        <>
          <Rect x={pad} y={contentY} width={width - pad * 2} height={contentH}
            fill="#f6f8fb" stroke="#d7e0e7" strokeWidth={0.8} cornerRadius={7} />
          {pieces.length === 0 && (
            <Text text="Sin piezas" x={pad} y={contentY + contentH / 2 - 12} width={width - pad * 2}
              align="center" fill="#64748b" fontSize={16} />
          )}
          {pieces.map((piece) => (
            <Group key={piece.id} x={piece.x} y={piece.y} draggable={liveControls}
              dragBoundFunc={(pos) => {
                const localX = pos.x - element.x;
                const localY = pos.y - element.y;
                const clamped = clampBaseTenPiece({ ...piece, x: localX, y: localY }, width, height, freeUnit, pad, contentY, contentH);
                return { x: element.x + clamped.x, y: element.y + clamped.y };
              }}
              onClick={(e) => { e.cancelBubble = true; }}
              onTap={(e) => { e.cancelBubble = true; }}
              onDragStart={(e) => { e.cancelBubble = true; }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                updatePiecePosition(piece.id, Math.round(e.target.x()), Math.round(e.target.y()));
              }}>
              <Rect width={(dimensional ? baseTenPieceMetrics3D(piece.kind, freeUnit) : baseTenPieceMetrics(piece.kind, freeUnit)).width}
                height={(dimensional ? baseTenPieceMetrics3D(piece.kind, freeUnit) : baseTenPieceMetrics(piece.kind, freeUnit)).height}
                fill="rgba(0,0,0,0.001)" />
              <BaseTenPieceShape piece={piece} color={blockColor} unit={freeUnit} dimensional={dimensional} />
            </Group>
          ))}

          {liveControls && (
            <>
              <Group x={pad} y={height - pad - 72}>
                {[
                  { text: "+U", run: () => addPiece("unit") },
                  { text: "+D", run: () => addPiece("rod") },
                  { text: "+C", run: () => addPiece("flat") },
                  { text: "+M", run: () => addPiece("cube") }
                ].map((item, index) => (
                  <Group key={item.text} x={index * 58}
                    onClick={(e) => { e.cancelBubble = true; item.run(); }}
                    onTap={(e) => { e.cancelBubble = true; item.run(); }}>
                    <Rect width={50} height={controlBtnH} fill="#ffffff" stroke={BASE10_COLORS.rod} strokeWidth={1} cornerRadius={6} />
                    <Text text={item.text} y={(controlBtnH - controlFont) / 2} width={50} align="center" fill={BASE10_COLORS.rod} fontSize={controlFont} fontStyle="bold" />
                  </Group>
                ))}
              </Group>
              <Group x={pad} y={height - pad - 38}>
                {[
                  ...(pieces.length === 0 ? [{ text: "Crear desde valor", run: enterFreeMode }] : []),
                  { text: "Ordenar", run: orderPieces },
                  { text: "Reducir", run: regroupPieces },
                  { text: "Columnas", run: normalizeFromPieces }
                ].map((item, index) => (
                <Group key={item.text} x={index * 126}
                  onClick={(e) => { e.cancelBubble = true; item.run(); }}
                  onTap={(e) => { e.cancelBubble = true; item.run(); }}>
                <Rect width={118} height={controlBtnH} fill="#ffffff" stroke={BASE10_COLORS.rod} strokeWidth={1} cornerRadius={6} />
                  <Text text={item.text} y={(controlBtnH - controlFont) / 2} width={118} align="center" fill={BASE10_COLORS.rod} fontSize={controlFont} fontStyle="bold" />
                </Group>
              ))}
              </Group>
              <Group x={pad + 252} y={height - pad - 72}>
                {[
                  { text: "10U -> 1D", disabled: pieces.filter((piece) => piece.kind === "unit").length < 10, run: () => exchangeFreePieces("unit") },
                  { text: "10D -> 1C", disabled: pieces.filter((piece) => piece.kind === "rod").length < 10, run: () => exchangeFreePieces("rod") },
                  { text: "10C -> 1M", disabled: pieces.filter((piece) => piece.kind === "flat").length < 10, run: () => exchangeFreePieces("flat") }
                ].map((item, index) => (
                  <Group key={item.text} x={index * 92} opacity={item.disabled ? 0.35 : 1}
                    onClick={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}
                    onTap={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}>
                    <Rect width={84} height={controlBtnH} fill="#ffffff" stroke={BASE10_COLORS.rod} strokeWidth={1} cornerRadius={6} />
                    <Text text={item.text} y={(controlBtnH - Math.max(8, controlFont - 1)) / 2} width={84} align="center" fill={BASE10_COLORS.rod} fontSize={Math.max(8, controlFont - 1)} fontStyle="bold" />
                  </Group>
                ))}
              </Group>
              <Group x={pad + 252} y={height - pad - 38}>
                {[
                  { text: "1D -> 10U", disabled: !pieces.some((piece) => piece.kind === "rod"), run: () => splitFreePiece("rod") },
                  { text: "1C -> 10D", disabled: !pieces.some((piece) => piece.kind === "flat"), run: () => splitFreePiece("flat") },
                  { text: "1M -> 10C", disabled: !pieces.some((piece) => piece.kind === "cube"), run: () => splitFreePiece("cube") }
                ].map((item, index) => (
                  <Group key={item.text} x={index * 92} opacity={item.disabled ? 0.35 : 1}
                    onClick={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}
                    onTap={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}>
                    <Rect width={84} height={Math.max(20, controlBtnH - 4)} fill="#f8fafc" stroke={BASE10_COLORS.outline} strokeWidth={0.8} cornerRadius={6} />
                    <Text text={item.text} y={(Math.max(20, controlBtnH - 4) - Math.max(8, controlFont - 2)) / 2} width={84} align="center" fill="#475569" fontSize={Math.max(8, controlFont - 2)} fontStyle="bold" />
                  </Group>
                ))}
              </Group>
            </>
          )}
        </>
      )}

      {mode === "placeValue" && [
        { label: "Millares", count: cubeCount, key: "cubeCount" as const, max: 10 },
        { label: "Centenas", count: flatCount, key: "flatCount" as const, max: 30 },
        { label: "Decenas", count: rodCount, key: "rodCount" as const, max: 99 },
        { label: "Unidades", count: unitCount, key: "unitCount" as const, max: 99 }
      ].map((col, index) => {
        const x = columnX(index);
        return (
          <Group key={col.key}>
            <Rect x={x} y={contentY} width={colW} height={contentH} fill="#f6f8fb" stroke="#d7e0e7" strokeWidth={0.8} cornerRadius={7} />
            {showPlaceLabels && (
              <Text text={col.label} x={x + 8} y={labelY} width={colW - 16} align="center" fill="#64748b" fontSize={labelFont} fontStyle="bold" />
            )}
            {index === 0 && (() => {
              const size = placeTen;
              const count = Math.min(cubeCount, 3);
              const visualW = size;
              const visualH = size;
              const startX = x + (colW - visualW) / 2;
              const startY = visualTop + Math.max(8, (placeVisualH - visualH) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => <BaseTenCube key={i} x={startX + i * placeGap * 2.5} y={startY + i * placeGap * 2} size={size} color={blockColor} />)}
                  <CountBadge x={x + colW / 2 - 23} y={placeBadgeY} text={`x${cubeCount}`} color={blockColor} />
                </>
              );
            })()}
            {index === 1 && (() => {
              const size = placeTen;
              const count = Math.min(flatCount, 4);
              const visualW = dimensional ? size * 1.08 : size;
              const visualH = dimensional ? size * 1.06 : size;
              const startX = x + (colW - visualW) / 2;
              const startY = visualTop + Math.max(8, (placeVisualH - visualH) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => dimensional
                    ? <BaseTenFlat3D key={i} x={startX + i * placeGap * 2} y={startY + i * placeGap * 1.8} size={size} color={BASE10_COLORS.flat} />
                    : <BaseTenFlat key={i} x={startX + i * placeGap * 2} y={startY + i * placeGap * 1.8} size={size} color={BASE10_COLORS.flat} />)}
                  <CountBadge x={x + colW / 2 - 23} y={placeBadgeY} text={`x${flatCount}`} color={BASE10_COLORS.flat} />
                </>
              );
            })()}
            {index === 2 && (() => {
              const rodW = placeTen;
              const rodH = placeUnit;
              const count = Math.min(rodCount, 10);
              const visualW = dimensional ? rodW + rodH * 0.95 : rodW;
              const visualRodH = dimensional ? rodH * 1.7 : rodH;
              const startX = x + (colW - visualW) / 2;
              const stackH = count * visualRodH + Math.max(0, count - 1) * placeGap;
              const startY = visualTop + Math.max(8, (placeVisualH - stackH) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => dimensional
                    ? <BaseTenRod3D key={i} x={startX} y={startY + i * (visualRodH + placeGap)} width={rodW} height={rodH} color={BASE10_COLORS.rod} />
                    : <BaseTenRod key={i} x={startX} y={startY + i * (rodH + placeGap)} width={rodW} height={rodH} color={BASE10_COLORS.rod} />)}
                  <CountBadge x={x + colW / 2 - 23} y={placeBadgeY} text={`x${rodCount}`} color={BASE10_COLORS.rod} />
                </>
              );
            })()}
            {index === 3 && (() => {
              const unitSize = placeUnit;
              const cols = 10;
              const count = Math.min(unitCount, 99);
              const visualUnitW = dimensional ? unitSize * 1.34 : unitSize;
              const visualUnitH = dimensional ? unitSize * 1.28 : unitSize;
              const gridW = cols * visualUnitW;
              const rows = Math.max(1, Math.ceil(count / cols));
              const gridH = rows * visualUnitH;
              const startX = x + (colW - gridW) / 2;
              const startY = visualTop + Math.max(8, (placeVisualH - gridH) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => (
                    dimensional
                      ? <BaseTenUnit3D key={i}
                          x={startX + (i % cols) * visualUnitW}
                          y={startY + Math.floor(i / cols) * visualUnitH}
                          size={unitSize}
                          color={BASE10_COLORS.unit} />
                      : <Rect key={i}
                          x={startX + (i % cols) * unitSize}
                          y={startY + Math.floor(i / cols) * unitSize}
                          width={unitSize} height={unitSize}
                          fill={withAlpha(BASE10_COLORS.unit, 0.72)} stroke={BASE10_COLORS.outline} strokeWidth={0.8} cornerRadius={1.5} listening={false} />
                  ))}
                  <CountBadge x={x + colW / 2 - 23} y={placeBadgeY} text={`x${unitCount}`} color={accent} />
                </>
              );
            })()}

            {liveControls && (
              <>
                <MiniControl x={x + colW / 2 - 34} y={height - pad - 28} label="-" disabled={col.count <= 0}
                  onClick={() => adjust(col.key, -1, col.max)} />
                <MiniControl x={x + colW / 2 + 6} y={height - pad - 28} label="+" disabled={col.count >= col.max}
                  onClick={() => adjust(col.key, 1, col.max)} />
              </>
            )}
          </Group>
        );
      })}

      {liveControls && mode === "placeValue" && (
        <Group x={pad} y={height - pad - 72}>
          {[
            { text: "10U -> 1D", disabled: unitCount < 10, run: () => exchange("unit") },
            { text: "10D -> 1C", disabled: rodCount < 10, run: () => exchange("rod") },
            { text: "10C -> 1M", disabled: flatCount < 10, run: () => exchange("flat") },
            { text: "Manipular", disabled: false, run: enterFreeMode }
          ].map((item, index) => {
            const btnW = Math.min(112, (width - pad * 2 - 24) / 4);
            return (
              <Group key={item.text} x={index * (btnW + 8)} opacity={item.disabled ? 0.36 : 1}
                onClick={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}
                onTap={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}>
                <Rect width={btnW} height={controlBtnH} fill="#ffffff" stroke={BASE10_COLORS.rod} strokeWidth={1} cornerRadius={6} />
                <Text text={item.text} y={(controlBtnH - controlFont) / 2} width={btnW} align="center" fill={BASE10_COLORS.rod} fontSize={controlFont} fontStyle="bold" />
              </Group>
            );
          })}
        </Group>
      )}
      {liveControls && mode === "placeValue" && (
        <Group x={pad} y={height - pad - 40}>
          {[
            { text: "1D -> 10U", disabled: rodCount < 1 || unitCount > 89, run: () => split("rod") },
            { text: "1C -> 10D", disabled: flatCount < 1 || rodCount > 89, run: () => split("flat") },
            { text: "1M -> 10C", disabled: cubeCount < 1 || flatCount > 20, run: () => split("cube") }
          ].map((item, index) => {
            const btnW = Math.min(112, (width - pad * 2 - 16) / 3);
            return (
              <Group key={item.text} x={index * (btnW + 8)} opacity={item.disabled ? 0.36 : 1}
                onClick={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}
                onTap={(e) => { e.cancelBubble = true; if (!item.disabled) item.run(); }}>
                <Rect width={btnW} height={Math.max(20, controlBtnH - 4)} fill="#f8fafc" stroke={BASE10_COLORS.outline} strokeWidth={0.8} cornerRadius={6} />
                <Text text={item.text} y={(Math.max(20, controlBtnH - 4) - Math.max(8, controlFont - 1)) / 2} width={btnW} align="center" fill="#475569" fontSize={Math.max(8, controlFont - 1)} fontStyle="bold" />
              </Group>
            );
          })}
        </Group>
      )}
    </>
  );
}
