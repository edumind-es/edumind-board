import {
  BringToFront,
  Copy,
  SendToBack,
  Minus,
  Plus,
  Shapes,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { useBoardStore, type InkTool } from "../lib/store";
import { confirmDialog } from "./ui/feedback";
import { INK_TOOL_GROUPS, getInkToolDefinition, type InkToolDefinition } from "../ink/tools";

// Paleta de tinta = Los Cinco Mundos + tinta base (legibles sobre papel Lámina).
// El blanco anterior era invisible sobre el lienzo; se sustituye por tinta.
const COLORS = [
  { value: "#1c1a16", label: "Tinta" },
  { value: "#e8613f", label: "Físico" },
  { value: "#e8a92e", label: "Social" },
  { value: "#6ea94a", label: "Emocional" },
  { value: "#3f7d99", label: "Mental" },
  { value: "#2c5c66", label: "Interior" },
  { value: "#a63a1f", label: "Terracota" },
  { value: "#8b5cf6", label: "Violeta" }
];

const WIDTHS = [
  { value: 2, label: "Fino" },
  { value: 5, label: "Medio" },
  { value: 12, label: "Grueso" }
];

function InkToolButton({ tool, label, icon: Icon }: InkToolDefinition) {
  const inkTool = useBoardStore((s) => s.inkTool);
  const setInkTool = useBoardStore((s) => s.setInkTool);
  const active = inkTool === tool;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`ink-tool-btn ${active ? "is-active" : ""}`}
      onClick={() => setInkTool(tool)}
    >
      <Icon size={17} />
    </button>
  );
}

export function GlobalInkToolbar() {
  const globalInkMode = useBoardStore((s) => s.globalInkMode);
  const toggleGlobalInkMode = useBoardStore((s) => s.toggleGlobalInkMode);
  const inkTool = useBoardStore((s) => s.inkTool);
  const inkColor = useBoardStore((s) => s.inkColor);
  const inkWidth = useBoardStore((s) => s.inkWidth);
  const inkPolygonSides = useBoardStore((s) => s.inkPolygonSides);
  const selectedInkIndex = useBoardStore((s) => s.selectedInkIndex);
  const setInkColor = useBoardStore((s) => s.setInkColor);
  const setInkWidth = useBoardStore((s) => s.setInkWidth);
  const setInkPolygonSides = useBoardStore((s) => s.setInkPolygonSides);
  const updateSelectedInkStyle = useBoardStore((s) => s.updateSelectedInkStyle);
  const deleteSelectedInk = useBoardStore((s) => s.deleteSelectedInk);
  const duplicateSelectedInk = useBoardStore((s) => s.duplicateSelectedInk);
  const bringSelectedInkToFront = useBoardStore((s) => s.bringSelectedInkToFront);
  const sendSelectedInkToBack = useBoardStore((s) => s.sendSelectedInkToBack);

  if (!globalInkMode) return null;
  const activeTool = getInkToolDefinition(inkTool);
  const showPolygonControl = activeTool?.requiresPolygonSides;
  const hasSelection = selectedInkIndex !== null;

  function dispatchInkEvent(name: string) {
    window.dispatchEvent(new CustomEvent(name));
  }

  return (
    <div className="ink-toolbar" role="toolbar" aria-label="Herramientas de lienzo">
      <div className="ink-toolbar-header" title="Lienzo">
        <Shapes size={18} />
      </div>

      {INK_TOOL_GROUPS.map((group, index) => (
        <div key={group.id} className="ink-toolbar-section">
          {index > 0 && <div className="ink-toolbar-divider" />}
          <div className="ink-toolbar-group" aria-label={group.label} title={group.label}>
            {group.tools.map((tool) => <InkToolButton key={tool.tool} {...tool} />)}
          </div>
        </div>
      ))}

      {showPolygonControl && (
        <>
          <div className="ink-toolbar-divider" />
          <div className="ink-polygon-control" aria-label="Lados del polígono">
            <button type="button" className="ink-step-btn" title="Quitar lado"
              aria-label="Quitar lado al polígono" disabled={inkPolygonSides <= 3}
              onClick={() => setInkPolygonSides(inkPolygonSides - 1)}>
              <Minus size={14} />
            </button>
            <span title="Número de lados del polígono">{inkPolygonSides}</span>
            <button type="button" className="ink-step-btn" title="Añadir lado"
              aria-label="Añadir lado al polígono" disabled={inkPolygonSides >= 24}
              onClick={() => setInkPolygonSides(inkPolygonSides + 1)}>
              <Plus size={14} />
            </button>
          </div>
        </>
      )}

      <div className="ink-toolbar-divider" />

      <div className="ink-toolbar-group ink-color-group" aria-label="Color">
        {COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            title={color.label}
            aria-label={color.label}
            aria-pressed={inkColor === color.value}
            className={`ink-color-btn ${inkColor === color.value ? "is-active" : ""}`}
            style={{ background: color.value, borderColor: color.value === "#ffffff" ? "#9f9a90" : color.value }}
            onClick={() => {
              setInkColor(color.value);
              if (hasSelection) updateSelectedInkStyle({ color: color.value });
            }}
          />
        ))}
      </div>

      <div className="ink-toolbar-group" aria-label="Grosor">
        {WIDTHS.map((width) => (
          <button
            key={width.value}
            type="button"
            title={width.label}
            aria-label={width.label}
            aria-pressed={inkWidth === width.value}
            className={`ink-width-btn ${inkWidth === width.value ? "is-active" : ""}`}
            onClick={() => {
              setInkWidth(width.value);
              if (hasSelection) updateSelectedInkStyle({ width: width.value });
            }}
          >
            <span className="ink-width-preview" style={{ height: width.value, background: inkColor }} />
          </button>
        ))}
      </div>

      <div className="ink-toolbar-divider" />

      {hasSelection && (
        <>
          <div className="ink-toolbar-group" aria-label="Editar selección">
            <button type="button" className="ink-action-btn" title="Duplicar selección"
              aria-label="Duplicar selección" onClick={duplicateSelectedInk}>
              <Copy size={17} />
            </button>
            <button type="button" className="ink-action-btn" title="Traer al frente"
              aria-label="Traer al frente" onClick={bringSelectedInkToFront}>
              <BringToFront size={17} />
            </button>
            <button type="button" className="ink-action-btn" title="Enviar al fondo"
              aria-label="Enviar al fondo" onClick={sendSelectedInkToBack}>
              <SendToBack size={17} />
            </button>
            <button type="button" className="ink-action-btn danger" title="Borrar selección"
              aria-label="Borrar selección" onClick={deleteSelectedInk}>
              <Trash2 size={17} />
            </button>
          </div>
          <div className="ink-toolbar-divider" />
        </>
      )}

      <button type="button" className="ink-action-btn" title="Deshacer último elemento"
        aria-label="Deshacer último elemento" onClick={() => dispatchInkEvent("ink:undo")}>
        <Undo2 size={17} />
      </button>
      <button type="button" className="ink-action-btn danger" title="Limpiar lienzo"
        aria-label="Limpiar lienzo" onClick={() => { void confirmDialog({ title: "Limpiar lienzo", message: "¿Limpiar todo el lienzo? Se borrarán dibujos, formas y trazos.", confirmLabel: "Limpiar", danger: true }).then((ok) => { if (ok) dispatchInkEvent("ink:clear"); }); }}>
        <Trash2 size={17} />
      </button>
      <button type="button" className="ink-exit-btn" title="Salir del modo lienzo"
        aria-label="Salir del modo lienzo" onClick={toggleGlobalInkMode}>
        <X size={18} />
      </button>
    </div>
  );
}
