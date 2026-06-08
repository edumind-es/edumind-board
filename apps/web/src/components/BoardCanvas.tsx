import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Arc, Arrow, Circle, Group, Image, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { isAllowedEmbedUrl, type BoardDocument, type BoardElement, type BoardInkObject } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { getHubApp } from "../lib/hubApps";
import { newId } from "../lib/ids";
import { GlobalInkLayer, renderInkObject } from "./GlobalInkLayer";

type BoardCanvasProps = {
  /** Prop explícito para vistas de solo lectura (AulaView, ShareView) que
   * reciben el board por SSE. El editor (App.tsx) NO lo pasa: BoardCanvas
   * se suscribe directamente al store, aislándose de los re-renders de App. */
  board?: BoardDocument;
  readonly?: boolean;
  presentation?: boolean;
  liveControls?: boolean;
  /** Ref que recibe la función de captura del canvas (para grabación de sesión) */
  captureRef?: React.MutableRefObject<(() => string | null) | null>;
  /**
   * Modo invitado: true cuando el canvas se muestra a alumnos sin cuenta EDUmind
   * (AulaView). Los widgets Hub usan guestUrl en lugar de la URL autenticada.
   */
  guestMode?: boolean;
};

const LONG_PRESS_MS = 1500;

function isInkContainerElement(element: BoardElement) {
  return ["grid", "guidelines", "table", "base10", "drawing", "fraction", "algorithm", "logic"].includes(element.type);
}

function useCanvasImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
  }, [url]);
  return image;
}

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CanvasRaster({ url, width, height }: { url: string; width: number; height: number }) {
  const image = useCanvasImage(url);
  return image ? (
    <Image image={image} width={width} height={height} cornerRadius={12} />
  ) : (
    <>
      <Rect width={width} height={height} fill="#f1eee8" cornerRadius={12} />
      <Text text="Imagen no disponible" width={width} y={height / 2 - 12} align="center" />
    </>
  );
}

function PictogramImage({
  url, x, y, width, height
}: { url: string; x: number; y: number; width: number; height: number }) {
  const image = useCanvasImage(url);
  return image ? (
    <Image image={image} x={x} y={y} width={width} height={height} cornerRadius={10} />
  ) : (
    <>
      <Rect x={x} y={y} width={width} height={height} fill="#fffaf0" stroke="#d9d2c5" cornerRadius={10} />
      <Text text="..." x={x} y={y + height / 2 - 10} width={width} align="center" fill="#6b6258" fontSize={18} />
    </>
  );
}

function PictogramSequenceWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "pictos" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const { width, height } = element;
  const { items, mode, activeIndex, showLights, repeatCount, title } = element.data;
  const pad = Math.max(12, Math.min(22, width * 0.03));
  const titleH = Math.max(28, Math.min(42, height * 0.13));
  const creditH = 28;
  const lightH = showLights ? Math.max(20, Math.min(34, height * 0.1)) : 6;
  const contentY = pad + titleH;
  const contentH = Math.max(80, height - contentY - creditH - lightH - pad);
  const displayItems = mode === "pattern" && items.length > 0
    ? Array.from({ length: repeatCount }, (_, index) => items[index % items.length])
    : items;
  const count = Math.max(1, displayItems.length);
  const gap = Math.max(8, Math.min(14, width * 0.015));
  const cardW = Math.max(64, Math.min(150, (width - pad * 2 - gap * (count - 1)) / count));
  const cardH = contentH;
  const startX = pad + Math.max(0, (width - pad * 2 - (cardW * count + gap * (count - 1))) / 2);
  const pictoSize = Math.max(40, Math.min(cardW - 16, cardH - 56));
  const active = Math.min(Math.max(activeIndex, 0), Math.max(0, count - 1));

  return (
    <>
      <Rect width={width} height={height} fill="#fffdf4" stroke="#2a7a6d" strokeWidth={1.5} cornerRadius={12} />
      <Rect width={width} height={5} fill="#2a7a6d" cornerRadius={12} />
      <Text text={title || "Secuencia visual"} x={pad} y={pad} width={width - pad * 2}
        fill="#22302f" fontSize={Math.max(16, Math.min(28, titleH * 0.62))} fontStyle="bold" />

      {displayItems.length === 0 ? (
        <Text text="Añade pictogramas ARASAAC desde el inspector." x={pad} y={height / 2 - 12}
          width={width - pad * 2} align="center" fill="#6b6258" fontSize={18} />
      ) : displayItems.map((item, index) => {
        const x = startX + index * (cardW + gap);
        const selected = index === active;
        const y = contentY;
        return (
          <Group key={`${item.id}-${index}`} x={x} y={y}
            onClick={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { activeIndex: index }); }}
            onTap={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { activeIndex: index }); }}>
            <Rect width={cardW} height={cardH} fill={selected ? "#e4f4ee" : "#ffffff"}
              stroke={selected ? "#2a7a6d" : "#d9d2c5"} strokeWidth={selected ? 3 : 1.2} cornerRadius={10} />
            <PictogramImage url={item.url} x={(cardW - pictoSize) / 2} y={10} width={pictoSize} height={pictoSize} />
            <Text text={item.label} x={8} y={Math.min(cardH - 38, pictoSize + 18)} width={cardW - 16}
              height={34} align="center" fill="#22302f" fontSize={Math.max(11, Math.min(16, cardW * 0.12))}
              lineHeight={1.05} wrap="word" />
          </Group>
        );
      })}

      {showLights && displayItems.length > 0 && displayItems.map((item, index) => {
        const cx = startX + index * (cardW + gap) + cardW / 2;
        const cy = height - creditH - lightH / 2 - 2;
        const selected = index === active;
        return (
          <Circle key={`light-${item.id}-${index}`} x={cx} y={cy} radius={Math.max(7, Math.min(13, lightH * 0.34))}
            fill={selected ? "#2f9f72" : "#d9d2c5"} stroke={selected ? "#166748" : "#b8afa3"}
            strokeWidth={selected ? 2 : 1} shadowColor={selected ? "#2f9f72" : undefined} shadowBlur={selected ? 10 : 0} />
        );
      })}

      <Text text="Pictogramas: Gobierno de Aragón · Sergio Palao · ARASAAC · CC BY-NC-SA"
        x={pad} y={height - creditH + 5} width={width - pad * 2} align="center"
        fill="#6b6258" fontSize={Math.max(9, Math.min(12, height * 0.035))} />
    </>
  );
}

function Semaphore({
  element, liveControls
}: { element: Extract<BoardElement, { type: "semaphore" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const active = element.data.state;
  const { width, height } = element;

  // Dimensiones 100% proporcionales — escala correctamente con el Transformer
  const cornerR = Math.min(18, width * 0.1, height * 0.08);
  const labelH = Math.max(20, height * 0.13);
  const labelFz = Math.max(10, Math.min(20, labelH * 0.7));
  const lightArea = height - labelH - 12;
  const lightStep = lightArea / 3;
  const radius = Math.min(width * 0.28, lightStep * 0.42);
  const cx = width / 2;

  const LIGHTS = [
    { key: "red",    color: "#d94b3d", idx: 0 },
    { key: "yellow", color: "#e0a72e", idx: 1 },
    { key: "green",  color: "#2f9f72", idx: 2 }
  ];

  return (
    <>
      <Rect width={width} height={height} fill="#22302f" cornerRadius={cornerR} />
      <Text text={element.data.label} y={6} width={width} align="center" fill="#fffaf0" fontSize={labelFz} />
      {LIGHTS.map(({ key, color, idx }) => {
        const cy = labelH + lightStep * idx + lightStep / 2;
        const isActive = active === key;
        return (
          <Circle key={key} x={cx} y={cy} radius={radius} fill={color}
            opacity={isActive ? 1 : 0.22}
            shadowBlur={isActive ? radius * 0.9 : 0} shadowColor={color}
            onClick={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { state: key }); }}
            onTap={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { state: key }); }} />
        );
      })}
    </>
  );
}

function TimerWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "timer" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const { width, height } = element;
  const style = element.data.style ?? "classic";
  const accent = element.data.accentColor ?? "#c45d3e";
  const initialSeconds = element.data.initialSeconds ?? element.data.seconds;

  // ── Estado local del countdown ────────────────────────────────────────────
  // El countdown corre en estado local (NO en el store) para evitar que
  // los re-renders globales del board cada segundo rompan la navegación
  // del canvas (drag, zoom). El store solo se actualiza en eventos explícitos.
  const [localSeconds, setLocalSeconds] = useState(element.data.seconds);
  const [localRunning, setLocalRunning] = useState(element.data.running);

  // Sincronizar si el Inspector cambia la duración o si se carga un nuevo board
  useEffect(() => {
    setLocalSeconds(element.data.seconds);
  }, [element.data.seconds]);
  useEffect(() => {
    setLocalRunning(element.data.running);
  }, [element.data.running]);

  // Interval local — solo actualiza estado local, no el board store
  useEffect(() => {
    if (!localRunning || localSeconds <= 0 || !liveControls) return;
    const id = setInterval(() => {
      setLocalSeconds((s) => {
        const next = Math.max(0, s - 1);
        if (next === 0) {
          // Timer terminado — guardar en store UNA SOLA VEZ
          updateElementData(element.id, { seconds: 0, running: false });
          setLocalRunning(false);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [localRunning, liveControls, element.id, updateElementData]);

  const progress = initialSeconds > 0 ? localSeconds / initialSeconds : 0;
  const fill = style === "focus" ? "#22302f" : style === "minimal" ? "#ffffff" : "#fffaf0";
  const textColor = style === "focus" ? "#fffaf0" : "#22302f";

  const cornerR = Math.min(18, height * 0.1);
  const labelFz = Math.max(11, Math.min(22, height * 0.12));
  const timeFz = Math.max(20, Math.min(80, height * 0.32));
  const barH = Math.max(5, height * 0.05);
  const barPad = Math.max(10, width * 0.05);
  const btnH = Math.max(26, height * 0.2);
  const btnW1 = Math.max(70, width * 0.42);
  const btnW2 = Math.max(55, width * 0.32);
  const btnY = height - btnH - Math.max(6, height * 0.04);
  const btnFz = Math.max(11, Math.min(16, btnH * 0.45));

  function toggleRunning() {
    const next = !localRunning;
    setLocalRunning(next);
    updateElementData(element.id, { running: next });
  }

  function reset() {
    setLocalSeconds(initialSeconds);
    setLocalRunning(false);
    updateElementData(element.id, { seconds: initialSeconds, running: false });
  }

  return (
    <>
      <Rect width={width} height={height} fill={fill} stroke={accent} cornerRadius={cornerR} />
      {style !== "minimal" && (
        <Rect x={barPad} y={height - barH - 6}
          width={(width - barPad * 2) * Math.max(0, Math.min(1, progress))}
          height={barH} fill={accent} cornerRadius={barH / 2} opacity={0.85} />
      )}
      <Text text={element.data.label} y={Math.max(8, height * 0.08)} width={width}
        align="center" fill={textColor} fontSize={labelFz} />
      <Text text={formatSeconds(localSeconds)}
        y={height / 2 - timeFz * 0.65}
        width={width} align="center"
        fill={style === "focus" ? "#ffffff" : accent}
        fontSize={timeFz} fontStyle="bold" />
      {liveControls && (
        <>
          <Group x={barPad} y={btnY}
            onClick={(e) => { e.cancelBubble = true; toggleRunning(); }}
            onTap={(e) => { e.cancelBubble = true; toggleRunning(); }}>
            <Rect width={btnW1} height={btnH} fill={accent} cornerRadius={6} opacity={0.94} />
            <Text text={localRunning ? "Pausa" : "Iniciar"}
              y={(btnH - btnFz) / 2} width={btnW1} align="center" fill="#fff" fontSize={btnFz} />
          </Group>
          <Group x={width - barPad - btnW2} y={btnY}
            onClick={(e) => { e.cancelBubble = true; reset(); }}
            onTap={(e) => { e.cancelBubble = true; reset(); }}>
            <Rect width={btnW2} height={btnH} fill="#ffffff" stroke={accent} cornerRadius={6} opacity={0.94} />
            <Text text="Reset" y={(btnH - btnFz) / 2} width={btnW2} align="center" fill={accent} fontSize={btnFz} />
          </Group>
        </>
      )}
    </>
  );
}

function FileCard({ element }: { element: Extract<BoardElement, { type: "file" }> }) {
  if (element.data.kind === "image") {
    return <CanvasRaster url={element.data.url} width={element.width} height={element.height} />;
  }
  return (
    <>
      <Rect width={element.width} height={element.height} fill="#fffaf0" stroke="#d94b3d" cornerRadius={12} />
      <Text text="PDF" x={18} y={18} fill="#d94b3d" fontSize={34} fontStyle="bold" />
      <Text text={element.data.name} x={18} y={70} width={element.width - 36} fill="#22302f" fontSize={20} />
      <Text text="Visible en presentacion y vista compartida" x={18} y={112} width={element.width - 36} fill="#687876" fontSize={15} />
    </>
  );
}

// ── Reloj ────────────────────────────────────────────────────────────────────

function ClockWidget({ element }: { element: Extract<BoardElement, { type: "clock" }> }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { style, showSeconds, color, bgColor } = element.data;
  const cx = element.width / 2;
  const cy = element.height / 2;

  if (style === "analog") {
    const r = Math.min(cx, cy) - 10;
    const hAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI * 2 / 12);
    const mAngle = (now.getMinutes() + now.getSeconds() / 60) * (Math.PI * 2 / 60);
    const sAngle = now.getSeconds() * (Math.PI * 2 / 60);
    const handEnd = (angle: number, len: number) => [cx + len * Math.sin(angle), cy - len * Math.cos(angle)];
    return (
      <>
        <Rect width={element.width} height={element.height} fill={bgColor} cornerRadius={8} />
        <Circle x={cx} y={cy} radius={r} stroke={color} strokeWidth={2.5} fill={bgColor} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = i * Math.PI * 2 / 12;
          const major = i % 3 === 0;
          return <Line key={i}
            points={[cx + (r - (major ? 10 : 6)) * Math.sin(a), cy - (r - (major ? 10 : 6)) * Math.cos(a),
                     cx + r * Math.sin(a), cy - r * Math.cos(a)]}
            stroke={color} strokeWidth={major ? 2.5 : 1.5} />;
        })}
        <Line points={[cx, cy, ...handEnd(hAngle, r * 0.52)]} stroke={color} strokeWidth={4} lineCap="round" />
        <Line points={[cx, cy, ...handEnd(mAngle, r * 0.76)]} stroke={color} strokeWidth={2.5} lineCap="round" />
        {showSeconds && <Line points={[cx, cy, ...handEnd(sAngle, r * 0.84)]} stroke="#c45d3e" strokeWidth={1.5} lineCap="round" />}
        <Circle x={cx} y={cy} radius={5} fill={color} />
      </>
    );
  }

  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const timeStr = showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  const fontSize = Math.min(80, Math.floor(element.width / (showSeconds ? 5.2 : 3.4)));
  return (
    <>
      <Rect width={element.width} height={element.height} fill={bgColor} cornerRadius={8} />
      <Text text={timeStr} width={element.width} y={cy - Math.round(fontSize * 0.6)}
        align="center" fill={color} fontSize={fontSize} fontStyle="bold" fontFamily="monospace" />
    </>
  );
}

// ── Dado ─────────────────────────────────────────────────────────────────────

function DiceWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "dice" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const [display, setDisplay] = useState(element.data.value);
  const rollingRef = useRef(false);

  useEffect(() => { setDisplay(element.data.value); }, [element.data.value]);

  function roll() {
    if (!liveControls || rollingRef.current) return;
    rollingRef.current = true;
    const sides = element.data.sides ?? 6;
    let count = 0;
    const total = 14;
    const id = setInterval(() => {
      setDisplay(Math.floor(Math.random() * sides) + 1);
      count++;
      if (count >= total) {
        clearInterval(id);
        const result = Math.floor(Math.random() * sides) + 1;
        setDisplay(result);
        updateElementData(element.id, { value: result });
        rollingRef.current = false;
      }
    }, 70);
  }

  const accent = element.data.color ?? "#c45d3e";
  const fontSize = Math.min(96, Math.floor(element.height * 0.5));
  const cx = element.width / 2;
  const cy = element.height / 2;
  return (
    <>
      <Rect width={element.width} height={element.height} fill="#fffaf0" stroke={accent}
        strokeWidth={3} cornerRadius={16} />
      <Text text={String(display)} width={element.width} y={cy - Math.round(fontSize * 0.6)}
        align="center" fill={accent} fontSize={fontSize} fontStyle="bold" />
      {liveControls && (
        <Text text="toca para tirar" y={element.height - 22} width={element.width}
          align="center" fill="#a8a49c" fontSize={12} />
      )}
      <Rect width={element.width} height={element.height} fill="transparent" cornerRadius={16}
        onClick={(e) => { e.cancelBubble = true; roll(); }}
        onTap={(e) => { e.cancelBubble = true; roll(); }} />
    </>
  );
}

// ── Ruleta ────────────────────────────────────────────────────────────────────

function SpinnerWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "spinner" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const items = element.data.items;
  const [display, setDisplay] = useState<string>(element.data.result ?? items[0] ?? "—");
  const spinningRef = useRef(false);

  useEffect(() => {
    setDisplay(element.data.result ?? items[0] ?? "—");
  }, [element.data.result, items]);

  function spin() {
    if (!liveControls || spinningRef.current || items.length < 2) return;
    spinningRef.current = true;
    let count = 0;
    let delay = 55;
    function step() {
      const idx = Math.floor(Math.random() * items.length);
      setDisplay(items[idx]);
      count++;
      if (count < 18) {
        if (count > 10) delay = Math.round(delay * 1.4);
        setTimeout(step, delay);
      } else {
        const finalIdx = Math.floor(Math.random() * items.length);
        setDisplay(items[finalIdx]);
        updateElementData(element.id, { result: items[finalIdx] });
        spinningRef.current = false;
      }
    }
    step();
  }

  const hasResult = !!element.data.result;
  const fontSize = Math.min(40, Math.floor(element.width / Math.max(4, (display.length || 1))));
  const cy = element.height / 2;
  return (
    <>
      <Rect width={element.width} height={element.height}
        fill={hasResult ? "#d4edda" : "#fffaf0"}
        stroke="#2a7a6d" strokeWidth={2} cornerRadius={14} />
      {items.length === 0 ? (
        <Text text="Añade nombres\nen el Inspector" width={element.width} y={cy - 24}
          align="center" fill="#a8a49c" fontSize={16} lineHeight={1.4} />
      ) : (
        <Text text={display} width={element.width - 16} x={8} y={cy - Math.round(fontSize * 0.65)}
          align="center" fill="#22302f" fontSize={fontSize} fontStyle="bold" lineHeight={1.2} />
      )}
      {liveControls && items.length >= 2 && (
        <Text text="▶  Toca para girar" y={element.height - 26} width={element.width}
          align="center" fill="#2a7a6d" fontSize={13} />
      )}
      <Rect width={element.width} height={element.height} fill="transparent" cornerRadius={14}
        onClick={(e) => { e.cancelBubble = true; spin(); }}
        onTap={(e) => { e.cancelBubble = true; spin(); }} />
    </>
  );
}

