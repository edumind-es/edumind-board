// Conexión rápida: tiradores alrededor del elemento seleccionado desde los que
// se arrastra hasta otro elemento para crear una flecha ya colocada y anclada.
//
// Por qué existe: para unir dos cajas había que añadir el widget «Flecha» y
// encajarlo a mano entre ellas. Con una pizarra táctil delante de la clase eso
// no se hace. Aquí se busca la agilidad de MindNode: tirar y soltar.
//
// Vive como capa HTML sobre el Stage (no dentro de Konva) porque los eventos de
// puntero con captura son mucho más fiables en el DOM, sobre todo en táctil.
import { useRef, useState } from "react";
import type { BoardDocument, BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { elementoEnPunto, esAnclable, puntoEnBorde, type Punto } from "../lib/conectores";

type Lado = "arriba" | "derecha" | "abajo" | "izquierda";

const LADOS: Array<{ id: Lado; nx: number; ny: number }> = [
  { id: "arriba", nx: 0.5, ny: 0 },
  { id: "derecha", nx: 1, ny: 0.5 },
  { id: "abajo", nx: 0.5, ny: 1 },
  { id: "izquierda", nx: 0, ny: 0.5 }
];

type Props = {
  board: BoardDocument;
  /** Elemento sobre el que se pintan los tiradores. */
  element: BoardElement;
};

export function ConexionRapida({ board, element }: Props) {
  const conectarElementos = useBoardStore((s) => s.conectarElementos);
  const capaRef = useRef<HTMLDivElement>(null);
  const [trazo, setTrazo] = useState<{ desde: Punto; hasta: Punto } | null>(null);
  const [destacado, setDestacado] = useState<string | null>(null);

  if (!esAnclable(element)) return null;

  const z = board.viewport.zoom;
  const aPantalla = (p: Punto): Punto => ({
    x: board.viewport.x + p.x * z,
    y: board.viewport.y + p.y * z
  });
  const aTablero = (clientX: number, clientY: number): Punto => {
    const caja = capaRef.current?.getBoundingClientRect();
    const px = clientX - (caja?.left ?? 0);
    const py = clientY - (caja?.top ?? 0);
    return { x: (px - board.viewport.x) / z, y: (py - board.viewport.y) / z };
  };

  function iniciar(evento: React.PointerEvent, lado: { nx: number; ny: number }) {
    evento.stopPropagation();
    evento.preventDefault();
    (evento.currentTarget as Element).setPointerCapture(evento.pointerId);
    const origen = {
      x: element.x + element.width * lado.nx,
      y: element.y + element.height * lado.ny
    };
    setTrazo({ desde: origen, hasta: origen });
  }

  function mover(evento: React.PointerEvent) {
    if (!trazo) return;
    const punto = aTablero(evento.clientX, evento.clientY);
    setTrazo({ desde: trazo.desde, hasta: punto });
    const bajo = elementoEnPunto(board.elements, punto, element.id);
    setDestacado(bajo?.id ?? null);
  }

  function soltar(evento: React.PointerEvent) {
    if (!trazo) return;
    const punto = aTablero(evento.clientX, evento.clientY);
    const destino = elementoEnPunto(board.elements, punto, element.id);
    setTrazo(null);
    setDestacado(null);
    if (destino) conectarElementos(element.id, destino.id);
  }

  const objetivo = destacado ? board.elements.find((e) => e.id === destacado) : undefined;

  // El extremo del trazo se pega al borde del destino en cuanto hay uno, para
  // que se vea a dónde va a quedar la flecha antes de soltar.
  const finTrazo = trazo
    ? objetivo
      ? puntoEnBorde(objetivo, trazo.desde, 6)
      : trazo.hasta
    : null;

  return (
    <div ref={capaRef} className="conexion-rapida-capa">
      {trazo && finTrazo && (
        <svg className="conexion-rapida-trazo" aria-hidden="true">
          <line
            x1={aPantalla(trazo.desde).x} y1={aPantalla(trazo.desde).y}
            x2={aPantalla(finTrazo).x} y2={aPantalla(finTrazo).y}
            stroke="#1a5fa8" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round"
          />
        </svg>
      )}

      {objetivo && (
        <div
          className="conexion-rapida-destino"
          style={{
            left: `${aPantalla(objetivo).x}px`,
            top: `${aPantalla(objetivo).y}px`,
            width: `${objetivo.width * z}px`,
            height: `${objetivo.height * z}px`
          }}
        />
      )}

      {LADOS.map((lado) => {
        const punto = aPantalla({
          x: element.x + element.width * lado.nx,
          y: element.y + element.height * lado.ny
        });
        return (
          <button
            key={lado.id}
            type="button"
            className={`conexion-rapida-tirador ${trazo ? "is-activo" : ""}`}
            style={{ left: `${punto.x}px`, top: `${punto.y}px` }}
            title="Arrastra hasta otro elemento para unirlos con una flecha"
            aria-label={`Conectar por ${lado.id}`}
            onPointerDown={(e) => iniciar(e, lado)}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={() => { setTrazo(null); setDestacado(null); }}
          />
        );
      })}
    </div>
  );
}
