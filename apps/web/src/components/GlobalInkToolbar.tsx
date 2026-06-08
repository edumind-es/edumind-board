import {
  Box, Circle, Cone, Cuboid, Cylinder, DraftingCompass, Eraser, Grid3X3, Hexagon, Minus,
  Pencil, Plus, Ruler, Shapes, Square, Trash2, Triangle, Undo2, X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useBoardStore, type InkTool } from "../lib/store";

const COLORS = [
  { value: "#0f172a", label: "Azul noche" },
  { value: "#5e8fa3", label: "Azul EDUmind" },
  { value: "#3c6e7a", label: "Azul profundo" },
  { value: "#9ccb7b", label: "Verde EDUmind" },
  { value: "#f3c969", label: "Amarillo EDUmind" },
  { value: "#f28c7a", label: "Coral EDUmind" },
  { value: "#8b5cf6", label: "Violeta" },
  { value: "#ffffff", label: "Blanco" }
];

const WIDTHS = [
  { value: 2, label: "Fino" },
  { value: 5, label: "Medio" },
  { value: 12, label: "Grueso" }
];

type ToolButton = {
  tool: InkTool;
  label: string;
  icon: LucideIcon;
};

const DRAW_TOOLS: ToolButton[] = [
  { tool: "pen", label: "Lápiz", icon: Pencil },
  { tool: "eraser", label: "Borrador", icon: Eraser },
  { tool: "line", label: "Línea", icon: Minus },
  { tool: "rect", label: "Rectángulo", icon: Square },
  { tool: "ellipse", label: "Círculo", icon: Circle },
  { tool: "triangle", label: "Triángulo", icon: Triangle },
  { tool: "polygon", label: "Polígono regular", icon: Hexagon },
  { tool: "hexagon", label: "Hexágono", icon: Hexagon }
];

const MATH_TOOLS: ToolButton[] = [
  { tool: "angle", label: "Crear ángulo", icon: DraftingCompass },
  { tool: "angleMeasure", label: "Medir ángulo", icon: Ruler },
  { tool: "baseUnit", label: "Base 10: unidad", icon: Square },
  { tool: "baseRod", label: "Base 10: decena", icon: Minus },
  { tool: "baseFlat", label: "Base 10: centena", icon: Grid3X3 },
  { tool: "cube", label: "Cubo", icon: Cuboid },
  { tool: "pyramid", label: "Pirámide", icon: Box },
  { tool: "triangularPrism", label: "Prisma triangular", icon: Box },
  { tool: "cylinder", label: "Cilindro", icon: Cylinder },
  { tool: "cone", label: "Cono", icon: Cone },
  { tool: "sphere", label: "Esfera", icon: Circle }
];

function InkToolButton({ tool, label, icon: Icon }: ToolButton) {
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
  const inkColor = useBoardStore((s) => s.inkColor);
  const inkWidth = useBoardStore((s) => s.inkWidth);
  const inkPolygonSides = useBoardStore((s) => s.inkPolygonSides);
  const setInkColor = useBoardStore((s) => s.setInkColor);
  const setInkWidth = useBoardStore((s) => s.setInkWidth);
  const setInkPolygonSides = useBoardStore((s) => s.setInkPolygonSides);

  if (!globalInkMode) return null;

  function dispatchInkEvent(name: string) {
    window.dispatchEvent(new CustomEvent(name));
  }

  return (
    <div className="ink-toolbar" role="toolbar" aria-label="Herramientas de lienzo">
      <div className="ink-toolbar-header" title="Lienzo">
        <Shapes size={18} />
      </div>

      <div className="ink-toolbar-group" aria-label="Herramientas de dibujo">
        {DRAW_TOOLS.map((tool) => <InkToolButton key={tool.tool} {...tool} />)}
      </div>

      <div className="ink-toolbar-divider" />

      <div className="ink-toolbar-group" aria-label="Matemáticas y geometría">
        {MATH_TOOLS.map((tool) => <InkToolButton key={tool.tool} {...tool} />)}
      </div>

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
            onClick={() => setInkColor(color.value)}
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
            onClick={() => setInkWidth(width.value)}
          >
            <span className="ink-width-preview" style={{ height: width.value, background: inkColor }} />
          </button>
        ))}
      </div>

      <div className="ink-toolbar-divider" />

      <button type="button" className="ink-action-btn" title="Deshacer último elemento"
        aria-label="Deshacer último elemento" onClick={() => dispatchInkEvent("ink:undo")}>
        <Undo2 size={17} />
      </button>
      <button type="button" className="ink-action-btn danger" title="Borrar lienzo"
        aria-label="Borrar lienzo" onClick={() => { if (confirm("¿Borrar todos los elementos del lienzo?")) dispatchInkEvent("ink:clear"); }}>
        <Trash2 size={17} />
      </button>
      <button type="button" className="ink-exit-btn" title="Salir del modo lienzo"
        aria-label="Salir del modo lienzo" onClick={toggleGlobalInkMode}>
        <X size={18} />
      </button>
    </div>
  );
}