// ── Pauta de escritura ───────────────────────────────────────────────────────

function GuidelinesWidget({ element }: { element: Extract<BoardElement, { type: "guidelines" }> }) {
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

// ── Operación matemática ─────────────────────────────────────────────────────

function MathWidget({ element }: { element: Extract<BoardElement, { type: "math" }> }) {
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

// ── Base 10 manipulativa ────────────────────────────────────────────────────

const BASE10_COLORS = {
  unit: "#f3c969",
  rod: "#22a06b",
  flat: "#38bdf8",
  cube: "#f28c7a",
  outline: "#1e293b"
};

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function CountBadge({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect width={46} height={24} fill="#ffffff" stroke={color} strokeWidth={1.2} cornerRadius={12} />
      <Text text={text} width={46} y={4} align="center" fill={color} fontSize={12} fontStyle="bold" />
    </Group>
  );
}

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

function BaseTenCube({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const dx = size * 0.24;
  const dy = size * 0.18;
  return (
    <Group listening={false}>
      <Rect x={x} y={y + dy} width={size - dx} height={size - dy} fill={withAlpha(color, 0.36)} stroke={BASE10_COLORS.outline} strokeWidth={1.4} />
      <Line points={[x + dx, y, x + size, y, x + size, y + size - dy, x + size - dx, y + size, x + size - dx, y + dy, x + dx, y, x, y + dy]} stroke={BASE10_COLORS.outline} strokeWidth={1.4} fill={withAlpha(color, 0.18)} closed />
      <Line points={[x + size, y, x + size - dx, y + dy]} stroke={BASE10_COLORS.outline} strokeWidth={1.4} />
      {Array.from({ length: 4 }, (_, i) => {
        const p = (i + 1) * (size - dx) / 5;
        return (
          <Line key={i} points={[x + p, y + dy, x + p + dx, y]} stroke={BASE10_COLORS.outline} strokeWidth={0.45} opacity={0.65} />
        );
      })}
    </Group>
  );
}

function MiniControl({
  x, y, label, disabled, onClick
}: {
  x: number;
  y: number;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Group x={x} y={y}
      opacity={disabled ? 0.35 : 1}
      onClick={(e) => { e.cancelBubble = true; if (!disabled) onClick(); }}
      onTap={(e) => { e.cancelBubble = true; if (!disabled) onClick(); }}>
      <Rect width={28} height={24} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1} cornerRadius={6} />
      <Text text={label} width={28} y={4} align="center" fill="#172b2a" fontSize={13} fontStyle="bold" />
    </Group>
  );
}

type BaseTenPiece = Extract<BoardElement, { type: "base10" }>["data"]["pieces"][number];

const BASE10_FREE_UNIT = 10;

function baseTenPieceMetrics(kind: BaseTenPiece["kind"], unit = BASE10_FREE_UNIT) {
  if (kind === "unit") return { width: unit, height: unit };
  if (kind === "rod") return { width: unit * 10, height: unit };
  return { width: unit * 10, height: unit * 10 };
}

function createBaseTenPieces(data: Extract<BoardElement, { type: "base10" }>["data"], width: number): BaseTenPiece[] {
  const kinds: Array<{ kind: BaseTenPiece["kind"]; count: number }> = [
    { kind: "cube", count: data.cubeCount },
    { kind: "flat", count: data.flatCount },
    { kind: "rod", count: data.rodCount },
    { kind: "unit", count: data.unitCount }
  ];
  const pieces: BaseTenPiece[] = [];
  let cursorX = 24;
  let cursorY = 88;
  for (const group of kinds) {
    const metrics = baseTenPieceMetrics(group.kind);
    for (let index = 0; index < group.count; index += 1) {
      pieces.push({
        id: newId(),
        kind: group.kind,
        x: cursorX,
        y: cursorY
      });
      cursorX += metrics.width + 16;
      if (cursorX > width - Math.max(120, metrics.width + 28)) {
        cursorX = 24;
        cursorY += metrics.height + 18;
      }
    }
    cursorX = 24;
    cursorY += metrics.height + 26;
  }
  return pieces.slice(0, 300);
}

function BaseTenPieceShape({ piece, color, unit = BASE10_FREE_UNIT }: { piece: BaseTenPiece; color: string; unit?: number }) {
  if (piece.kind === "unit") {
    return <Rect width={unit} height={unit} fill={withAlpha(BASE10_COLORS.unit, 0.78)} stroke={BASE10_COLORS.outline} strokeWidth={1.1} cornerRadius={2} />;
  }
  if (piece.kind === "rod") {
    return <BaseTenRod x={0} y={0} width={unit * 10} height={unit} color={BASE10_COLORS.rod} />;
  }
  if (piece.kind === "flat") {
    return <BaseTenFlat x={0} y={0} size={unit * 10} color={BASE10_COLORS.flat} />;
  }
  return <BaseTenCube x={0} y={0} size={unit * 10} color={color} />;
}

function BaseTenWidget({
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
  const freeValue = pieces.reduce((sum, piece) => sum + (piece.kind === "cube" ? 1000 : piece.kind === "flat" ? 100 : piece.kind === "rod" ? 10 : 1), 0);
  const value = mode === "free" ? freeValue : unitCount + rodCount * 10 + flatCount * 100 + cubeCount * 1000;
  const width = element.width;
  const height = element.height;
  const pad = Math.max(14, Math.min(24, width * 0.03));
  const gap = Math.max(10, Math.min(18, width * 0.018));
  const headerH = showValue ? Math.max(38, Math.min(58, height * 0.14)) : 18;
  const controlH = liveControls ? 88 : 12;
  const labelH = showPlaceLabels ? 26 : 4;
  const contentY = pad + headerH;
  const contentH = Math.max(120, height - contentY - controlH - pad);
  const colW = (width - pad * 2 - gap * 3) / 4;
  const blockColor = style === "3d" ? BASE10_COLORS.cube : BASE10_COLORS.flat;
  const accent = BASE10_COLORS.cube;

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
    updateElementData(element.id, { mode: "free", pieces: createBaseTenPieces(element.data, width) });
  };

  const normalizeFromPieces = () => {
    const next = { unitCount: 0, rodCount: 0, flatCount: 0, cubeCount: 0 };
    for (const piece of pieces) {
      if (piece.kind === "unit") next.unitCount += 1;
      if (piece.kind === "rod") next.rodCount += 1;
      if (piece.kind === "flat") next.flatCount += 1;
      if (piece.kind === "cube") next.cubeCount += 1;
    }
    updateElementData(element.id, { ...next, mode: "placeValue", pieces: [] });
  };

  const updatePiecePosition = (pieceId: string, x: number, y: number) => {
    updateElementData(element.id, {
      pieces: pieces.map((piece) => piece.id === pieceId ? { ...piece, x, y } : piece)
    });
  };

  const regroupPieces = () => {
    const next = { unitCount: 0, rodCount: 0, flatCount: 0, cubeCount: 0 };
    for (const piece of pieces) {
      if (piece.kind === "unit") next.unitCount += 1;
      if (piece.kind === "rod") next.rodCount += 1;
      if (piece.kind === "flat") next.flatCount += 1;
      if (piece.kind === "cube") next.cubeCount += 1;
    }
    next.rodCount += Math.floor(next.unitCount / 10);
    next.unitCount %= 10;
    next.flatCount += Math.floor(next.rodCount / 10);
    next.rodCount %= 10;
    next.cubeCount += Math.floor(next.flatCount / 10);
    next.flatCount %= 10;
    const data = { ...element.data, ...next };
    updateElementData(element.id, { ...next, pieces: createBaseTenPieces(data, width), mode: "free" });
  };

  const columnX = (index: number) => pad + index * (colW + gap);
  const labelY = pad + headerH - labelH + 6;
  const visualTop = contentY + labelH;
  const placeBadgeY = contentY + contentH - 36;
  const placeVisualBottom = placeBadgeY - 8;
  const placeVisualH = Math.max(60, placeVisualBottom - visualTop);
  const placeUnit = Math.max(4, Math.min(14, (colW - 28) / 10, (placeVisualH - 18) / 10));
  const placeTen = placeUnit * 10;
  const placeGap = Math.max(1.2, Math.min(3, placeUnit * 0.22));

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={8} />
      <Rect width={width} height={5} fill={BASE10_COLORS.rod} cornerRadius={8} />
      {showValue && (
        <>
          <Text text="Base 10" x={pad} y={pad + 4} width={160} fill="#172b2a" fontSize={Math.max(16, Math.min(24, headerH * 0.42))} fontStyle="bold" />
          <Text text={String(value)} x={width - pad - 220} y={pad + 1} width={220} align="right"
            fill={accent} fontSize={Math.max(24, Math.min(44, headerH * 0.72))} fontStyle="bold" />
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
              onClick={(e) => { e.cancelBubble = true; }}
              onTap={(e) => { e.cancelBubble = true; }}
              onDragStart={(e) => { e.cancelBubble = true; }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                updatePiecePosition(piece.id, Math.round(e.target.x()), Math.round(e.target.y()));
              }}>
              <Rect width={baseTenPieceMetrics(piece.kind).width}
                height={baseTenPieceMetrics(piece.kind).height}
                fill="rgba(0,0,0,0.001)" />
              <BaseTenPieceShape piece={piece} color={blockColor} />
            </Group>
          ))}

          {liveControls && (
            <Group x={pad} y={height - pad - 72}>
              {[
                ...(pieces.length === 0 ? [{ text: "Crear piezas", run: enterFreeMode }] : []),
                { text: "Agrupar", run: regroupPieces },
                { text: "Columnas", run: normalizeFromPieces }
              ].map((item, index) => (
                <Group key={item.text} x={index * 102}
                  onClick={(e) => { e.cancelBubble = true; item.run(); }}
                  onTap={(e) => { e.cancelBubble = true; item.run(); }}>
                <Rect width={94} height={28} fill="#ffffff" stroke={BASE10_COLORS.rod} strokeWidth={1} cornerRadius={6} />
                  <Text text={item.text} y={6} width={94} align="center" fill={BASE10_COLORS.rod} fontSize={11} fontStyle="bold" />
                </Group>
              ))}
            </Group>
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
              <Text text={col.label} x={x + 8} y={labelY} width={colW - 16} align="center" fill="#64748b" fontSize={12} fontStyle="bold" />
            )}
            {index === 0 && (() => {
              const size = placeTen;
              const count = Math.min(cubeCount, 3);
              const startX = x + (colW - size) / 2;
              const startY = visualTop + Math.max(8, (placeVisualH - size) / 2);
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
              const startX = x + (colW - size) / 2;
              const startY = visualTop + Math.max(8, (placeVisualH - size) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => <BaseTenFlat key={i} x={startX + i * placeGap * 2} y={startY + i * placeGap * 1.8} size={size} color={BASE10_COLORS.flat} />)}
                  <CountBadge x={x + colW / 2 - 23} y={placeBadgeY} text={`x${flatCount}`} color={BASE10_COLORS.flat} />
                </>
              );
            })()}
            {index === 2 && (() => {
              const rodW = placeTen;
              const rodH = placeUnit;
              const count = Math.min(rodCount, 10);
              const startX = x + (colW - rodW) / 2;
              const stackH = count * rodH + Math.max(0, count - 1) * placeGap;
              const startY = visualTop + Math.max(8, (placeVisualH - stackH) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => <BaseTenRod key={i} x={startX} y={startY + i * (rodH + placeGap)} width={rodW} height={rodH} color={BASE10_COLORS.rod} />)}
                  <CountBadge x={x + colW / 2 - 23} y={placeBadgeY} text={`x${rodCount}`} color={BASE10_COLORS.rod} />
                </>
              );
            })()}
            {index === 3 && (() => {
              const unitSize = placeUnit;
              const cols = 10;
              const count = Math.min(unitCount, 99);
              const gridW = cols * unitSize;
              const rows = Math.max(1, Math.ceil(count / cols));
              const gridH = rows * unitSize;
              const startX = x + (colW - gridW) / 2;
              const startY = visualTop + Math.max(8, (placeVisualH - gridH) / 2);
              return (
                <>
                  {Array.from({ length: count }, (_, i) => (
                    <Rect key={i}
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
                <Rect width={btnW} height={28} fill="#ffffff" stroke={BASE10_COLORS.rod} strokeWidth={1} cornerRadius={6} />
                <Text text={item.text} y={6} width={btnW} align="center" fill={BASE10_COLORS.rod} fontSize={11} fontStyle="bold" />
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
                <Rect width={btnW} height={24} fill="#f8fafc" stroke={BASE10_COLORS.outline} strokeWidth={0.8} cornerRadius={6} />
                <Text text={item.text} y={5} width={btnW} align="center" fill="#475569" fontSize={10} fontStyle="bold" />
              </Group>
            );
          })}
        </Group>
      )}
    </>
  );
}

