// Medidor de ruido de aula: escalera vertical de niveles de voz.
//
// El alumnado no lee porcentajes: lee en qué escalón está su voz. Por eso el
// medidor es una escalera de 6 peldaños (0 silencio de biblioteca … 5 voz de
// patio) que se ilumina de abajo arriba. El docente fija el límite y el widget
// cuenta cuántas veces se ha pasado la clase de ahí.
import { useEffect, useRef, useState } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { BoardElement } from "@edumind-board/shared";

import { NIVELES_VOZ, nivelDesdeVolumen } from "../../lib/nivelesVoz";

// Cuánto hay que pasarse del límite para que cuente como aviso, y cuánto hay
// que volver a bajar para que el aviso se dé por cerrado. Sin esto, un portazo
// dispararía diez avisos seguidos.
const MS_PARA_AVISAR = 1200;
const MS_PARA_CALMARSE = 2000;

export function NoiseWidget({
  element,
  liveControls
}: {
  element: Extract<BoardElement, { type: "noise" }>;
  liveControls: boolean;
}) {
  const barraRef = useRef<Konva.Rect>(null);
  const escalonesRef = useRef<(Konva.Rect | null)[]>([]);
  const estadoTextRef = useRef<Konva.Text>(null);
  const [active, setActive] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [avisos, setAvisos] = useState(0);
  const activeRef = useRef(false);

  const limite = element.data.limite;

  // ── Geometría (todo proporcional: el widget se puede redimensionar) ──────
  const P = 12;
  const tituloH = 26;
  const pieH = 30;
  const areaY = tituloH + 20;
  const areaH = Math.max(60, element.height - areaY - pieH - P);
  const hueco = 4;
  const pasoH = (areaH - hueco * 5) / 6;
  const barW = 12;
  const escX = P + barW + 8;
  const escW = Math.max(40, element.width - escX - P);
  const fuente = Math.max(9, Math.min(15, Math.floor(pasoH * 0.5)));
  // El escalón 0 va abajo del todo; el 5, arriba.
  const yDeNivel = (n: number) => areaY + (5 - n) * (pasoH + hueco);
  const yLimite = yDeNivel(limite) - hueco / 2;

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
        analyser.fftSize = 1024;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        let suave = 0;
        let nivel = 0;
        let excedeDesde = 0;
        let calmadoDesde = 0;
        let enAviso = false;

        function tick() {
          if (!activeRef.current) return;

          // Volumen real (RMS en dB), no la media del espectro: así el paso de
          // "susurro" a "voz normal" se parece a lo que oye el oído.
          analyser.getByteTimeDomainData(data);
          let suma = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i]! - 128) / 128;
            suma += v * v;
          }
          const db = 20 * Math.log10(Math.sqrt(suma / data.length) + 1e-7);
          const crudo = Math.max(0, Math.min(100, ((db + 65) / 45) * 100));
          // Sube rápido (reacciona al jaleo) y baja despacio (no parpadea).
          suave += (crudo - suave) * (crudo > suave ? 0.35 : 0.08);

          nivel = nivelDesdeVolumen(suave, nivel);
          const pasado = nivel > limite;

          // Barra continua
          if (barraRef.current) {
            const alto = Math.round((areaH * suave) / 100);
            barraRef.current.y(areaY + areaH - alto);
            barraRef.current.height(alto);
            barraRef.current.fill(NIVELES_VOZ[nivel]!.color);
          }
          // Escalones: sólo se encienden los alcanzados
          for (let n = 0; n <= 5; n++) {
            const rect = escalonesRef.current[n];
            if (!rect) continue;
            const encendido = n <= nivel;
            rect.fill(encendido ? NIVELES_VOZ[n]!.color : "#33403f");
            rect.opacity(encendido ? 1 : 0.55);
            rect.stroke(n === nivel ? "#fffaf0" : "transparent");
          }
          if (estadoTextRef.current) {
            estadoTextRef.current.text(pasado ? "¡Baja la voz!" : NIVELES_VOZ[nivel]!.nombre);
            estadoTextRef.current.fill(pasado ? "#ffd2cc" : "#fffaf0");
          }

          // Contador de avisos
          const ahora = performance.now();
          if (pasado) {
            calmadoDesde = 0;
            if (!excedeDesde) excedeDesde = ahora;
            if (!enAviso && ahora - excedeDesde >= MS_PARA_AVISAR) {
              enAviso = true;
              setAvisos((n) => n + 1);
            }
          } else {
            excedeDesde = 0;
            if (enAviso) {
              if (!calmadoDesde) calmadoDesde = ahora;
              else if (ahora - calmadoDesde >= MS_PARA_CALMARSE) { enAviso = false; calmadoDesde = 0; }
            }
          }

          barraRef.current?.getLayer()?.batchDraw();
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
  }, [active, liveControls, limite, areaH, areaY]);

  return (
    <>
      <Rect width={element.width} height={element.height} fill="#22302f" cornerRadius={14} />
      <Text text={element.data.label} y={10} width={element.width}
        align="center" fill="#fffaf0" fontSize={15} fontStyle="bold" />
      <Text ref={estadoTextRef}
        text={active ? NIVELES_VOZ[0]!.nombre : (permDenied ? "Sin micrófono" : "Toca para activar")}
        y={tituloH + 2} width={element.width} align="center"
        fill={active ? "#fffaf0" : "#a8a49c"} fontSize={13} />

      {/* Barra continua: el detalle fino entre escalón y escalón */}
      <Rect x={P} y={areaY} width={barW} height={areaH} fill="#33403f" cornerRadius={6} />
      <Rect ref={barraRef} x={P} y={areaY + areaH} width={barW} height={0}
        fill={NIVELES_VOZ[0]!.color} cornerRadius={6} />

      {/* La escalera de niveles de voz */}
      {NIVELES_VOZ.map((n) => (
        <Group key={n.nivel} x={escX} y={yDeNivel(n.nivel)}>
          <Rect ref={(r) => { escalonesRef.current[n.nivel] = r; }}
            width={escW} height={pasoH} cornerRadius={6}
            fill="#33403f" opacity={0.55} strokeWidth={2} stroke="transparent" />
          <Text text={`${n.nivel}`} x={8} height={pasoH} verticalAlign="middle"
            fill="#fffaf0" fontSize={fuente} fontStyle="bold" />
          <Text text={n.nombre} x={26} height={pasoH} verticalAlign="middle"
            fill="#fffaf0" fontSize={fuente} />
          {escW > 150 && (
            <Text text={n.ejemplo} width={escW - 10} height={pasoH} align="right"
              verticalAlign="middle" fill="#fffaf0" opacity={0.7} fontSize={fuente - 2} />
          )}
        </Group>
      ))}

      {/* Límite fijado por el docente */}
      <Line points={[P, yLimite, element.width - P, yLimite]}
        stroke="#fffaf0" strokeWidth={2} dash={[5, 3]} />
      <Text text="límite" x={escX} y={yLimite - fuente - 2} width={escW} align="right"
        fill="#fffaf0" opacity={0.8} fontSize={Math.max(8, fuente - 3)} />

      {/* Pie: avisos y botón */}
      <Text text={`Avisos: ${avisos}`} x={P} y={element.height - 24}
        fill="#fffaf0" opacity={0.85} fontSize={13} />
      {liveControls && (
        <Group x={element.width - 96} y={element.height - 30}
          onClick={(e) => { e.cancelBubble = true; setAvisos(0); }}
          onTap={(e) => { e.cancelBubble = true; setAvisos(0); }}>
          <Rect width={40} height={22} fill="#3a4a49" cornerRadius={6} />
          <Text text="0" y={4} width={40} align="center" fill="#fffaf0" fontSize={12} />
        </Group>
      )}
      {liveControls && !permDenied && (
        <Group x={element.width - 52} y={element.height - 30}
          onClick={(e) => { e.cancelBubble = true; setActive((a) => !a); }}
          onTap={(e) => { e.cancelBubble = true; setActive((a) => !a); }}>
          <Rect width={40} height={22} fill={active ? "#d94b3d" : "#2a7a6d"} cornerRadius={6} />
          <Text text={active ? "■" : "▶"} y={4} width={40} align="center" fill="#fff" fontSize={12} />
        </Group>
      )}
    </>
  );
}
