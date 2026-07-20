// Algoritmos de primaria: valor posicional, clásico, áreas y pico de pájaro.
import { Group, Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { responsiveUnit } from "./shared";

export function AlgorithmWidget({ element }: { element: Extract<BoardElement, { type: "algorithm" }> }) {
  const { operation, operandA, operandB, result, showResult, showPlaceValue, showGrid } = element.data;
  const requestedStrategy = element.data.strategy ?? "placeValue";
  const strategy =
    operation === "divide"
      ? (requestedStrategy === "standard" ? "standard" : "birdBeak")
      : operation === "multiply"
        ? (requestedStrategy === "standard" || requestedStrategy === "placeValue" ? requestedStrategy : "areaModel")
        : (requestedStrategy === "standard" ? "standard" : "placeValue");
  const width = element.width;
  const height = element.height;
  const symbol: Record<typeof operation, string> = { add: "+", subtract: "-", multiply: "x", divide: "÷" };
  const a = operandA || "";
  const b = operandB || "";
  const computed = (() => {
    const n1 = Number(a || 0);
    const n2 = Number(b || 0);
    if (operation === "add") return String(n1 + n2);
    if (operation === "subtract") return String(Math.max(0, n1 - n2));
    if (operation === "multiply") return String(n1 * n2);
    if (operation === "divide") return n2 ? `${Math.floor(n1 / n2)} r${n1 % n2}` : "";
    return "";
  })();
  const shownResult = result || computed;
  const title = operation === "multiply" && strategy === "areaModel"
    ? "Multiplicación por áreas"
    : operation === "divide" && strategy === "birdBeak"
      ? "División pico de pájaro"
      : strategy === "placeValue"
        ? "Valor posicional"
        : "Algoritmo clásico";
  const scale = responsiveUnit(width, height, 460, 300);
  const pad = Math.max(12, Math.min(38, width * 0.055));
  const titleFont = Math.max(12, Math.min(30, 18 * scale));
  const symbolFont = Math.max(18, Math.min(42, 24 * scale));
  const headerTop = Math.max(12, pad);
  const tableTop = showPlaceValue ? Math.max(54, Math.min(112, height * 0.24)) : Math.max(42, Math.min(84, height * 0.18));
  const digits = Math.max(a.length, b.length, showResult ? shownResult.replace(/\D/g, "").length : 0, 3);
  const placeNames = ["U", "D", "C", "UM", "DM", "CM"].slice(0, digits).reverse();
  const cell = Math.max(20, Math.min(96, (width - pad * 2 - Math.max(28, 48 * scale)) / digits));
  const tableW = digits * cell;
  const tableX = Math.max(pad, width - pad - tableW);
  const rowH = Math.max(24, Math.min(86, (height - tableTop - pad - 12) / (operation === "multiply" ? 5 : 4)));
  const numberFont = Math.max(14, Math.min(48, rowH * 0.58, cell * 0.62));
  const operatorFont = Math.max(18, Math.min(44, rowH * 0.66));

  function drawNumber(value: string, row: number, color = "#172b2a") {
    const padded = value.padStart(digits, " ");
    return Array.from({ length: digits }, (_, index) => (
      <Text key={`${row}-${index}-${value}`} text={padded[index] ?? ""} x={tableX + index * cell} y={tableTop + row * rowH + 8}
        width={cell} align="center" fill={color} fontSize={numberFont} fontStyle="bold" fontFamily="monospace" />
    ));
  }

  function drawColumnGrid(rowCount: number) {
    const headerH = showPlaceValue ? Math.max(18, Math.min(34, 24 * scale)) : 0;
    const gridTop = tableTop - headerH;
    const gridH = headerH + rowH * rowCount;
    return (
      <>
        {showPlaceValue && placeNames.map((label, index) => (
          <Group key={label}>
            <Rect x={tableX + index * cell} y={gridTop} width={cell} height={headerH} fill="#eaf6f2" stroke="#b9d8cf" strokeWidth={0.8} />
            <Text text={label} x={tableX + index * cell} y={gridTop + Math.max(3, headerH * 0.22)} width={cell} align="center" fill="#2a7a6d" fontSize={Math.max(8, Math.min(16, 12 * scale))} fontStyle="bold" />
          </Group>
        ))}
        {showGrid && (
          <>
            <Rect x={tableX} y={gridTop} width={tableW} height={gridH} stroke="#d7e0e7" strokeWidth={1.2} />
            {Array.from({ length: digits - 1 }, (_, i) => (
              <Line key={i} points={[tableX + (i + 1) * cell, gridTop, tableX + (i + 1) * cell, gridTop + gridH]} stroke="#d7e0e7" strokeWidth={0.9} />
            ))}
          </>
        )}
      </>
    );
  }

  function drawVerticalAlgorithm() {
    const rowCount = showResult ? 4 : 3;
    return (
      <>
        {drawColumnGrid(rowCount)}
        {drawNumber(a, 0)}
        <Text text={symbol[operation]} x={tableX - Math.max(34, 42 * scale)} y={tableTop + rowH + 8} width={Math.max(26, 30 * scale)} align="center" fill="#e75f3c" fontSize={operatorFont} fontStyle="bold" />
        {drawNumber(b, 1)}
        <Line points={[tableX - Math.max(24, 30 * scale), tableTop + rowH * 2, tableX + tableW, tableTop + rowH * 2]} stroke="#172b2a" strokeWidth={Math.max(1.4, Math.min(3.2, 2.2 * scale))} />
        {showResult && drawNumber(shownResult.replace(/\D/g, ""), 2, "#0f8f83")}
      </>
    );
  }

  function shiftedProductRows() {
    const n1 = Number(a || 0);
    return b.split("").reverse().map((digit, index) => {
      const value = n1 * Number(digit || 0);
      return `${value}${"0".repeat(index)}`;
    }).filter((value) => Number(value) > 0);
  }

  function drawClassicMultiplication() {
    const rows = shiftedProductRows();
    const allRows = Math.max(4, rows.length + (showResult ? 4 : 3));
    const localRowH = Math.max(20, Math.min(70, (height - tableTop - pad) / allRows));
    const localDigits = Math.max(digits, ...rows.map((row) => row.length), showResult ? shownResult.length : 0, 3);
    const localCell = Math.max(18, Math.min(78, (width - pad * 2 - Math.max(28, 48 * scale)) / localDigits));
    const localFont = Math.max(12, Math.min(42, localRowH * 0.62, localCell * 0.62));
    const x = width - pad - localDigits * localCell;
    const draw = (value: string, row: number, color = "#172b2a") => {
      const padded = value.padStart(localDigits, " ");
      return Array.from({ length: localDigits }, (_, index) => (
        <Text key={`${value}-${row}-${index}`} text={padded[index] ?? ""} x={x + index * localCell} y={tableTop + row * localRowH + 5}
          width={localCell} align="center" fill={color} fontSize={localFont} fontStyle="bold" fontFamily="monospace" />
      ));
    };
    return (
      <>
        {draw(a, 0)}
        <Text text="x" x={x - Math.max(30, 36 * scale)} y={tableTop + localRowH + 5} width={Math.max(24, 30 * scale)} align="center" fill="#e75f3c" fontSize={Math.max(18, Math.min(38, 26 * scale))} fontStyle="bold" />
        {draw(b, 1)}
        <Line points={[x - Math.max(20, 24 * scale), tableTop + localRowH * 2, x + localDigits * localCell, tableTop + localRowH * 2]} stroke="#172b2a" strokeWidth={Math.max(1.2, Math.min(3, 2 * scale))} />
        {rows.map((row, index) => draw(row, index + 2, index % 2 === 0 ? "#1a5fa8" : "#64748b"))}
        {showResult && (
          <>
            <Line points={[x - Math.max(20, 24 * scale), tableTop + localRowH * (rows.length + 2.1), x + localDigits * localCell, tableTop + localRowH * (rows.length + 2.1)]} stroke="#172b2a" strokeWidth={Math.max(1.2, Math.min(3, 2 * scale))} />
            {draw(shownResult, rows.length + 2, "#0f8f83")}
          </>
        )}
      </>
    );
  }

  function decompose(value: string) {
    return value.split("").map((digit, index, source) => {
      const place = source.length - index - 1;
      return Number(digit) * 10 ** place;
    }).filter((part) => part > 0);
  }

  function drawAreaMultiplication() {
    const cols = decompose(a);
    const rows = decompose(b);
    const safeCols = cols.length ? cols : [0];
    const safeRows = rows.length ? rows : [0];
    const labelW = Math.min(120, Math.max(38, width * 0.16));
    const totalTextH = showResult ? Math.max(24, Math.min(48, 34 * scale)) : 0;
    const gridX = pad + labelW;
    const gridY = Math.max(58, Math.min(122, height * 0.26));
    const gridW = width - pad * 2 - labelW;
    const gridH = Math.max(100, height - gridY - pad - totalTextH);
    const colW = gridW / safeCols.length;
    const areaRowH = gridH / safeRows.length;
    return (
      <>
        <Text text={a || "__"} x={gridX} y={Math.max(34, gridY - 34)} width={gridW} align="center" fill="#1a5fa8" fontSize={Math.max(13, Math.min(30, 20 * scale))} fontStyle="bold" />
        <Text text={b || "__"} x={pad} y={gridY + gridH / 2 - Math.max(8, 12 * scale)} width={labelW - 10} align="right" fill="#e75f3c" fontSize={Math.max(13, Math.min(30, 20 * scale))} fontStyle="bold" />
        {safeCols.map((col, colIndex) => (
          <Group key={`c-${colIndex}`}>
            <Rect x={gridX + colIndex * colW} y={gridY - Math.max(20, 28 * scale)} width={colW} height={Math.max(20, 28 * scale)} fill="#eaf6f2" stroke="#b9d8cf" strokeWidth={1} />
            <Text text={String(col)} x={gridX + colIndex * colW} y={gridY - Math.max(16, 22 * scale)} width={colW} align="center" fill="#2a7a6d" fontSize={Math.max(9, Math.min(18, 13 * scale))} fontStyle="bold" />
          </Group>
        ))}
        {safeRows.map((row, rowIndex) => (
          <Group key={`r-${rowIndex}`}>
            <Rect x={pad} y={gridY + rowIndex * areaRowH} width={labelW} height={areaRowH} fill="#fff3e8" stroke="#f4b79f" strokeWidth={1} />
            <Text text={String(row)} x={pad} y={gridY + rowIndex * areaRowH + areaRowH / 2 - Math.max(6, 8 * scale)} width={labelW} align="center" fill="#c45d3e" fontSize={Math.max(9, Math.min(18, 13 * scale))} fontStyle="bold" />
            {safeCols.map((col, colIndex) => {
              const product = row * col;
              return (
                <Group key={`cell-${rowIndex}-${colIndex}`}>
                  <Rect x={gridX + colIndex * colW} y={gridY + rowIndex * areaRowH} width={colW} height={areaRowH}
                    fill={(rowIndex + colIndex) % 2 === 0 ? "#ffffff" : "#f7fbfa"} stroke="#d7e0e7" strokeWidth={1} />
                  <Text text={showResult ? String(product) : ""} x={gridX + colIndex * colW + 4} y={gridY + rowIndex * areaRowH + areaRowH / 2 - Math.max(7, 9 * scale)}
                    width={colW - 8} align="center" fill="#172b2a" fontSize={Math.max(9, Math.min(26, areaRowH * 0.35, colW * 0.18))} fontStyle="bold" />
                </Group>
              );
            })}
          </Group>
        ))}
        {showResult && <Text text={`Total ${shownResult}`} x={pad} y={height - pad - Math.max(22, 28 * scale)} width={width - pad * 2} align="right" fill="#0f8f83" fontSize={Math.max(14, Math.min(34, 22 * scale))} fontStyle="bold" />}
      </>
    );
  }

  function drawBirdBeakDivision() {
    const n1 = Number(a || 0);
    const n2 = Number(b || 0);
    const quotient = n2 ? Math.floor(n1 / n2) : 0;
    const remainder = n2 ? n1 % n2 : 0;
    const bracketX = Math.max(74, width * 0.28);
    const bracketY = Math.max(62, height * 0.28);
    const bracketW = width - bracketX - pad;
    const beakY = bracketY + 48;
    const quotientText = showResult ? String(quotient) : "";
    const step = n2 ? String(quotient * n2) : "";

    return (
      <>
        <Text text={b || "__"} x={pad} y={bracketY + 6} width={bracketX - pad - 14} align="right" fill="#e75f3c" fontSize={Math.max(18, Math.min(54, 34 * scale))} fontStyle="bold" />
        <Text text={a || "__"} x={bracketX + 12} y={bracketY + 8} width={bracketW - 18} fill="#172b2a" fontSize={Math.max(18, Math.min(54, 34 * scale))} fontStyle="bold" fontFamily="monospace" />
        <Line points={[bracketX, bracketY, bracketX, bracketY + 64 * scale, bracketX + bracketW, bracketY + 64 * scale]} stroke="#172b2a" strokeWidth={Math.max(1.8, Math.min(4.5, 3 * scale))} lineCap="round" lineJoin="round" />
        <Line points={[bracketX - 20 * scale, bracketY + 64 * scale, bracketX, bracketY + 40 * scale, bracketX + 20 * scale, bracketY + 64 * scale]} stroke="#1a5fa8" strokeWidth={Math.max(1.4, Math.min(3.6, 2.4 * scale))} lineCap="round" lineJoin="round" />
        {showResult && (
          <>
            <Text text={quotientText} x={bracketX + 12} y={bracketY - 42 * scale} width={bracketW - 18} fill="#0f8f83" fontSize={Math.max(16, Math.min(50, 32 * scale))} fontStyle="bold" fontFamily="monospace" />
            <Text text={step} x={bracketX + 12} y={beakY + 42 * scale} width={bracketW - 18} fill="#64748b" fontSize={Math.max(14, Math.min(38, 24 * scale))} fontStyle="bold" fontFamily="monospace" />
            <Line points={[bracketX + 10, beakY + 76, bracketX + Math.max(96, Math.min(180, bracketW * 0.45)), beakY + 76]} stroke="#64748b" strokeWidth={1.7} />
            <Text text={String(remainder)} x={bracketX + 12} y={beakY + 84 * scale} width={bracketW - 18} fill="#0f8f83" fontSize={Math.max(14, Math.min(38, 24 * scale))} fontStyle="bold" fontFamily="monospace" />
          </>
        )}
      </>
    );
  }

  function drawStandardDivision() {
    return (
      <>
        <Text text={`${a || "__"} ÷ ${b || "__"}`} x={pad} y={height * 0.35} width={width - pad * 2} align="center" fill="#172b2a" fontSize={Math.max(18, Math.min(58, width / 10, 40 * scale))} fontStyle="bold" />
        {showResult && <Text text={shownResult || "__"} x={pad} y={height * 0.35 + Math.max(42, 62 * scale)} width={width - pad * 2} align="center" fill="#0f8f83" fontSize={Math.max(16, Math.min(48, width / 12, 34 * scale))} fontStyle="bold" />}
      </>
    );
  }

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={8} />
      <Rect width={width} height={5} fill="#1a5fa8" cornerRadius={8} />
      <Text text={title} x={pad} y={headerTop} width={Math.max(120, width - pad * 2 - Math.max(44, 56 * scale))} fill="#172b2a" fontSize={titleFont} fontStyle="bold" />
      <Text text={symbol[operation]} x={width - pad - Math.max(34, 44 * scale)} y={headerTop - 2} width={Math.max(34, 44 * scale)} align="right" fill="#e75f3c" fontSize={symbolFont} fontStyle="bold" />
      {operation === "multiply" && strategy === "areaModel" && drawAreaMultiplication()}
      {operation === "multiply" && strategy === "standard" && drawClassicMultiplication()}
      {operation !== "divide" && (strategy === "placeValue" || strategy === "standard") && drawVerticalAlgorithm()}
      {operation === "divide" && strategy === "birdBeak" && drawBirdBeakDivision()}
      {operation === "divide" && strategy === "standard" && drawStandardDivision()}
    </>
  );
}