// ── Fracciones ───────────────────────────────────────────────────────────────

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

function FractionWidget({ element }: { element: Extract<BoardElement, { type: "fraction" }> }) {
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

// ── Algoritmos primaria ─────────────────────────────────────────────────────

function AlgorithmWidget({ element }: { element: Extract<BoardElement, { type: "algorithm" }> }) {
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
  const pad = 24;
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
  const digits = Math.max(a.length, b.length, showResult ? shownResult.replace(/\D/g, "").length : 0, 3);
  const placeNames = ["U", "D", "C", "UM", "DM", "CM"].slice(0, digits).reverse();
  const cell = Math.min(64, Math.max(34, (width - pad * 2 - 48) / digits));
  const tableW = digits * cell;
  const tableX = Math.max(pad, width - pad - tableW);
  const tableTop = showPlaceValue ? 72 : 54;
  const rowH = Math.min(56, Math.max(36, (height - tableTop - pad - 12) / (operation === "multiply" ? 5 : 4)));

  function drawNumber(value: string, row: number, color = "#172b2a") {
    const padded = value.padStart(digits, " ");
    return Array.from({ length: digits }, (_, index) => (
      <Text key={`${row}-${index}-${value}`} text={padded[index] ?? ""} x={tableX + index * cell} y={tableTop + row * rowH + 8}
        width={cell} align="center" fill={color} fontSize={Math.min(34, rowH * 0.58)} fontStyle="bold" fontFamily="monospace" />
    ));
  }

  function drawColumnGrid(rowCount: number) {
    const headerH = showPlaceValue ? 24 : 0;
    const gridTop = tableTop - headerH;
    const gridH = headerH + rowH * rowCount;
    return (
      <>
        {showPlaceValue && placeNames.map((label, index) => (
          <Group key={label}>
            <Rect x={tableX + index * cell} y={gridTop} width={cell} height={24} fill="#eaf6f2" stroke="#b9d8cf" strokeWidth={0.8} />
            <Text text={label} x={tableX + index * cell} y={gridTop + 5} width={cell} align="center" fill="#2a7a6d" fontSize={12} fontStyle="bold" />
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
        <Text text={symbol[operation]} x={tableX - 36} y={tableTop + rowH + 8} width={28} align="center" fill="#e75f3c" fontSize={30} fontStyle="bold" />
        {drawNumber(b, 1)}
        <Line points={[tableX - 28, tableTop + rowH * 2, tableX + tableW, tableTop + rowH * 2]} stroke="#172b2a" strokeWidth={2.2} />
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
    const localRowH = Math.min(42, Math.max(28, (height - tableTop - pad) / allRows));
    const localDigits = Math.max(digits, ...rows.map((row) => row.length), showResult ? shownResult.length : 0, 3);
    const localCell = Math.min(52, Math.max(30, (width - pad * 2 - 48) / localDigits));
    const x = width - pad - localDigits * localCell;
    const draw = (value: string, row: number, color = "#172b2a") => {
      const padded = value.padStart(localDigits, " ");
      return Array.from({ length: localDigits }, (_, index) => (
        <Text key={`${value}-${row}-${index}`} text={padded[index] ?? ""} x={x + index * localCell} y={tableTop + row * localRowH + 5}
          width={localCell} align="center" fill={color} fontSize={Math.min(28, localRowH * 0.62)} fontStyle="bold" fontFamily="monospace" />
      ));
    };
    return (
      <>
        {draw(a, 0)}
        <Text text="x" x={x - 32} y={tableTop + localRowH + 5} width={28} align="center" fill="#e75f3c" fontSize={26} fontStyle="bold" />
        {draw(b, 1)}
        <Line points={[x - 24, tableTop + localRowH * 2, x + localDigits * localCell, tableTop + localRowH * 2]} stroke="#172b2a" strokeWidth={2} />
        {rows.map((row, index) => draw(row, index + 2, index % 2 === 0 ? "#1a5fa8" : "#64748b"))}
        {showResult && (
          <>
            <Line points={[x - 24, tableTop + localRowH * (rows.length + 2.1), x + localDigits * localCell, tableTop + localRowH * (rows.length + 2.1)]} stroke="#172b2a" strokeWidth={2} />
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
    const labelW = Math.min(76, Math.max(52, width * 0.16));
    const totalTextH = showResult ? 34 : 0;
    const gridX = pad + labelW;
    const gridY = 80;
    const gridW = width - pad * 2 - labelW;
    const gridH = Math.max(100, height - gridY - pad - totalTextH);
    const colW = gridW / safeCols.length;
    const areaRowH = gridH / safeRows.length;
    return (
      <>
        <Text text={a || "__"} x={gridX} y={46} width={gridW} align="center" fill="#1a5fa8" fontSize={20} fontStyle="bold" />
        <Text text={b || "__"} x={pad} y={gridY + gridH / 2 - 12} width={labelW - 10} align="right" fill="#e75f3c" fontSize={20} fontStyle="bold" />
        {safeCols.map((col, colIndex) => (
          <Group key={`c-${colIndex}`}>
            <Rect x={gridX + colIndex * colW} y={gridY - 28} width={colW} height={28} fill="#eaf6f2" stroke="#b9d8cf" strokeWidth={1} />
            <Text text={String(col)} x={gridX + colIndex * colW} y={gridY - 21} width={colW} align="center" fill="#2a7a6d" fontSize={13} fontStyle="bold" />
          </Group>
        ))}
        {safeRows.map((row, rowIndex) => (
          <Group key={`r-${rowIndex}`}>
            <Rect x={pad} y={gridY + rowIndex * areaRowH} width={labelW} height={areaRowH} fill="#fff3e8" stroke="#f4b79f" strokeWidth={1} />
            <Text text={String(row)} x={pad} y={gridY + rowIndex * areaRowH + areaRowH / 2 - 8} width={labelW} align="center" fill="#c45d3e" fontSize={13} fontStyle="bold" />
            {safeCols.map((col, colIndex) => {
              const product = row * col;
              return (
                <Group key={`cell-${rowIndex}-${colIndex}`}>
                  <Rect x={gridX + colIndex * colW} y={gridY + rowIndex * areaRowH} width={colW} height={areaRowH}
                    fill={(rowIndex + colIndex) % 2 === 0 ? "#ffffff" : "#f7fbfa"} stroke="#d7e0e7" strokeWidth={1} />
                  <Text text={showResult ? String(product) : ""} x={gridX + colIndex * colW + 4} y={gridY + rowIndex * areaRowH + areaRowH / 2 - 9}
                    width={colW - 8} align="center" fill="#172b2a" fontSize={Math.min(18, areaRowH * 0.35)} fontStyle="bold" />
                </Group>
              );
            })}
          </Group>
        ))}
        {showResult && <Text text={`Total ${shownResult}`} x={pad} y={height - pad - 26} width={width - pad * 2} align="right" fill="#0f8f83" fontSize={22} fontStyle="bold" />}
      </>
    );
  }

  function drawBirdBeakDivision() {
    const n1 = Number(a || 0);
    const n2 = Number(b || 0);
    const quotient = n2 ? Math.floor(n1 / n2) : 0;
    const remainder = n2 ? n1 % n2 : 0;
    const bracketX = Math.max(118, width * 0.28);
    const bracketY = Math.max(92, height * 0.28);
    const bracketW = width - bracketX - pad;
    const beakY = bracketY + 48;
    const quotientText = showResult ? String(quotient) : "";
    const step = n2 ? String(quotient * n2) : "";

    return (
      <>
        <Text text={b || "__"} x={pad} y={bracketY + 6} width={bracketX - pad - 14} align="right" fill="#e75f3c" fontSize={34} fontStyle="bold" />
        <Text text={a || "__"} x={bracketX + 12} y={bracketY + 8} width={bracketW - 18} fill="#172b2a" fontSize={34} fontStyle="bold" fontFamily="monospace" />
        <Line points={[bracketX, bracketY, bracketX, bracketY + 64, bracketX + bracketW, bracketY + 64]} stroke="#172b2a" strokeWidth={3} lineCap="round" lineJoin="round" />
        <Line points={[bracketX - 20, bracketY + 64, bracketX, bracketY + 40, bracketX + 20, bracketY + 64]} stroke="#1a5fa8" strokeWidth={2.4} lineCap="round" lineJoin="round" />
        {showResult && (
          <>
            <Text text={quotientText} x={bracketX + 12} y={bracketY - 42} width={bracketW - 18} fill="#0f8f83" fontSize={32} fontStyle="bold" fontFamily="monospace" />
            <Text text={step} x={bracketX + 12} y={beakY + 42} width={bracketW - 18} fill="#64748b" fontSize={24} fontStyle="bold" fontFamily="monospace" />
            <Line points={[bracketX + 10, beakY + 76, bracketX + Math.max(96, Math.min(180, bracketW * 0.45)), beakY + 76]} stroke="#64748b" strokeWidth={1.7} />
            <Text text={String(remainder)} x={bracketX + 12} y={beakY + 84} width={bracketW - 18} fill="#0f8f83" fontSize={24} fontStyle="bold" fontFamily="monospace" />
          </>
        )}
      </>
    );
  }

  function drawStandardDivision() {
    return (
      <>
        <Text text={`${a || "__"} ÷ ${b || "__"}`} x={pad} y={height * 0.35} width={width - pad * 2} align="center" fill="#172b2a" fontSize={Math.min(40, width / 11)} fontStyle="bold" />
        {showResult && <Text text={shownResult || "__"} x={pad} y={height * 0.35 + 62} width={width - pad * 2} align="center" fill="#0f8f83" fontSize={Math.min(34, width / 13)} fontStyle="bold" />}
      </>
    );
  }

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={8} />
      <Rect width={width} height={5} fill="#1a5fa8" cornerRadius={8} />
      <Text text={title} x={pad} y={pad} width={Math.max(180, width - pad * 2 - 56)} fill="#172b2a" fontSize={18} fontStyle="bold" />
      <Text text={symbol[operation]} x={width - pad - 44} y={pad - 2} width={44} align="right" fill="#e75f3c" fontSize={24} fontStyle="bold" />
      {operation === "multiply" && strategy === "areaModel" && drawAreaMultiplication()}
      {operation === "multiply" && strategy === "standard" && drawClassicMultiplication()}
      {operation !== "divide" && (strategy === "placeValue" || strategy === "standard") && drawVerticalAlgorithm()}
      {operation === "divide" && strategy === "birdBeak" && drawBirdBeakDivision()}
      {operation === "divide" && strategy === "standard" && drawStandardDivision()}
    </>
  );
}

// ── Logica matematica infantil ──────────────────────────────────────────────

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

function LogicWidget({ element }: { element: Extract<BoardElement, { type: "logic" }> }) {
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

// ── Cuadrícula matemática ────────────────────────────────────────────────────

function GridWidget({ element }: { element: Extract<BoardElement, { type: "grid" }> }) {
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

// ── Tabla ─────────────────────────────────────────────────────────────────────

function TableWidget({ element }: { element: Extract<BoardElement, { type: "table" }> }) {
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

// ── Comentarios asincronos ──────────────────────────────────────────────────

function CommentWidget({ element }: { element: Extract<BoardElement, { type: "comment" }> }) {
  const { text, author, status, color, createdAt } = element.data;
  const width = element.width;
  const height = element.height;
  const pad = Math.max(14, Math.min(22, width * 0.06));
  const statusMeta = {
    open: { label: "Abierto", color: "#1a5fa8" },
    resolved: { label: "Resuelto", color: "#2f9f72" },
    blocked: { label: "Bloqueado", color: "#c45d3e" }
  }[status];
  const date = (() => {
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("es");
  })();

  return (
    <>
      <Rect width={width} height={height} fill={color} stroke={statusMeta.color} strokeWidth={1.8} cornerRadius={8}
        shadowColor="rgba(34,48,47,0.22)" shadowBlur={8} shadowOffset={{ x: 0, y: 4 }} shadowOpacity={0.22} />
      <Rect width={width} height={5} fill={statusMeta.color} cornerRadius={8} />
      <Text text={text} x={pad} y={pad + 10} width={width - pad * 2} height={Math.max(42, height - pad * 2 - 44)}
        fill="#22302f" fontSize={Math.max(13, Math.min(20, height * 0.12))} lineHeight={1.18} wrap="word" ellipsis />
      <Rect x={pad} y={height - pad - 25} width={Math.min(96, width * 0.36)} height={24}
        fill="#ffffff" opacity={0.78} cornerRadius={6} />
      <Text text={statusMeta.label} x={pad + 8} y={height - pad - 19} width={Math.min(80, width * 0.3)}
        fill={statusMeta.color} fontSize={11} fontStyle="bold" />
      <Text text={[author, date].filter(Boolean).join(" · ")} x={pad + Math.min(108, width * 0.4)} y={height - pad - 18}
        width={Math.max(60, width - pad * 2 - Math.min(108, width * 0.4))}
        align="right" fill="#5f6f6d" fontSize={11} ellipsis />
    </>
  );
}

// ── Diagramas colaborativos ─────────────────────────────────────────────────

function ConnectorWidget({ element }: { element: Extract<BoardElement, { type: "connector" }> }) {
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

function FlowWidget({ element }: { element: Extract<BoardElement, { type: "flow" }> }) {
  const { text, shape, fill, stroke, textColor, fontSize } = element.data;
  const width = element.width;
  const height = element.height;
  const strokeWidth = 2.2;
  const body = (() => {
    if (shape === "decision") {
      return <Line points={[width / 2, 0, width, height / 2, width / 2, height, 0, height / 2]} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    }
    if (shape === "terminator") {
      return <Rect width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={height / 2} />;
    }
    if (shape === "data") {
      const skew = Math.min(34, width * 0.14);
      return <Line points={[skew, 0, width, 0, width - skew, height, 0, height]} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    }
    return <Rect width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={8} />;
  })();

  return (
    <>
      {body}
      <Text text={text} x={18} y={Math.max(12, height / 2 - fontSize)}
        width={width - 36} height={Math.max(24, fontSize * 2.4)}
        align="center" verticalAlign="middle" fill={textColor}
        fontSize={Math.min(fontSize, Math.max(12, height * 0.32))}
        fontStyle="bold" wrap="word" />
    </>
  );
}

// ── QR ───────────────────────────────────────────────────────────────────────

function QRWidget({ element }: { element: Extract<BoardElement, { type: "qr" }> }) {
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);
  const { text, label, bgColor, fgColor } = element.data;

  useEffect(() => {
    let cancelled = false;
    const size = Math.min(element.width, element.height) - (label ? 44 : 16);
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(text || " ", {
        width: Math.max(64, size),
        margin: 1,
        color: { dark: fgColor ?? "#22302f", light: bgColor ?? "#ffffff" }
      }))
      .then((url: string) => {
        if (cancelled) return;
        const img = new window.Image();
        img.onload = () => setQrImage(img);
        img.src = url;
      })
      .catch(() => { if (!cancelled) setQrImage(null); });
    return () => { cancelled = true; };
  }, [text, bgColor, fgColor, element.width, element.height, label]);

  const qrSize = Math.min(element.width, element.height) - (label ? 44 : 16);
  const qrX = (element.width - qrSize) / 2;

  return (
    <>
      <Rect width={element.width} height={element.height} fill={bgColor ?? "#ffffff"} cornerRadius={8} />
      {qrImage ? (
        <Image image={qrImage} x={qrX} y={8} width={qrSize} height={qrSize} />
      ) : (
        <Text text="Generando QR…" width={element.width} y={element.height / 2 - 12}
          align="center" fill="#a8a49c" fontSize={14} />
      )}
      {label ? (
        <Text text={label} y={element.height - 30} width={element.width}
          align="center" fill={fgColor ?? "#22302f"} fontSize={13} />
      ) : null}
    </>
  );
}

// ── Lienzo libre ─────────────────────────────────────────────────────────────

function DrawingWidget({
  element,
  liveControls
}: {
  element: Extract<BoardElement, { type: "drawing" }>;
  liveControls: boolean;
}) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const isDrawingRef = useRef(false);

  const canDraw = liveControls && element.data.drawMode;

  function getLocalPoint(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): { x: number; y: number } | null {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    // El padre del hit-Rect es el Group del ElementNode
    const group = e.target.getParent();
    if (!group) return null;
    return group.getAbsoluteTransform().copy().invert().point(pos);
  }

  function onStart(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!canDraw) return;
    e.cancelBubble = true;
    const pt = getLocalPoint(e);
    if (!pt) return;
    isDrawingRef.current = true;
    setCurrentPoints([pt.x, pt.y]);
  }

  function onMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!isDrawingRef.current || !canDraw) return;
    e.cancelBubble = true;
    const pt = getLocalPoint(e);
    if (!pt) return;
    setCurrentPoints((prev) => [...prev, pt.x, pt.y]);
  }

  function onEnd() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentPoints.length >= 4) {
      updateElementData(element.id, { strokes: [...element.data.strokes, currentPoints] });
    }
    setCurrentPoints([]);
  }

  const { strokeColor, strokeWidth, bgColor } = element.data;

  return (
    <>
      <Rect width={element.width} height={element.height} fill={bgColor} cornerRadius={8}
        stroke="#ded8ce" strokeWidth={1} />
      {element.data.strokes.map((stroke, i) =>
        stroke.length >= 4 ? (
          <Line key={i} points={stroke} stroke={strokeColor} strokeWidth={strokeWidth}
            lineCap="round" lineJoin="round" tension={0.4} />
        ) : null
      )}
      {currentPoints.length >= 4 && (
        <Line points={currentPoints} stroke={strokeColor} strokeWidth={strokeWidth}
          lineCap="round" lineJoin="round" tension={0.4} />
      )}
      {/* Hit area — captura eventos de dibujo sin interferir con el resto del canvas */}
      <Rect width={element.width} height={element.height} fill="transparent"
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} />
      {/* Indicador de modo en esquina */}
      {liveControls && (
        <Text text={element.data.drawMode ? "✏" : "↕"}
          x={element.width - 20} y={4} fontSize={13} fill="#a8a49c" />
      )}
    </>
  );
}

// ── Medidor de ruido ──────────────────────────────────────────────────────────

function NoiseWidget({
  element,
  liveControls
}: {
  element: Extract<BoardElement, { type: "noise" }>;
  liveControls: boolean;
}) {
  const barRef = useRef<Konva.Rect>(null);
  const stateTextRef = useRef<Konva.Text>(null);
  const [active, setActive] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!active || !liveControls) return;
    activeRef.current = true;

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let rafId = 0;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((s) => {
        if (!activeRef.current) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(s);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const maxBarW = element.width - 28;
        const threshold = element.data.threshold;

        function tick() {
          if (!activeRef.current) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          const pct = Math.min(100, Math.round((avg / 128) * 100));
          const barW = Math.max(0, Math.round(maxBarW * pct / 100));
          const isLoud = pct >= threshold;
          const isMid = pct >= threshold * 0.55 && !isLoud;
          const color = isLoud ? "#d94b3d" : isMid ? "#e0a72e" : "#2f9f72";
          const label = isLoud ? "¡Silencio!" : isMid ? "Moderado" : "Silencio";

          if (barRef.current) {
            barRef.current.width(barW);
            barRef.current.fill(color);
          }
          if (stateTextRef.current) {
            stateTextRef.current.text(label);
            stateTextRef.current.fill(color);
          }
          barRef.current?.getLayer()?.batchDraw();
          rafId = requestAnimationFrame(tick);
        }
        tick();
      })
      .catch(() => {
        activeRef.current = false;
        setPermDenied(true);
        setActive(false);
      });

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
    };
  }, [active, liveControls, element.data.threshold, element.width]);

  const cx = element.width / 2;
  const cy = element.height / 2;
  const maxBarW = element.width - 28;

  return (
    <>
      <Rect width={element.width} height={element.height} fill="#22302f" cornerRadius={14} />
      <Text text={element.data.label} y={14} width={element.width}
        align="center" fill="#fffaf0" fontSize={16} />
      {/* Estado principal */}
      <Text ref={stateTextRef}
        text={active ? "Silencio" : (permDenied ? "Sin micrófono" : "Toca para activar")}
        y={cy - 20} width={element.width} align="center"
        fill={active ? "#2f9f72" : "#a8a49c"}
        fontSize={Math.min(26, Math.floor(element.width / 7))} fontStyle="bold" />
      {/* Barra de fondo */}
      <Rect x={14} y={cy + 16} width={maxBarW} height={20} fill="#3a4a49" cornerRadius={10} />
      {/* Barra de nivel (actualización imperativa) */}
      <Rect ref={barRef} x={14} y={cy + 16} width={0} height={20}
        fill="#2f9f72" cornerRadius={10} />
      {/* Marca de umbral */}
      <Line
        points={[14 + maxBarW * element.data.threshold / 100, cy + 12,
                 14 + maxBarW * element.data.threshold / 100, cy + 40]}
        stroke="#fffaf0" strokeWidth={2} dash={[3, 2]} />
      {/* Botón activar/desactivar */}
      {liveControls && !permDenied && (
        <Group x={cx - 40} y={element.height - 36}
          onClick={(e) => { e.cancelBubble = true; setActive((a) => !a); }}
          onTap={(e) => { e.cancelBubble = true; setActive((a) => !a); }}>
          <Rect width={80} height={26} fill={active ? "#d94b3d" : "#2a7a6d"} cornerRadius={6} />
          <Text text={active ? "Detener" : "Activar"} y={5} width={80}
            align="center" fill="#fff" fontSize={13} />
        </Group>
      )}
    </>
  );
}

