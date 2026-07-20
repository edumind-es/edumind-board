// Temporizador de aula con countdown en estado local.
import { useEffect, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";
import { formatSeconds } from "./shared";

export function TimerWidget({
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
