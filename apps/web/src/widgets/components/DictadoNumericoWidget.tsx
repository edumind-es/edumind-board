// Dictado numérico: el board muestra un número en una representación aleatoria
// entre las que el docente habilita (cifra, letra, romano, ordinal, base 10).
// El alumnado lo lee/escribe; "Siguiente" sortea otro; "Respuesta" lo revela.
import { Group, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";
import {
  FORMA_ETIQUETA,
  descomposicionBase10,
  representar,
  siguienteReto
} from "../../lib/dictados";

type Element = Extract<BoardElement, { type: "dictadoNum" }>;

const BASE10_COLORS = { millares: "#e75f3c", centenas: "#38bdf8", decenas: "#22a06b", unidades: "#f3c969" };

// Representación en base 10 dibujada: millares/centenas (cuadrados), decenas
// (barras) y unidades (cuadraditos), agrupadas y etiquetadas.
function Base10View({ value, x, y, width }: { value: number; x: number; y: number; width: number }) {
  const { millares, centenas, decenas, unidades } = descomposicionBase10(value);
  type Kind = "big" | "bar" | "small";
  const groups: Array<{ label: string; count: number; color: string; kind: Kind }> = [
    { label: "UM", count: millares, color: BASE10_COLORS.millares, kind: "big" as Kind },
    { label: "C", count: centenas, color: BASE10_COLORS.centenas, kind: "big" as Kind },
    { label: "D", count: decenas, color: BASE10_COLORS.decenas, kind: "bar" as Kind },
    { label: "U", count: unidades, color: BASE10_COLORS.unidades, kind: "small" as Kind }
  ].filter((g) => g.count > 0);
  if (groups.length === 0) groups.push({ label: "U", count: 0, color: BASE10_COLORS.unidades, kind: "small" });

  const colW = Math.min(120, (width - 20) / groups.length);
  return (
    <Group x={x} y={y}>
      {groups.map((g, gi) => {
        const gx = gi * colW + (colW - 44) / 2;
        const pieces = [];
        for (let i = 0; i < Math.min(g.count, 9); i++) {
          const py = 70 - i * (g.kind === "bar" ? 9 : g.kind === "big" ? 16 : 10);
          if (g.kind === "big") pieces.push(<Rect key={i} x={0} y={py - 14} width={30} height={30} fill={g.color} stroke="#1e293b" strokeWidth={1} cornerRadius={2} opacity={0.85} />);
          else if (g.kind === "bar") pieces.push(<Rect key={i} x={2} y={py} width={26} height={7} fill={g.color} stroke="#1e293b" strokeWidth={0.8} cornerRadius={1} opacity={0.85} />);
          else pieces.push(<Rect key={i} x={9} y={py} width={12} height={12} fill={g.color} stroke="#1e293b" strokeWidth={0.8} cornerRadius={1} opacity={0.85} />);
        }
        return (
          <Group key={g.label} x={gx}>
            {pieces}
            <Rect x={-4} y={80} width={38} height={22} fill="#fff" stroke={g.color} strokeWidth={1.4} cornerRadius={6} />
            <Text text={`${g.count}${g.label}`} x={-4} y={84} width={38} align="center" fill={g.color} fontSize={13} fontStyle="bold" />
          </Group>
        );
      })}
    </Group>
  );
}

export function DictadoNumericoWidget({ element, liveControls }: { element: Element; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const { width, height } = element;
  const { current, form, showAnswer, forms, min, max, accent } = element.data;
  const pad = 18;

  function next() {
    const reto = siguienteReto(min, max, forms);
    updateElementData(element.id, { ...reto, showAnswer: false });
  }
  function toggleAnswer() {
    updateElementData(element.id, { showAnswer: !showAnswer });
  }

  const btnH = Math.max(30, Math.min(44, height * 0.12));
  const btnY = height - btnH - pad;
  const contentTop = pad + 34;
  const contentH = btnY - contentTop - 12;
  const contentCy = contentTop + contentH / 2;

  const bigFont = form === "letra"
    ? Math.max(20, Math.min(46, width / 11))
    : Math.max(34, Math.min(120, height * 0.34));

  return (
    <>
      <Rect width={width} height={height} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1.4} cornerRadius={12} />
      <Rect width={width} height={5} fill={accent} cornerRadius={12} />
      <Text text="Dictado numérico" x={pad} y={pad} width={width - pad * 2} fill="#22302f" fontSize={18} fontStyle="bold" />

      {form === "base10" ? (
        <Base10View value={current} x={pad} y={contentCy - 60} width={width - pad * 2} />
      ) : (
        <Text text={representar(current, form)} x={pad} y={contentCy - bigFont * 0.6}
          width={width - pad * 2} align="center" verticalAlign="middle"
          fill={accent} fontSize={bigFont} fontStyle="bold" lineHeight={1.1} wrap="word" />
      )}

      {showAnswer && (
        <Text text={`= ${current}  ·  ${FORMA_ETIQUETA[form]}`} x={pad} y={btnY - 30}
          width={width - pad * 2} align="center" fill="#2a7a6d" fontSize={Math.max(13, Math.min(20, width / 26))} fontStyle="bold" />
      )}

      {liveControls && (
        <>
          <Group x={pad} y={btnY}
            onClick={(e) => { e.cancelBubble = true; next(); }}
            onTap={(e) => { e.cancelBubble = true; next(); }}>
            <Rect width={(width - pad * 2) * 0.56 - 6} height={btnH} fill={accent} cornerRadius={8} />
            <Text text="Siguiente ▶" y={(btnH - 15) / 2} width={(width - pad * 2) * 0.56 - 6} align="center" fill="#fff" fontSize={15} fontStyle="bold" />
          </Group>
          <Group x={pad + (width - pad * 2) * 0.56 + 6} y={btnY}
            onClick={(e) => { e.cancelBubble = true; toggleAnswer(); }}
            onTap={(e) => { e.cancelBubble = true; toggleAnswer(); }}>
            <Rect width={(width - pad * 2) * 0.44 - 6} height={btnH} fill="#ffffff" stroke={accent} strokeWidth={1.5} cornerRadius={8} />
            <Text text={showAnswer ? "Ocultar" : "Respuesta"} y={(btnH - 14) / 2} width={(width - pad * 2) * 0.44 - 6} align="center" fill={accent} fontSize={14} fontStyle="bold" />
          </Group>
        </>
      )}
    </>
  );
}