// ── Hub de apps EDUmind ───────────────────────────────────────────────────────

function HubWidget({
  element,
  liveControls,
  guestMode = false
}: {
  element: Extract<BoardElement, { type: "hub" }>;
  liveControls: boolean;
  guestMode?: boolean;
}) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const updateElement = useBoardStore((s) => s.updateElement);
  const app = getHubApp(element.data.appId);
  const { width, height } = element;
  const pad = 16;
  const isEmbed = element.data.mode === "embed";
  // En modo guest usar guestUrl si existe (acceso sin cuenta EDUmind)
  const targetUrl = (guestMode && app?.guestUrl) ? app.guestUrl : (app?.url ?? "");

  if (!app) return <Rect width={width} height={height} fill="#f1eee8" cornerRadius={10} />;

  if (isEmbed) {
    // En modo embed el iframe HTML overlay hace el trabajo real.
    // El widget Konva muestra el placeholder con opción de fallback a nueva pestaña.
    const fz = Math.max(13, Math.min(20, height * 0.1));
    const btnH = Math.max(26, height * 0.18);
    const btnFz = Math.max(10, Math.min(14, btnH * 0.42));
    const btnW = Math.min(width - pad * 2, 180);
    const btnY = height - btnH - pad * 0.6;
    return (
      <>
        <Rect width={width} height={height} fill={app.bgColor} cornerRadius={10} stroke={app.color} strokeWidth={1.5} />
        <Rect width={width} height={4} fill={app.color} cornerRadius={10} />
        <Text text={`${app.emoji}  ${app.name}`} x={pad} y={Math.max(12, height * 0.1)}
          width={width - pad * 2} fill={app.color} fontSize={fz} fontStyle="bold" />
        <Text text="Cargando app…" x={pad} y={Math.max(12, height * 0.1) + fz + 8}
          width={width - pad * 2} fill="#5c5853" fontSize={Math.max(10, fz * 0.7)} opacity={0.7} />
        {liveControls && (
          <Group x={(width - btnW) / 2} y={btnY}
            onClick={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}
            onTap={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}>
            <Rect width={btnW} height={btnH} fill={app.color} cornerRadius={6} />
            <Text text="Si no carga, abrir →" y={(btnH - btnFz) / 2}
              width={btnW} align="center" fill="#fff" fontSize={btnFz} />
          </Group>
        )}
      </>
    );
  }

  // Modo express: tarjeta de la app con acciones
  const titleFz = Math.max(14, Math.min(22, height * 0.13));
  const descFz = Math.max(10, Math.min(15, height * 0.09));
  const emojiFz = Math.max(20, Math.min(40, height * 0.22));
  const btnH = Math.max(28, height * 0.2);
  const btnY = height - btnH - pad * 0.6;
  const btnFz = Math.max(11, Math.min(15, btnH * 0.44));
  const btnW = (width - pad * 2 - 8) / 2;

  return (
    <>
      <Rect width={width} height={height} fill={app.bgColor} cornerRadius={10} />
      <Rect width={width} height={4} fill={app.color} cornerRadius={10} />

      {/* Emoji grande */}
      <Text text={app.emoji} x={0} y={Math.max(10, height * 0.1)} width={width}
        align="center" fontSize={emojiFz} />

      {/* Nombre */}
      <Text text={app.name} x={pad} y={Math.max(10, height * 0.1) + emojiFz + 6}
        width={width - pad * 2} align="center"
        fill={app.color} fontSize={titleFz} fontStyle="bold" />

      {/* Descripción */}
      <Text text={app.description} x={pad} y={Math.max(10, height * 0.1) + emojiFz + titleFz + 12}
        width={width - pad * 2} align="center"
        fill="#3d3a36" fontSize={descFz} opacity={0.75} lineHeight={1.3} />

      {liveControls && (
        <>
          {/* Botón: Abrir en nueva pestaña — usa guestUrl si está en modo alumno */}
          <Group x={pad} y={btnY}
            onClick={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}
            onTap={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}>
            <Rect width={btnW} height={btnH} fill={app.color} cornerRadius={6} />
            <Text text="Abrir →" y={(btnH - btnFz) / 2} width={btnW}
              align="center" fill="#fff" fontSize={btnFz} />
          </Group>

          {/* Botón: Embeber en el board */}
          <Group x={pad + btnW + 8} y={btnY}
            onClick={(e) => {
              e.cancelBubble = true;
              updateElementData(element.id, { mode: "embed" });
              updateElement(element.id, {
                width: Math.max(element.width, element.data.appId === "pasos" ? 1180 : 920),
                height: Math.max(element.height, element.data.appId === "pasos" ? 760 : 560)
              });
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              updateElementData(element.id, { mode: "embed" });
              updateElement(element.id, {
                width: Math.max(element.width, element.data.appId === "pasos" ? 1180 : 920),
                height: Math.max(element.height, element.data.appId === "pasos" ? 760 : 560)
              });
            }}>
            <Rect width={btnW} height={btnH} fill="#fff" stroke={app.color} strokeWidth={1.5} cornerRadius={6} />
            <Text text="Embed ↗" y={(btnH - btnFz) / 2} width={btnW}
              align="center" fill={app.color} fontSize={btnFz} />
          </Group>
        </>
      )}
    </>
  );
}

