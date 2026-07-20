// Medidor de ruido de aula (micrófono, actualización imperativa).
import { useEffect, useRef, useState } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { BoardElement } from "@edumind-board/shared";

export function NoiseWidget({
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
