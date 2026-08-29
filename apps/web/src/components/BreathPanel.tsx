// Panel de Breath: elegir estrategia de respiración y cómo llevarla al tablero.
//
// Antes Breath solo aparecía dentro del App Hub o de la plantilla de calma, y
// siempre con la misma respiración cuadrada sin posibilidad de tocar nada.
import { useState } from "react";
import { ExternalLink, Wind, X } from "lucide-react";
import {
  ESTRATEGIAS_BREATH,
  tituloBreath,
  urlBreath,
  type EstrategiaBreath,
  type ModoBreath
} from "../lib/breath";

const MODOS: Array<{ id: ModoBreath; etiqueta: string; ayuda: string }> = [
  { id: "guiada", etiqueta: "Guiada", ayuda: "Solo la figura respirando. Nada que tocar delante de la clase." },
  { id: "ajustable", etiqueta: "Ajustable", ayuda: "La estrategia elegida, con los controles a mano para cambiarla en vivo." },
  { id: "completa", etiqueta: "App completa", ayuda: "Breath entero: apoyos sensoriales, idioma, reto y estadísticas." }
];

export function BreathPanel({
  onInsert,
  onClose
}: {
  onInsert: (url: string, titulo: string) => void;
  onClose: () => void;
}) {
  const [estrategiaId, setEstrategiaId] = useState(ESTRATEGIAS_BREATH[0].id);
  const [modo, setModo] = useState<ModoBreath>("guiada");
  const [autoplay, setAutoplay] = useState(false);
  // 0 = sin límite. Con un número, Breath se detiene solo al completarlo, que
  // en una transición de aula vale más que dejarlo corriendo.
  const [rondas, setRondas] = useState(0);

  const estrategia: EstrategiaBreath =
    ESTRATEGIAS_BREATH.find((e) => e.id === estrategiaId) ?? ESTRATEGIAS_BREATH[0];
  const usaEstrategia = modo !== "completa";
  const url = urlBreath(usaEstrategia ? estrategia : null, modo, autoplay, rondas);
  const ayudaModo = MODOS.find((m) => m.id === modo)?.ayuda ?? "";

  return (
    <div className="tool-palette breath-panel" role="dialog" aria-label="Respiración guiada">
      <div className="breath-header">
        <div className="tool-palette-title"><Wind size={16} /> Respirar</div>
        <button type="button" className="icon-only" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>
      <p className="breath-sub">
        Elige la estrategia según lo que necesite el grupo. Las cuatro primeras son ciclos
        con respaldo en la literatura; las dos últimas, figuras regulares más fáciles de seguir.
      </p>

      <section>
        <div className="tool-palette-title">Estrategia</div>
        <div className="breath-estrategias">
          {ESTRATEGIAS_BREATH.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`breath-estrategia${item.id === estrategiaId ? " is-active" : ""}`}
              aria-pressed={item.id === estrategiaId}
              disabled={!usaEstrategia}
              onClick={() => setEstrategiaId(item.id)}
            >
              <strong>{item.nombre}</strong>
              <small>{item.cuando}</small>
            </button>
          ))}
        </div>
        {usaEstrategia && <p className="breath-desc">{estrategia.descripcion}</p>}
      </section>

      <section>
        <div className="tool-palette-title">Cómo ponerla</div>
        <div className="breath-modos" role="group" aria-label="Modo de Breath">
          {MODOS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`breath-modo${modo === item.id ? " is-active" : ""}`}
              aria-pressed={modo === item.id}
              onClick={() => setModo(item.id)}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
        <p className="breath-desc">{ayudaModo}</p>
        <label className="breath-auto">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          Empezar en marcha
        </label>
        <label className="breath-auto">
          Parar tras
          <input
            type="number"
            min={0}
            max={60}
            value={rondas}
            onChange={(e) => setRondas(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
          />
          rondas {rondas === 0 && <small>(0 = sin límite)</small>}
        </label>
      </section>

      <div className="breath-actions">
        <button type="button" className="primary" onClick={() => { onInsert(url, tituloBreath(usaEstrategia ? estrategia : null, modo)); onClose(); }}>
          Poner en el tablero
        </button>
        <a className="breath-open" href={url} target="_blank" rel="noopener noreferrer">
          Abrir aparte <ExternalLink size={12} />
        </a>
      </div>

      <p className="breath-note">
        Breath es una app de EDUmind y se sirve desde el mismo dominio: no sale ningún dato
        del aula hacia terceros.
      </p>
    </div>
  );
}