function withEmbedParams(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("embed", "1");
    url.searchParams.set("board", "1");
    url.searchParams.set("sso", "edumind");
    url.searchParams.set("parent_origin", window.location.origin);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

// ── ElementNode ──────────────────────────────────────────────────────────────

function ElementNode({
  element, readonly, liveControls, onLongPress, onLiveFrameChange, guestMode, anchoredInk
}: {
  element: BoardElement;
  readonly: boolean;
  liveControls: boolean;
  onLongPress: (id: string) => void;
  onLiveFrameChange?: (element: BoardElement, frame: Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation">>) => void;
  guestMode: boolean;
  anchoredInk: BoardInkObject[];
}) {
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef(false);

  const noteFontSize = Math.max(10, Math.min(60, Math.round(element.height / 8)));
  // El lienzo libre desactiva el arrastre cuando está en modo dibujo
  const isDrawMode = element.type === "drawing" && element.data.drawMode;

  function startLongPress() {
    touchMovedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) onLongPress(element.id);
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }

  return (
    <Group id={element.id} x={element.x} y={element.y} rotation={element.rotation}
      opacity={element.opacity} draggable={!readonly && !element.locked && !isDrawMode}
      onClick={(e) => { e.cancelBubble = true; if (!readonly) setSelectedId(element.id); }}
      onTap={(e) => { e.cancelBubble = true; if (!readonly) setSelectedId(element.id); }}
      onTouchStart={() => { if (!readonly) startLongPress(); }}
      onTouchMove={() => { touchMovedRef.current = true; cancelLongPress(); }}
      onTouchEnd={cancelLongPress}
      onDragStart={cancelLongPress}
      onDragMove={(e) => {
        if (e.target.id() === element.id) onLiveFrameChange?.(element, { x: e.target.x(), y: e.target.y() });
      }}
      onDragEnd={(e) => { if (e.target.id() === element.id) updateElement(element.id, { x: e.target.x(), y: e.target.y() }); }}
    >
      {element.type === "note" && (
        <>
          <Rect width={element.width} height={element.height} fill={element.data.color} cornerRadius={12} />
          <Text text={element.data.text} x={18} y={18} width={element.width - 36} height={element.height - 36}
            fill="#22302f" fontSize={noteFontSize} lineHeight={1.25} wrap="word" />
        </>
      )}
      {element.type === "text" && (
        <Text text={element.data.text} width={element.width} height={element.height}
          fill={element.data.color} fontSize={element.data.fontSize} lineHeight={1.15} wrap="word" />
      )}
      {element.type === "image" && <CanvasRaster url={element.data.url} width={element.width} height={element.height} />}
      {element.type === "file" && <FileCard element={element} />}
      {element.type === "iframe" && (
        <>
          <Rect width={element.width} height={element.height} fill="#fffaf0" stroke="#2a7a6d" cornerRadius={12} />
          <Text text={element.data.title} x={18} y={18} width={element.width - 36} fill="#22302f" fontSize={22} />
          <Text text={element.data.url} x={18} y={58} width={element.width - 36} fill="#5f6f6d" fontSize={15} />
        </>
      )}
      {element.type === "timer" && <TimerWidget element={element} liveControls={liveControls} />}
      {element.type === "semaphore" && <Semaphore element={element} liveControls={liveControls} />}
      {element.type === "clock" && <ClockWidget element={element} />}
      {element.type === "dice" && <DiceWidget element={element} liveControls={liveControls} />}
      {element.type === "spinner" && <SpinnerWidget element={element} liveControls={liveControls} />}
      {element.type === "guidelines" && <GuidelinesWidget element={element} />}
      {element.type === "math" && <MathWidget element={element} />}
      {element.type === "base10" && <BaseTenWidget element={element} liveControls={liveControls} />}
      {element.type === "fraction" && <FractionWidget element={element} />}
      {element.type === "algorithm" && <AlgorithmWidget element={element} />}
      {element.type === "logic" && <LogicWidget element={element} />}
      {element.type === "grid" && <GridWidget element={element} />}
      {element.type === "table" && <TableWidget element={element} />}
      {element.type === "pictos" && <PictogramSequenceWidget element={element} liveControls={liveControls} />}
      {element.type === "drawing" && <DrawingWidget element={element} liveControls={liveControls} />}
      {element.type === "noise" && <NoiseWidget element={element} liveControls={liveControls} />}
      {element.type === "qr" && <QRWidget element={element} />}
      {element.type === "comment" && <CommentWidget element={element} />}
      {element.type === "connector" && <ConnectorWidget element={element} />}
      {element.type === "flow" && <FlowWidget element={element} />}
      {element.type === "hub" && <HubWidget element={element} liveControls={liveControls} guestMode={guestMode} />}
      {anchoredInk.length > 0 && (
        <Group clipX={0} clipY={0} clipWidth={element.width} clipHeight={element.height} listening={false}>
          {anchoredInk.map((item, index) => renderInkObject(item, `${element.id}-ink-${index}`))}
        </Group>
      )}
    </Group>
  );
}

// ── BoardCanvas ──────────────────────────────────────────────────────────────
// memo: evita que re-renders de App.tsx (saveState, _history, recording, etc.)
// se propaguen al canvas durante un drag y reseteen la posición del Stage.

export const BoardCanvas = memo(function BoardCanvas({
  board: boardProp, readonly = false, presentation = false, liveControls = !readonly, captureRef, guestMode = false
}: BoardCanvasProps) {
  // Si viene prop (AulaView/ShareView via SSE) se usa directamente.
  // En el editor (App.tsx no pasa board) se suscribe al store.
  const storeBoard = useBoardStore((s) => s.board);
  const board = boardProp ?? storeBoard;
  const updateBoard = useBoardStore((s) => s.updateBoard);
  const updateElement = useBoardStore((s) => s.updateElement);
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const selectedId = useBoardStore((s) => s.selectedId);
  const globalInkMode = useBoardStore((s) => s.globalInkMode);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const pinchRef = useRef<{ distance: number; center: { x: number; y: number }; scale: number; x: number; y: number } | null>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  // isDragging como ref (no estado) — oculta iframes durante drag sin provocar re-renders
  const overlayDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () =>
      stageRef.current?.toDataURL({ mimeType: "image/jpeg", quality: 0.82 }) ?? null;
    return () => { if (captureRef) captureRef.current = null; };
  }, [captureRef]);

  useEffect(() => {
    const showOverlays = () => {
      if (overlayDivRef.current) {
        overlayDivRef.current.style.opacity = "1";
        overlayDivRef.current.style.transition = "opacity 0.1s";
      }
    };
    window.addEventListener("mouseup", showOverlays);
    window.addEventListener("touchend", showOverlays);
    window.addEventListener("touchcancel", showOverlays);
    return () => {
      window.removeEventListener("mouseup", showOverlays);
      window.removeEventListener("touchend", showOverlays);
      window.removeEventListener("touchcancel", showOverlays);
    };
  }, []);

  const boardElements = board?.elements;
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (!selectedId) { tr.nodes([]); tr.getLayer()?.batchDraw(); return; }
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne("#" + selectedId);
    const el = boardElements?.find((e) => e.id === selectedId);
    if (node && el && !el.locked) { tr.nodes([node]); } else { tr.nodes([]); }
    tr.getLayer()?.batchDraw();
  }, [selectedId, boardElements]);

  if (!board) return null;

  const sortedElements = [...board.elements].sort((a, b) => a.zIndex - b.zIndex);
  const selectedInkAnchor = selectedId
    ? sortedElements.find((element) => element.id === selectedId && isInkContainerElement(element))
    : null;
  const inkAnchor = selectedInkAnchor
    ? {
        id: selectedInkAnchor.id,
        x: selectedInkAnchor.x,
        y: selectedInkAnchor.y,
        rotation: selectedInkAnchor.rotation
      }
    : null;
  const overlayShellStyle = (
    el: Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation" | "zIndex">
  ): CSSProperties => {
    const z = board.viewport.zoom;

    return {
      left: `${board.viewport.x + el.x * z}px`,
      top: `${board.viewport.y + el.y * z}px`,
      width: `${el.width * z}px`,
      height: `${el.height * z}px`,
      zIndex: el.zIndex,
      transform: `rotate(${el.rotation}deg)`,
      transformOrigin: "top left"
    };
  };

  const syncOverlayFrame = (
    el: BoardElement,
    frame: Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation">>
  ) => {
    if (!["iframe", "file", "hub"].includes(el.type)) return;
    const shell = overlayDivRef.current?.querySelector(`[data-overlay-id="${el.id}"]`) as HTMLElement | null;
    if (!shell) return;
    const next = { ...el, ...frame };
    const shellStyle = overlayShellStyle(next);
    shell.style.left = String(shellStyle.left);
    shell.style.top = String(shellStyle.top);
    shell.style.width = String(shellStyle.width);
    shell.style.height = String(shellStyle.height);
    shell.style.transform = String(shellStyle.transform);

    const iframe = shell.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe) return;
    const frameStyle = overlayFrameStyle(next);
    iframe.style.left = `${Number(frameStyle.left ?? 0)}px`;
    iframe.style.top = `${Number(frameStyle.top ?? 0)}px`;
    iframe.style.width = `${Number(frameStyle.width ?? 0)}px`;
    iframe.style.height = `${Number(frameStyle.height ?? 0)}px`;
  };

  const overlayFrameStyle = (el: Pick<BoardElement, "id" | "type" | "width" | "height">): CSSProperties => {
    const z = board.viewport.zoom;
    const isInteractive = el.type === "hub" || readonly || presentation || selectedId === el.id;
    const topHandle = !readonly && !presentation && isInteractive ? Math.min(el.type === "hub" ? 42 : 28, el.height * 0.18) : 0;
    const sideHandle = !readonly && !presentation && isInteractive ? Math.min(el.type === "hub" ? 18 : 12, el.width * 0.08) : 0;

    return {
      left: sideHandle * z,
      top: topHandle * z,
      width: Math.max(24, (el.width - sideHandle * 2) * z),
      height: Math.max(24, (el.height - topHandle - sideHandle) * z),
      pointerEvents: isInteractive ? "auto" : "none"
    };
  };

  const overlayClassName = (id: string) => {
    const el = board.elements.find((element) => element.id === id);
    const selected = selectedId === id;
    const interactive = el?.type === "hub" || readonly || presentation || selected;
    return [
      "embed-overlay",
      selected ? "is-selected" : "",
      interactive ? "is-interactive" : ""
    ].filter(Boolean).join(" ");
  };

  const onWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    if (readonly) return;
    event.evt.preventDefault();
    const stage = event.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mp = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const next = Math.min(4, Math.max(0.15, event.evt.deltaY > 0 ? oldScale / 1.04 : oldScale * 1.04));
    updateBoard({ viewport: { x: pointer.x - mp.x * next, y: pointer.y - mp.y * next, zoom: next } });
  };

  const onTouchMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (globalInkMode || (readonly && boardProp)) return;
    const touches = event.evt.touches;
    if (touches.length !== 2) return;
    event.evt.preventDefault();

    const stage = event.target.getStage();
    if (!stage) return;
    const [a, b] = [touches[0], touches[1]];
    const center = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    if (!pinchRef.current) {
      pinchRef.current = {
        distance,
        center,
        scale: stage.scaleX(),
        x: stage.x(),
        y: stage.y()
      };
      stage.draggable(false);
      return;
    }

    const start = pinchRef.current;
    const next = Math.min(4, Math.max(0.15, start.scale * (distance / start.distance)));
    const boardPoint = {
      x: (start.center.x - start.x) / start.scale,
      y: (start.center.y - start.y) / start.scale
    };
    updateBoard({
      viewport: {
        x: center.x - boardPoint.x * next,
        y: center.y - boardPoint.y * next,
        zoom: next
      }
    });
  };

  const endTouchGesture = () => {
    pinchRef.current = null;
    stageRef.current?.draggable(!readonly && !globalInkMode);
  };

  return (
    <div className={`canvas-shell ${presentation ? "is-presentation" : ""} ${globalInkMode ? "ink-mode" : ""}`}>
      {/* Stage sin setIsDragging en onMouseDown: evita el re-render que causaba
          snap-back. Los overlays se controlan de forma imperativa (ref DOM). */}
      <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
        x={board.viewport.x} y={board.viewport.y}
        scaleX={board.viewport.zoom} scaleY={board.viewport.zoom}
        draggable={!readonly && !globalInkMode} onWheel={globalInkMode ? undefined : onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={endTouchGesture}
        onTouchCancel={endTouchGesture}
        onDragStart={(e) => {
          if (e.target === e.target.getStage() && overlayDivRef.current) {
            overlayDivRef.current.style.opacity = "0";
            overlayDivRef.current.style.transition = "none";
          }
        }}
        onClick={(e) => { if (e.target === e.target.getStage() && !readonly) setSelectedId(null); }}
        onTap={(e) => { if (e.target === e.target.getStage() && !readonly) setSelectedId(null); }}
        onDragEnd={(e) => {
          if (overlayDivRef.current) {
            overlayDivRef.current.style.opacity = "1";
            overlayDivRef.current.style.transition = "opacity 0.1s";
          }
          if (!readonly && e.target === e.target.getStage()) {
            updateBoard({ viewport: { x: e.target.x(), y: e.target.y(), zoom: board.viewport.zoom } });
          }
        }}
      >
        <Layer>
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill="rgba(250,248,244,0.01)" listening={false} />
          {sortedElements.map((el) => (
            <ElementNode key={el.id} element={el} readonly={readonly} liveControls={liveControls}
              onLongPress={(id) => setSelectedId(id)} guestMode={guestMode}
              onLiveFrameChange={syncOverlayFrame}
              anchoredInk={(board.ink ?? []).filter((item) => item.anchorElementId === el.id)} />
          ))}
          {!readonly && (
            <Transformer ref={trRef} keepRatio={false} rotateEnabled
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              anchorSize={14} anchorCornerRadius={4}
              anchorStroke="#c45d3e" anchorFill="#ffffff" anchorStrokeWidth={2}
              borderStroke="#c45d3e" borderDash={[6, 4]} borderStrokeWidth={2}
              onTransform={(e) => {
                const node = e.target;
                const id = node.id();
                const el = useBoardStore.getState().board?.elements.find((item) => item.id === id);
                if (!el) return;
                syncOverlayFrame(el, {
                  x: node.x(),
                  y: node.y(),
                  width: Math.max(40, Math.round(el.width * node.scaleX())),
                  height: Math.max(40, Math.round(el.height * node.scaleY())),
                  rotation: node.rotation()
                });
              }}
              onTransformEnd={(e) => {
                const node = e.target;
                const id = node.id();
                const sx = node.scaleX(), sy = node.scaleY();
                node.scaleX(1); node.scaleY(1);
                const el = useBoardStore.getState().board?.elements.find((el) => el.id === id);
                if (!el) return;
                updateElement(id, {
                  x: node.x(), y: node.y(),
                  width: Math.max(40, Math.round(el.width * sx)),
                  height: Math.max(40, Math.round(el.height * sy)),
                  rotation: node.rotation()
                });
              }}
            />
          )}
        </Layer>

        {/* Capa de tinta global persistente — se monta sobre todos los elementos del board */}
        {((board.ink?.length ?? 0) > 0 || (globalInkMode && !readonly)) && (
          <GlobalInkLayer
            active={globalInkMode && !readonly}
            objects={boardProp ? (board.ink ?? []) : undefined}
            anchor={globalInkMode && !readonly ? inkAnchor : null}
          />
        )}
      </Stage>

      {/* Overlays controlados imperativamente durante drag para evitar re-renders */}
      <div ref={overlayDivRef} className="iframe-overlays"
        style={{ opacity: 1, transition: "opacity 0.1s" }}>
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "iframe" }> => e.type === "iframe")
          .filter((e) => isAllowedEmbedUrl(e.data.url))
          .map((el) => (
            <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
              <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
              <iframe data-board-element-id={el.id} title={el.data.title} src={el.data.url}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                style={overlayFrameStyle(el)} />
            </div>
          ))}
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "file" }> => e.type === "file")
          .filter((e) => e.data.kind === "pdf")
          .map((el) => (
            <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
              <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
              <iframe data-board-element-id={el.id} title={el.data.name} src={el.data.url}
                style={overlayFrameStyle(el)} />
            </div>
          ))}
        {/* Hub widgets en modo embed → iframe de la app EDUmind.
            En guestMode usa guestUrl para acceso sin cuenta EDUmind. */}
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "hub" }> => e.type === "hub" && e.data.mode === "embed")
          .map((el) => {
            const app = getHubApp(el.data.appId);
            if (!app) return null;
            const hubSrc = withEmbedParams((guestMode && app.guestUrl) ? app.guestUrl : app.url);
            return (
              <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
                <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
                <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
                <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
                <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
                <iframe data-board-element-id={el.id} title={app.name} src={hubSrc}
                  allow="camera; microphone; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                  style={overlayFrameStyle(el)} />
              </div>
            );
          })}
      </div>
    </div>
  );
});
