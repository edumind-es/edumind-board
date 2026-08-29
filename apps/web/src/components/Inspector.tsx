import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Lock, Trash2, Unlock } from "lucide-react";
import { isAllowedEmbedUrl, type BoardElement } from "@edumind-board/shared";
import { searchArasaac as searchArasaacApi, type ArasaacPictogram } from "../lib/api";
import { useBoardStore } from "../lib/store";
import { HUB_APPS } from "../lib/hubApps";
import { newId } from "../lib/ids";
import { confirmDialog } from "./ui/feedback";

function fieldValue(element: BoardElement, key: string) {
  const value = (element.data as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function estimateNoteHeight(text: string, widthPx: number, fontSize: number): number {
  const innerWidth = widthPx - 36;
  const charsPerLine = Math.max(1, Math.floor(innerWidth / (fontSize * 0.52)));
  const lines = text.split("\n").reduce((c, l) => c + Math.max(1, Math.ceil((l.length || 0.1) / charsPerLine)), 0);
  return Math.max(80, Math.ceil(lines * fontSize * 1.25) + 44);
}

function createBase10InspectorPieces(data: Extract<BoardElement, { type: "base10" }>["data"], width: number) {
  const unit = Math.max(12, Math.min(18, width / 44));
  const depthX = unit * 0.34;
  const depthY = unit * 0.28;
  const metrics = (kind: "unit" | "rod" | "flat" | "cube") => ({
    unit: { width: unit + depthX, height: unit + depthY },
    rod: { width: unit * 10 + unit * 0.95, height: unit * 1.7 },
    flat: { width: unit * 10.8, height: unit * 10.6 },
    cube: { width: unit * 10, height: unit * 10 }
  }[kind]);
  const pieces: Extract<BoardElement, { type: "base10" }>["data"]["pieces"] = [];
  let cursorX = 24;
  let cursorY = 88;
  const groups = [
    { kind: "cube" as const, count: data.cubeCount },
    { kind: "flat" as const, count: data.flatCount },
    { kind: "rod" as const, count: data.rodCount },
    { kind: "unit" as const, count: data.unitCount }
  ];

  for (const group of groups) {
    const size = metrics(group.kind);
    for (let index = 0; index < group.count; index += 1) {
      pieces.push({ id: newId(), kind: group.kind, x: cursorX, y: cursorY });
      cursorX += size.width + 16;
      if (cursorX > width - Math.max(120, size.width + 28)) {
        cursorX = 24;
        cursorY += size.height + 18;
      }
    }
    cursorX = 24;
    cursorY += size.height + 26;
  }
  return pieces.slice(0, 300);
}

export function Inspector() {
  const board = useBoardStore((s) => s.board);
  const selectedId = useBoardStore((s) => s.selectedId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const removeSelected = useBoardStore((s) => s.removeSelected);
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected);
  const bringToFront = useBoardStore((s) => s.bringToFront);
  const sendToBack = useBoardStore((s) => s.sendToBack);
  const [pictoQuery, setPictoQuery] = useState("");
  const [pictoResults, setPictoResults] = useState<ArasaacPictogram[]>([]);
  const [pictoLoading, setPictoLoading] = useState(false);
  const [pictoError, setPictoError] = useState<string | null>(null);

  const element = board?.elements.find((item) => item.id === selectedId);

  if (!element) {
    return (
      <aside className="inspector">
        <p className="inspector-hint">Selecciona un elemento para editar su contenido.</p>
      </aside>
    );
  }

  const typeLabel: Record<BoardElement["type"], string> = {
    note: "Nota", text: "Texto", image: "Imagen", file: "Archivo",
    iframe: "Web", musica: "Música", timer: "Temporizador", semaphore: "Semáforo",
    clock: "Reloj", dice: "Dado", spinner: "Ruleta",
    guidelines: "Pauta escritura", math: "Matemáticas", base10: "Base 10", mates3d: "Mates 3D", mindmap: "Mapa mental", dictadoNum: "Dictado numérico",
    fraction: "Fracciones", algorithm: "Algoritmo", logic: "Lógica matemática",
    grid: "Cuadrícula", table: "Tabla",
    comment: "Comentario",
    connector: "Conector",
    flow: "Diagrama de flujo",
    pictos: "Pictogramas ARASAAC",
    drawing: "Lienzo libre", noise: "Ruido", qr: "Código QR", hub: "App EDUmind"
  };

  const noteFontSize = Math.max(10, Math.min(60, Math.round(element.height / 8)));
  const fixAsBackground = () => {
    sendToBack(element.id);
    updateElement(element.id, { locked: true });
  };
  const searchArasaac = async () => {
    const query = pictoQuery.trim();
    if (!query) return;
    setPictoLoading(true);
    setPictoError(null);
    try {
      const payload = await searchArasaacApi(query);
      setPictoResults(payload.results);
      if (payload.stale) {
        setPictoError("Mostrando resultados guardados: ARASAAC no respondió ahora mismo.");
      }
    } catch {
      setPictoError("No se pudo consultar el catálogo ARASAAC ni hay resultados guardados para esa búsqueda.");
    } finally {
      setPictoLoading(false);
    }
  };

  return (
    <aside className="inspector">
      <p className="inspector-type">{typeLabel[element.type] ?? element.type}</p>

      {/* Barra de acciones — estable, sin cálculos de posición */}
      <div className="inspector-actions">
        <button type="button" className="icon-only"
          title={element.locked ? "Desbloquear" : "Bloquear posición"}
          onClick={() => updateElement(element.id, { locked: !element.locked })}>
          {element.locked ? <Unlock size={15} /> : <Lock size={15} />}
        </button>
        <button type="button" className="icon-only" title="Duplicar" onClick={duplicateSelected}>
          <Copy size={15} />
        </button>
        <button type="button" className="icon-only" title="Traer al frente" onClick={() => bringToFront(element.id)}>
          <ArrowUp size={15} />
        </button>
        <button type="button" className="icon-only" title="Enviar al fondo" onClick={() => sendToBack(element.id)}>
          <ArrowDown size={15} />
        </button>
        <button type="button" className="icon-only inspector-delete" title="Eliminar elemento" onClick={removeSelected}>
          <Trash2 size={15} />
        </button>
      </div>

      {/* ── Campos por tipo ───────────────────────────────────────────────── */}

      {(element.type === "note" || element.type === "text") && (
        <label>
          Contenido
          <textarea value={fieldValue(element, "text")} onChange={(e) => {
            const t = e.target.value;
            if (element.type === "note") updateElement(element.id, { height: estimateNoteHeight(t, element.width, noteFontSize) });
            updateElementData(element.id, { text: t });
          }} />
        </label>
      )}

      {element.type === "note" && (
        <label>
          Color de fondo
          <div className="color-row">
            {["#fff9c4", "#ffd6cc", "#d4edda", "#cce5ff", "#f3e5f5", "#fffaf0"].map((color) => (
              <button key={color} type="button"
                className={`color-swatch ${fieldValue(element, "color") === color ? "active" : ""}`}
                style={{ background: color }} title={color}
                onClick={() => updateElementData(element.id, { color })} />
            ))}
          </div>
        </label>
      )}

      {element.type === "text" && (
        <label>
          Tamaño de texto
          <input type="range" min={12} max={96}
            value={Number(fieldValue(element, "fontSize")) || 28}
            onChange={(e) => updateElementData(element.id, { fontSize: Number(e.target.value) })} />
          <span className="range-value">{fieldValue(element, "fontSize") || 28}px</span>
        </label>
      )}

      {element.type === "iframe" && (
        <>
          <label>Título <input value={fieldValue(element, "title")} onChange={(e) => updateElementData(element.id, { title: e.target.value })} /></label>
          <label>URL <input value={fieldValue(element, "url")} onChange={(e) => updateElementData(element.id, { url: e.target.value })} placeholder="https://..." /></label>
          {!isAllowedEmbedUrl(fieldValue(element, "url")) && fieldValue(element, "url") && (
            <p className="warning">Dominio no permitido para publicar. Usa plataformas admitidas como PhET, YouTube, Vimeo, Canva, SoundCloud, editoriales permitidas, dominios EDUmind y entornos educativos oficiales de consejerías.</p>
          )}
          <label>
            Cómo mostrarlo
            <select value={element.data.mode} onChange={(e) => updateElementData(element.id, { mode: e.target.value })}>
              <option value="embed">En el tablero (iframe)</option>
              <option value="launcher">Tarjeta · abrir en pestaña nueva</option>
            </select>
          </label>
          {element.data.mode === "embed" && (
            <p className="inspector-hint">Si el recurso sale en blanco, el sitio prohíbe verse embebido: cambia a «Tarjeta».</p>
          )}
        </>
      )}

      {element.type === "image" && (
        <label>URL de imagen <input value={fieldValue(element, "url")} onChange={(e) => updateElementData(element.id, { url: e.target.value })} placeholder="https://..." /></label>
      )}

      {element.type === "file" && (
        <p className="inspector-hint">{element.data.kind === "pdf" ? "PDF embebido" : "Imagen local"} · {element.data.mimeType}</p>
      )}

      {element.type === "pictos" && (
        <>
          <label>Título <input value={element.data.title} onChange={(e) => updateElementData(element.id, { title: e.target.value })} /></label>
          <label>
            Tipo visual
            <select value={element.data.mode} onChange={(e) => updateElementData(element.id, { mode: e.target.value })}>
              <option value="sequence">Secuencia</option>
              <option value="pattern">Patrón repetido</option>
            </select>
          </label>
          {element.data.mode === "pattern" && (
            <label>Repeticiones visibles
              <input type="number" min={2} max={12} value={element.data.repeatCount}
                onChange={(e) => updateElementData(element.id, { repeatCount: Number(e.target.value) })} />
            </label>
          )}
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showLights}
              onChange={(e) => updateElementData(element.id, { showLights: e.target.checked })} />
            Mostrar luces de fase
          </label>
          {element.data.items.length > 0 && (
            <label>Fase actual
              <input type="range" min={0}
                max={Math.max(0, (element.data.mode === "pattern" ? element.data.repeatCount : element.data.items.length) - 1)}
                value={Math.min(element.data.activeIndex, Math.max(0, (element.data.mode === "pattern" ? element.data.repeatCount : element.data.items.length) - 1))}
                onChange={(e) => updateElementData(element.id, { activeIndex: Number(e.target.value) })} />
              <span className="range-value">{element.data.activeIndex + 1}</span>
            </label>
          )}

          <div className="picto-search">
            <label>Buscar en ARASAAC
              <div className="picto-search-row">
                <input value={pictoQuery} onChange={(e) => setPictoQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void searchArasaac(); }}
                  placeholder="comer, patio, recoger..." />
                <button type="button" onClick={() => void searchArasaac()} disabled={pictoLoading}>
                  {pictoLoading ? "..." : "Buscar"}
                </button>
              </div>
            </label>
            {pictoError && <p className="warning">{pictoError}</p>}
            {pictoResults.length > 0 && (
              <div className="picto-results">
                {pictoResults.map((result) => {
                  const label = result.label || pictoQuery.trim() || "pictograma";
                  return (
                    <button key={result.id} type="button" className="picto-result"
                      onClick={() => updateElementData(element.id, {
                        items: [...element.data.items, {
                          id: result.id,
                          label,
                          url: result.url,
                          source: "arasaac" as const
                        }].slice(0, 24)
                      })}>
                      <img src={result.url} alt="" loading="lazy" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {element.data.items.length > 0 && (
            <div className="picto-list">
              {element.data.items.map((item, index) => (
                <div key={`${item.id}-${index}`} className="picto-list-item">
                  <img src={item.url} alt="" loading="lazy" />
                  <input value={item.label} onChange={(e) => {
                    const items = element.data.items.map((candidate, itemIndex) => (
                      itemIndex === index ? { ...candidate, label: e.target.value } : candidate
                    ));
                    updateElementData(element.id, { items });
                  }} />
                  <button type="button" title="Marcar fase" onClick={() => updateElementData(element.id, { activeIndex: index })}>Luz</button>
                  <button type="button" title="Quitar pictograma" onClick={() => {
                    const items = element.data.items.filter((_, itemIndex) => itemIndex !== index);
                    updateElementData(element.id, { items, activeIndex: Math.min(element.data.activeIndex, Math.max(0, items.length - 1)) });
                  }}>Quitar</button>
                </div>
              ))}
              <button type="button" onClick={() => updateElementData(element.id, { items: [], activeIndex: 0 })}>
                Vaciar secuencia
              </button>
            </div>
          )}

          <p className="inspector-hint">
            Pictogramas: Gobierno de Aragón · Sergio Palao · ARASAAC · CC BY-NC-SA.
          </p>
        </>
      )}

      {element.type === "timer" && (
        <>
          <label>Etiqueta <input value={fieldValue(element, "label")} onChange={(e) => updateElementData(element.id, { label: e.target.value })} /></label>
          <label>Duración (min)
            <input type="number" min={1} max={120}
              value={Math.round(Number(fieldValue(element, "initialSeconds") || fieldValue(element, "seconds") || 300) / 60)}
              onChange={(e) => { const s = Number(e.target.value) * 60; updateElementData(element.id, { initialSeconds: s, seconds: s, running: false }); }} />
          </label>
          <label>Estilo
            <select value={fieldValue(element, "style") || "classic"} onChange={(e) => updateElementData(element.id, { style: e.target.value })}>
              <option value="classic">Clásico</option>
              <option value="focus">Foco</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <label>Color <input type="color" value={fieldValue(element, "accentColor") || "#c45d3e"} onChange={(e) => updateElementData(element.id, { accentColor: e.target.value })} /></label>
        </>
      )}

      {element.type === "semaphore" && (
        <label>Etiqueta <input value={fieldValue(element, "label")} onChange={(e) => updateElementData(element.id, { label: e.target.value })} /></label>
      )}

      {/* ── Reloj ──────────────────────────────────────────────────────────── */}

      {element.type === "clock" && (
        <>
          <label>Estilo
            <select value={element.data.style} onChange={(e) => updateElementData(element.id, { style: e.target.value })}>
              <option value="digital">Digital</option>
              <option value="analog">Analógico</option>
            </select>
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showSeconds}
              onChange={(e) => updateElementData(element.id, { showSeconds: e.target.checked })} />
            Mostrar segundos
          </label>
          <label>Color principal <input type="color" value={element.data.color} onChange={(e) => updateElementData(element.id, { color: e.target.value })} /></label>
          <label>Color fondo <input type="color" value={element.data.bgColor} onChange={(e) => updateElementData(element.id, { bgColor: e.target.value })} /></label>
        </>
      )}

      {/* ── Dado ───────────────────────────────────────────────────────────── */}

      {element.type === "dice" && (
        <>
          <label>Caras del dado
            <select value={element.data.sides} onChange={(e) => updateElementData(element.id, { sides: Number(e.target.value), value: 1 })}>
              <option value={4}>D4 (tetraedro)</option>
              <option value={6}>D6 (cubo)</option>
              <option value={8}>D8 (octaedro)</option>
              <option value={10}>D10</option>
              <option value={12}>D12 (dodecaedro)</option>
              <option value={20}>D20 (icosaedro)</option>
              <option value={100}>D100</option>
            </select>
          </label>
          <label>Color <input type="color" value={element.data.color} onChange={(e) => updateElementData(element.id, { color: e.target.value })} /></label>
          <p className="inspector-hint">Toca el dado en el canvas para tirar.</p>
        </>
      )}

      {/* ── Ruleta ─────────────────────────────────────────────────────────── */}

      {element.type === "spinner" && (
        <>
          <label>
            Nombres (uno por línea)
            <textarea
              value={element.data.items.join("\n")}
              placeholder="Ana&#10;Carlos&#10;María&#10;..."
              onChange={(e) => {
                const items = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                updateElementData(element.id, { items, result: null });
              }} />
          </label>
          {element.data.result && (
            <div className="spinner-result">
              <span>Resultado:</span>
              <strong>{element.data.result}</strong>
              <button type="button" className="icon-only" title="Limpiar resultado"
                onClick={() => updateElementData(element.id, { result: null })}>✕</button>
            </div>
          )}
          <p className="inspector-hint">{element.data.items.length} nombre{element.data.items.length !== 1 ? "s" : ""}. Toca la ruleta para girar.</p>
        </>
      )}

      {/* ── Pauta de escritura ─────────────────────────────────────────────── */}

      {element.type === "guidelines" && (
        <>
          <label>Tipo de pauta
            <select value={element.data.style} onChange={(e) => updateElementData(element.id, { style: e.target.value })}>
              <option value="montessori">Montessori (3 líneas)</option>
              <option value="double">Doble (2 líneas)</option>
              <option value="normal">Normal (1 línea)</option>
            </select>
          </label>
          <label>Número de renglones
            <input type="number" min={1} max={30} value={element.data.lines}
              onChange={(e) => updateElementData(element.id, { lines: Number(e.target.value) })} />
          </label>
          <label>Color de líneas <input type="color" value={element.data.lineColor} onChange={(e) => updateElementData(element.id, { lineColor: e.target.value })} /></label>
          <label>Color de fondo <input type="color" value={element.data.bgColor} onChange={(e) => updateElementData(element.id, { bgColor: e.target.value })} /></label>
        </>
      )}

      {/* ── Operación matemática ───────────────────────────────────────────── */}

      {element.type === "math" && (
        <>
          <label>Operación
            <select value={element.data.operation} onChange={(e) => updateElementData(element.id, { operation: e.target.value })}>
              <option value="sum">Suma (+)</option>
              <option value="subtract">Resta (−)</option>
              <option value="multiply">Multiplicación (×)</option>
              <option value="divide">División (÷)</option>
            </select>
          </label>
          <label>Primer número <input value={element.data.operandA} placeholder="ej. 234" onChange={(e) => updateElementData(element.id, { operandA: e.target.value })} /></label>
          <label>Segundo número <input value={element.data.operandB} placeholder="ej. 156" onChange={(e) => updateElementData(element.id, { operandB: e.target.value })} /></label>
          <label>Resultado <input value={element.data.result} placeholder="ej. 390" onChange={(e) => updateElementData(element.id, { result: e.target.value })} /></label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showResult}
              onChange={(e) => updateElementData(element.id, { showResult: e.target.checked })} />
            Mostrar resultado en pantalla
          </label>
          <label>Tamaño de fuente
            <input type="range" min={16} max={120} value={element.data.fontSize}
              onChange={(e) => updateElementData(element.id, { fontSize: Number(e.target.value) })} />
            <span className="range-value">{element.data.fontSize}px</span>
          </label>
        </>
      )}

      {/* ── Base 10 ───────────────────────────────────────────────────────── */}

      {element.type === "base10" && (() => {
        const value = element.data.unitCount + element.data.rodCount * 10 + element.data.flatCount * 100 + element.data.cubeCount * 1000;
        const mode = element.data.mode ?? "placeValue";
        const pieces = element.data.pieces ?? [];
        const setCount = (key: "unitCount" | "rodCount" | "flatCount" | "cubeCount", value: number) => {
          const max = key === "cubeCount" ? 10 : key === "flatCount" ? 30 : 99;
          updateElementData(element.id, { [key]: Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0)) });
        };
        return (
          <>
            <div className="base10-value">
              <span>Valor representado</span>
              <strong>{value}</strong>
            </div>
            <div className="table-size-row">
              <label>Millares
                <input type="number" min={0} max={10} value={element.data.cubeCount}
                  onChange={(e) => setCount("cubeCount", Number(e.target.value))} />
              </label>
              <label>Centenas
                <input type="number" min={0} max={30} value={element.data.flatCount}
                  onChange={(e) => setCount("flatCount", Number(e.target.value))} />
              </label>
              <label>Decenas
                <input type="number" min={0} max={99} value={element.data.rodCount}
                  onChange={(e) => setCount("rodCount", Number(e.target.value))} />
              </label>
              <label>Unidades
                <input type="number" min={0} max={99} value={element.data.unitCount}
                  onChange={(e) => setCount("unitCount", Number(e.target.value))} />
              </label>
            </div>
            <label>Visualización
              <select value={element.data.style} onChange={(e) => updateElementData(element.id, { style: e.target.value })}>
                <option value="2d">Bloques 2D</option>
                <option value="3d">Cubo 3D visual</option>
              </select>
            </label>
            <label>Modo
              <select value={mode} onChange={(e) => updateElementData(element.id, {
                mode: e.target.value,
                pieces: e.target.value === "placeValue"
                  ? []
                  : (pieces.length > 0 ? pieces : createBase10InspectorPieces(element.data, element.width))
              })}>
                <option value="placeValue">Valor posicional</option>
                <option value="free">Piezas manipulables</option>
              </select>
            </label>
            <label className="inspector-checkbox">
              <input type="checkbox" checked={element.data.showValue}
                onChange={(e) => updateElementData(element.id, { showValue: e.target.checked })} />
              Mostrar valor
            </label>
            <label className="inspector-checkbox">
              <input type="checkbox" checked={element.data.showPlaceLabels}
                onChange={(e) => updateElementData(element.id, { showPlaceLabels: e.target.checked })} />
              Mostrar etiquetas posicionales
            </label>
            <div className="base10-exchanges">
              <button type="button" disabled={element.data.unitCount < 10}
                onClick={() => updateElementData(element.id, { unitCount: element.data.unitCount - 10, rodCount: Math.min(99, element.data.rodCount + 1) })}>
                {"10U -> 1D"}
              </button>
              <button type="button" disabled={element.data.rodCount < 10}
                onClick={() => updateElementData(element.id, { rodCount: element.data.rodCount - 10, flatCount: Math.min(30, element.data.flatCount + 1) })}>
                {"10D -> 1C"}
              </button>
              <button type="button" disabled={element.data.flatCount < 10}
                onClick={() => updateElementData(element.id, { flatCount: element.data.flatCount - 10, cubeCount: Math.min(10, element.data.cubeCount + 1) })}>
                {"10C -> 1M"}
              </button>
              <button type="button" disabled={element.data.rodCount < 1 || element.data.unitCount > 89}
                onClick={() => updateElementData(element.id, { rodCount: element.data.rodCount - 1, unitCount: Math.min(99, element.data.unitCount + 10) })}>
                {"1D -> 10U"}
              </button>
              <button type="button" disabled={element.data.flatCount < 1 || element.data.rodCount > 89}
                onClick={() => updateElementData(element.id, { flatCount: element.data.flatCount - 1, rodCount: Math.min(99, element.data.rodCount + 10) })}>
                {"1C -> 10D"}
              </button>
              <button type="button" disabled={element.data.cubeCount < 1 || element.data.flatCount > 20}
                onClick={() => updateElementData(element.id, { cubeCount: element.data.cubeCount - 1, flatCount: Math.min(30, element.data.flatCount + 10) })}>
                {"1M -> 10C"}
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Fracciones ────────────────────────────────────────────────────── */}

      {element.type === "fraction" && (
        <>
          <div className="table-size-row">
            <label>Numerador
              <input type="number" min={0} max={24} value={element.data.numerator}
                onChange={(e) => updateElementData(element.id, { numerator: Number(e.target.value) })} />
            </label>
            <label>Denominador
              <input type="number" min={1} max={24} value={element.data.denominator}
                onChange={(e) => updateElementData(element.id, { denominator: Number(e.target.value) || 1 })} />
            </label>
          </div>
          <label>Modelo visual
            <select value={element.data.model} onChange={(e) => updateElementData(element.id, { model: e.target.value })}>
              <option value="bar">Barra</option>
              <option value="circle">Círculo</option>
              <option value="set">Conjunto</option>
            </select>
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showCompare}
              onChange={(e) => updateElementData(element.id, { showCompare: e.target.checked })} />
            Comparar con otra fracción
          </label>
          {element.data.showCompare && (
            <div className="table-size-row">
              <label>Num. 2
                <input type="number" min={0} max={24} value={element.data.compareNumerator}
                  onChange={(e) => updateElementData(element.id, { compareNumerator: Number(e.target.value) })} />
              </label>
              <label>Den. 2
                <input type="number" min={1} max={24} value={element.data.compareDenominator}
                  onChange={(e) => updateElementData(element.id, { compareDenominator: Number(e.target.value) || 1 })} />
              </label>
            </div>
          )}
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showLabels}
              onChange={(e) => updateElementData(element.id, { showLabels: e.target.checked })} />
            Mostrar etiqueta
          </label>
          <label>Color <input type="color" value={element.data.color} onChange={(e) => updateElementData(element.id, { color: e.target.value })} /></label>
        </>
      )}

      {/* ── Algoritmos ────────────────────────────────────────────────────── */}

      {element.type === "algorithm" && (
        <>
          <label>Operación
            <select value={element.data.operation} onChange={(e) => {
              const operation = e.target.value;
              updateElementData(element.id, {
                operation,
                strategy: operation === "divide" ? "birdBeak" : operation === "multiply" ? "areaModel" : "placeValue"
              });
            }}>
              <option value="add">Suma</option>
              <option value="subtract">Resta</option>
              <option value="multiply">Multiplicación</option>
              <option value="divide">División</option>
            </select>
          </label>
          <label>Estrategia
            <select value={
              element.data.operation === "divide"
                ? (element.data.strategy === "standard" ? "standard" : "birdBeak")
                : element.data.operation === "multiply"
                  ? (["areaModel", "standard", "placeValue"].includes(element.data.strategy ?? "") ? element.data.strategy : "areaModel")
                  : (element.data.strategy === "standard" ? "standard" : "placeValue")
            }
              onChange={(e) => updateElementData(element.id, { strategy: e.target.value })}>
              {(element.data.operation === "add" || element.data.operation === "subtract") && (
                <>
                  <option value="placeValue">M/C/D/U</option>
                  <option value="standard">Algoritmo clásico</option>
                </>
              )}
              {element.data.operation === "multiply" && (
                <>
                  <option value="areaModel">Rejilla / área</option>
                  <option value="standard">Algoritmo clásico</option>
                  <option value="placeValue">M/C/D/U</option>
                </>
              )}
              {element.data.operation === "divide" && (
                <>
                  <option value="birdBeak">Pico de pájaro</option>
                  <option value="standard">División clásica</option>
                </>
              )}
            </select>
          </label>
          <label>Primer número <input inputMode="numeric" value={element.data.operandA} onChange={(e) => updateElementData(element.id, { operandA: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
          <label>Segundo número <input inputMode="numeric" value={element.data.operandB} onChange={(e) => updateElementData(element.id, { operandB: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
          <label>Resultado manual <input inputMode="text" value={element.data.result} onChange={(e) => {
            const clean = e.target.value.replace(/[^0-9rR\s]/g, "").replace(/\s+/g, " ").slice(0, 16);
            updateElementData(element.id, { result: clean });
          }} /></label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showResult}
              onChange={(e) => updateElementData(element.id, { showResult: e.target.checked })} />
            Mostrar resultado
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showPlaceValue}
              onChange={(e) => updateElementData(element.id, { showPlaceValue: e.target.checked })} />
            Mostrar valor posicional
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showGrid}
              onChange={(e) => updateElementData(element.id, { showGrid: e.target.checked })} />
            Mostrar guías
          </label>
        </>
      )}

      {/* ── Lógica infantil ───────────────────────────────────────────────── */}

      {element.type === "logic" && (
        <>
          <label>Actividad
            <select value={element.data.mode} onChange={(e) => updateElementData(element.id, { mode: e.target.value })}>
              <option value="pattern">Series</option>
              <option value="count">Conteo</option>
              <option value="sort">Clasificación</option>
            </select>
          </label>
          <label>Repeticiones visibles
            <input type="number" min={2} max={16} value={element.data.repeatCount}
              onChange={(e) => updateElementData(element.id, { repeatCount: Number(e.target.value) })} />
          </label>
          <label>Hueco oculto (-1 ninguno)
            <input type="number" min={-1} max={31} value={element.data.hiddenIndex}
              onChange={(e) => updateElementData(element.id, { hiddenIndex: Number(e.target.value) })} />
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.showAnswer}
              onChange={(e) => updateElementData(element.id, { showAnswer: e.target.checked })} />
            Mostrar respuesta
          </label>
          <label>Conteo objetivo
            <input type="number" min={1} max={20} value={element.data.targetCount}
              onChange={(e) => updateElementData(element.id, { targetCount: Number(e.target.value) })} />
          </label>
        </>
      )}

      {/* ── Tabla / cuadrícula ────────────────────────────────────────────── */}

      {element.type === "table" && (() => {
        const { rows, cols, cells, headerRow, borderColor, headerBg, fontSize } = element.data;

        // Edición de celdas: textarea con tabuladores (col) y saltos de línea (fila)
        const cellsToText = () =>
          Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => cells[r * cols + c] ?? "").join("\t")
          ).join("\n");

        const textToCells = (text: string) => {
          const result: string[] = new Array(rows * cols).fill("");
          text.split("\n").slice(0, rows).forEach((row, r) => {
            row.split("\t").slice(0, cols).forEach((cell, c) => {
              result[r * cols + c] = cell.trim();
            });
          });
          return result;
        };

        return (
          <>
            <div className="table-size-row">
              <label>Filas
                <input type="number" min={1} max={12} value={rows}
                  onChange={(e) => {
                    const nr = Number(e.target.value);
                    updateElementData(element.id, { rows: nr, cells: new Array(nr * cols).fill("") });
                  }} />
              </label>
              <label>Columnas
                <input type="number" min={1} max={8} value={cols}
                  onChange={(e) => {
                    const nc = Number(e.target.value);
                    updateElementData(element.id, { cols: nc, cells: new Array(rows * nc).fill("") });
                  }} />
              </label>
            </div>
            <label className="inspector-checkbox">
              <input type="checkbox" checked={headerRow}
                onChange={(e) => updateElementData(element.id, { headerRow: e.target.checked })} />
              Fila de encabezado
            </label>
            <label>
              Contenido (Tab = columna · Enter = fila)
              <textarea
                value={cellsToText()}
                placeholder={"Nombre\tNota\tGrupo\nAna\t9\tA"}
                onChange={(e) => updateElementData(element.id, { cells: textToCells(e.target.value) })}
              />
            </label>
            <label>Tamaño de fuente
              <input type="range" min={8} max={48} value={fontSize}
                onChange={(e) => updateElementData(element.id, { fontSize: Number(e.target.value) })} />
              <span className="range-value">{fontSize}px</span>
            </label>
            <label>Color encabezado <input type="color" value={headerBg} onChange={(e) => updateElementData(element.id, { headerBg: e.target.value })} /></label>
            <label>Color bordes <input type="color" value={borderColor} onChange={(e) => updateElementData(element.id, { borderColor: e.target.value })} /></label>
          </>
        );
      })()}

      {/* ── Cuadrícula ─────────────────────────────────────────────────────── */}

      {element.type === "grid" && (
        <>
          <button type="button" onClick={fixAsBackground}>
            Fijar como fondo
          </button>
          <label>Tamaño de celda ({element.data.cellSize}px)
            <input type="range" min={10} max={100} value={element.data.cellSize}
              onChange={(e) => updateElementData(element.id, { cellSize: Number(e.target.value) })} />
          </label>
          <label>Línea gruesa cada
            <select value={element.data.boldEvery}
              onChange={(e) => updateElementData(element.id, { boldEvery: Number(e.target.value) })}>
              {[2, 3, 4, 5, 8, 10].map(n => <option key={n} value={n}>{n} celdas</option>)}
            </select>
          </label>
          <label>Color de líneas <input type="color" value={element.data.lineColor} onChange={(e) => updateElementData(element.id, { lineColor: e.target.value })} /></label>
          <label>Color de fondo <input type="color" value={element.data.bgColor} onChange={(e) => updateElementData(element.id, { bgColor: e.target.value })} /></label>
        </>
      )}

      {/* ── Lienzo libre ───────────────────────────────────────────────────── */}

      {element.type === "drawing" && (
        <>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.drawMode}
              onChange={(e) => updateElementData(element.id, { drawMode: e.target.checked })} />
            Modo dibujo activo (desactiva para mover)
          </label>
          <label>Color de trazo <input type="color" value={element.data.strokeColor} onChange={(e) => updateElementData(element.id, { strokeColor: e.target.value })} /></label>
          <label>Grosor de trazo
            <input type="range" min={1} max={20} value={element.data.strokeWidth}
              onChange={(e) => updateElementData(element.id, { strokeWidth: Number(e.target.value) })} />
            <span className="range-value">{element.data.strokeWidth}px</span>
          </label>
          <label>Color de fondo <input type="color" value={element.data.bgColor} onChange={(e) => updateElementData(element.id, { bgColor: e.target.value })} /></label>
          <button type="button" className="danger"
            onClick={() => { void confirmDialog({ title: "Borrar lienzo", message: "¿Borrar todos los trazos?", confirmLabel: "Borrar", danger: true }).then((ok) => { if (ok) updateElementData(element.id, { strokes: [] }); }); }}>
            Borrar lienzo
          </button>
        </>
      )}

      {/* ── Medidor de ruido ───────────────────────────────────────────────── */}

      {element.type === "noise" && (
        <>
          <label>Etiqueta <input value={element.data.label} onChange={(e) => updateElementData(element.id, { label: e.target.value })} /></label>
          <label>Umbral de alerta ({element.data.threshold}%)
            <input type="range" min={10} max={90} value={element.data.threshold}
              onChange={(e) => updateElementData(element.id, { threshold: Number(e.target.value) })} />
          </label>
          <p className="inspector-hint">Activa el micrófono pulsando "Activar" en el widget. Requiere permiso del navegador.</p>
        </>
      )}

      {/* ── Código QR ──────────────────────────────────────────────────────── */}

      {element.type === "qr" && (
        <>
          <label>URL o texto del QR
            <textarea value={element.data.text}
              onChange={(e) => updateElementData(element.id, { text: e.target.value })}
              placeholder="https://..." />
          </label>
          <label>Etiqueta inferior
            <input value={element.data.label} onChange={(e) => updateElementData(element.id, { label: e.target.value })} placeholder="Escanéame" />
          </label>
          <label>Color QR <input type="color" value={element.data.fgColor} onChange={(e) => updateElementData(element.id, { fgColor: e.target.value })} /></label>
          <label>Fondo <input type="color" value={element.data.bgColor} onChange={(e) => updateElementData(element.id, { bgColor: e.target.value })} /></label>
          <button type="button" onClick={() => navigator.clipboard.writeText(element.data.text)}>
            Copiar URL/texto
          </button>
        </>
      )}

      {/* ── Comentario asincrono ─────────────────────────────────────────── */}

      {element.type === "comment" && (
        <>
          <label>Comentario
            <textarea value={element.data.text} onChange={(e) => updateElementData(element.id, { text: e.target.value })} />
          </label>
          <label>Autor / equipo
            <input value={element.data.author} onChange={(e) => updateElementData(element.id, { author: e.target.value })} />
          </label>
          <label>Estado
            <select value={element.data.status} onChange={(e) => updateElementData(element.id, { status: e.target.value })}>
              <option value="open">Abierto</option>
              <option value="resolved">Resuelto</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </label>
          <label>Color <input type="color" value={element.data.color} onChange={(e) => updateElementData(element.id, { color: e.target.value })} /></label>
          <p className="inspector-hint">Creado: {new Date(element.data.createdAt).toLocaleString("es")}</p>
        </>
      )}

      {/* ── Conectores y diagramas ───────────────────────────────────────── */}

      {element.type === "connector" && (
        <>
          <label>Etiqueta <input value={element.data.label} onChange={(e) => updateElementData(element.id, { label: e.target.value })} /></label>
          <label>Estilo
            <select value={element.data.style} onChange={(e) => updateElementData(element.id, { style: e.target.value })}>
              <option value="straight">Recta</option>
              <option value="elbow">Codo</option>
              <option value="dashed">Discontinua</option>
            </select>
          </label>
          <label>Color <input type="color" value={element.data.color} onChange={(e) => updateElementData(element.id, { color: e.target.value })} /></label>
          <label>Grosor
            <input type="range" min={1} max={16} value={element.data.strokeWidth}
              onChange={(e) => updateElementData(element.id, { strokeWidth: Number(e.target.value) })} />
            <span className="range-value">{element.data.strokeWidth}px</span>
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.arrowStart}
              onChange={(e) => updateElementData(element.id, { arrowStart: e.target.checked })} />
            Punta inicial
          </label>
          <label className="inspector-checkbox">
            <input type="checkbox" checked={element.data.arrowEnd}
              onChange={(e) => updateElementData(element.id, { arrowEnd: e.target.checked })} />
            Punta final
          </label>
        </>
      )}

      {element.type === "flow" && (
        <>
          <label>Texto
            <textarea value={element.data.text} onChange={(e) => updateElementData(element.id, { text: e.target.value })} />
          </label>
          <label>Forma
            <select value={element.data.shape} onChange={(e) => updateElementData(element.id, { shape: e.target.value })}>
              <option value="process">Proceso</option>
              <option value="decision">Decisión</option>
              <option value="terminator">Inicio / fin</option>
              <option value="data">Dato</option>
            </select>
          </label>
          <label>Relleno <input type="color" value={element.data.fill} onChange={(e) => updateElementData(element.id, { fill: e.target.value })} /></label>
          <label>Borde <input type="color" value={element.data.stroke} onChange={(e) => updateElementData(element.id, { stroke: e.target.value })} /></label>
          <label>Texto <input type="color" value={element.data.textColor} onChange={(e) => updateElementData(element.id, { textColor: e.target.value })} /></label>
          <label>Tamaño de texto
            <input type="range" min={10} max={64} value={element.data.fontSize}
              onChange={(e) => updateElementData(element.id, { fontSize: Number(e.target.value) })} />
            <span className="range-value">{element.data.fontSize}px</span>
          </label>
        </>
      )}

      {/* ── App EDUmind (Hub) ──────────────────────────────────────────────── */}

      {element.type === "dictadoNum" && (
        <>
          <p className="inspector-hint">Qué representaciones pueden salir (se sortean al azar):</p>
          {([
            ["cifra", "Cifra (24)"],
            ["letra", "Letra (veinticuatro)"],
            ["romano", "Números romanos (XXIV)"],
            ["ordinal", "Ordinal (vigésimo cuarto)"],
            ["base10", "Base 10 (bloques)"]
          ] as const).map(([value, label]) => {
            const enabled = element.data.forms.includes(value);
            return (
              <label className="checkbox" key={value}>
                <input type="checkbox" checked={enabled}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...element.data.forms, value]
                      : element.data.forms.filter((f) => f !== value);
                    if (next.length > 0) updateElementData(element.id, { forms: next });
                  }} />
                {label}
              </label>
            );
          })}
          <label>Desde
            <input type="number" min={0} max={9999} value={element.data.min}
              onChange={(e) => updateElementData(element.id, { min: Math.max(0, Math.min(9999, Number(e.target.value) || 0)) })} />
          </label>
          <label>Hasta
            <input type="number" min={0} max={9999} value={element.data.max}
              onChange={(e) => updateElementData(element.id, { max: Math.max(0, Math.min(9999, Number(e.target.value) || 0)) })} />
          </label>
          <label>Color <input type="color" value={element.data.accent}
            onChange={(e) => updateElementData(element.id, { accent: e.target.value })} /></label>
          <p className="inspector-hint">
            El board muestra un número al azar en una de las formas activas.
            «Siguiente» sortea otro; «Respuesta» revela la cifra. Romano solo 1–3999.
          </p>
        </>
      )}

      {element.type === "mindmap" && (
        <>
          <label>
            Tipo de mapa
            <select value={element.data.variant}
              onChange={(e) => updateElementData(element.id, { variant: e.target.value })}>
              <option value="mindmap">Mapa mental (ramas)</option>
              <option value="concept">Mapa conceptual (con frases de enlace)</option>
            </select>
          </label>
          <label>
            Estilo de enlace
            <select value={element.data.edgeStyle}
              onChange={(e) => updateElementData(element.id, { edgeStyle: e.target.value })}>
              <option value="curved">Curvo</option>
              <option value="elbow">En ángulo</option>
              <option value="straight">Recto</option>
            </select>
          </label>
          <label>Color base <input type="color" value={element.data.accent}
            onChange={(e) => updateElementData(element.id, { accent: e.target.value })} /></label>
          <label>Fondo <input type="color" value={element.data.background}
            onChange={(e) => updateElementData(element.id, { background: e.target.value })} /></label>
          <p className="inspector-hint">
            Doble clic en una idea para editarla · «+» añade una idea enlazada ·
            «Enlazar» conecta dos ideas · «Auto-organizar» reparte el mapa en radial.
          </p>
        </>
      )}

      {element.type === "mates3d" && (
        <>
          <label>
            Modo
            <select
              value={element.data.mode}
              onChange={(e) => updateElementData(element.id, { mode: e.target.value })}
            >
              <option value="base10">Bloques Base 10 (valor posicional)</option>
              <option value="solids">Cuerpos geométricos</option>
            </select>
          </label>
          {element.data.mode === "base10" && (
            <>
              <label className="checkbox">
                <input type="checkbox" checked={element.data.showValue}
                  onChange={(e) => updateElementData(element.id, { showValue: e.target.checked })} />
                Mostrar valor total
              </label>
              <p className="inspector-hint">
                Arrastra las piezas sobre el suelo con volumen real: 10 unidades caben
                exactamente en una decena. Los canjes se hacen desde los botones de la escena.
              </p>
            </>
          )}
          {element.data.mode === "solids" && (
            <>
              <label>
                Sólido
                <select
                  value={element.data.solid}
                  onChange={(e) => updateElementData(element.id, { solid: e.target.value })}
                >
                  <option value="cube">Cubo</option>
                  <option value="prism">Prisma (n lados)</option>
                  <option value="pyramid">Pirámide (n lados)</option>
                  <option value="cylinder">Cilindro</option>
                  <option value="cone">Cono</option>
                  <option value="sphere">Esfera</option>
                </select>
              </label>
              {(element.data.solid === "prism" || element.data.solid === "pyramid") && (
                <label>Lados de la base ({element.data.solidSides})
                  <input type="range" min={3} max={12} value={element.data.solidSides}
                    onChange={(e) => updateElementData(element.id, { solidSides: Number(e.target.value) })} />
                </label>
              )}
              <label>Color <input type="color" value={element.data.solidColor}
                onChange={(e) => updateElementData(element.id, { solidColor: e.target.value })} /></label>
              <label className="checkbox">
                <input type="checkbox" checked={element.data.solidTransparent}
                  onChange={(e) => updateElementData(element.id, { solidTransparent: e.target.checked })} />
                Transparente (ver interior)
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={element.data.showEdges}
                  onChange={(e) => updateElementData(element.id, { showEdges: e.target.checked })} />
                Resaltar aristas
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={element.data.showVertices}
                  onChange={(e) => updateElementData(element.id, { showVertices: e.target.checked })} />
                Marcar vértices
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={element.data.showCounts}
                  onChange={(e) => updateElementData(element.id, { showCounts: e.target.checked })} />
                Mostrar fórmula de Euler
              </label>
            </>
          )}
        </>
      )}

      {element.type === "hub" && (
        <>
          <label>
            App
            <select
              value={element.data.appId}
              onChange={(e) => updateElementData(element.id, { appId: e.target.value, mode: "express" })}
            >
              {HUB_APPS.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.emoji} {app.name} — {app.description}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modo de visualización
            <select
              value={element.data.mode}
              onChange={(e) => updateElementData(element.id, { mode: e.target.value })}
            >
              <option value="express">Express (tarjeta de acceso rápido)</option>
              <option value="embed">Embed (app completa dentro del board)</option>
            </select>
          </label>
          {element.data.mode === "embed" && (
            <p className="inspector-hint">
              La app se carga embebida. En modo presentación es completamente interactiva.
              Las apps con soporte Plugin pueden controlar el semáforo y timer del board.
            </p>
          )}
          {element.data.mode === "express" && (
            <p className="inspector-hint">
              Toca "Abrir →" en el widget para acceder a la app. Toca "Embed ↗" para
              embeber la app completa dentro del board.
            </p>
          )}
        </>
      )}
    </aside>
  );
}
