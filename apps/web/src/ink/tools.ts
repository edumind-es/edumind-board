import {
  Box,
  Circle,
  Cone,
  Cuboid,
  Cylinder,
  DraftingCompass,
  Eraser,
  Grid3X3,
  Hexagon,
  Minus,
  MousePointer2,
  Pencil,
  Ruler,
  Square,
  Triangle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InkTool } from "../lib/store";

export type InkToolCategoryId = "draw" | "geometry" | "manipulatives" | "solids";

export type InkToolDefinition = {
  tool: InkTool;
  label: string;
  icon: LucideIcon;
  category: InkToolCategoryId;
  requiresPolygonSides?: boolean;
};

export type InkToolGroup = {
  id: InkToolCategoryId;
  label: string;
  tools: InkToolDefinition[];
};

export const INK_TOOLS: InkToolDefinition[] = [
  { tool: "select", label: "Seleccionar", icon: MousePointer2, category: "draw" },
  { tool: "pen", label: "Lápiz", icon: Pencil, category: "draw" },
  { tool: "eraser", label: "Borrador", icon: Eraser, category: "draw" },
  { tool: "line", label: "Línea", icon: Minus, category: "draw" },
  { tool: "rect", label: "Rectángulo", icon: Square, category: "draw" },
  { tool: "ellipse", label: "Círculo", icon: Circle, category: "draw" },
  { tool: "triangle", label: "Triángulo", icon: Triangle, category: "draw" },

  { tool: "angle", label: "Crear ángulo", icon: DraftingCompass, category: "geometry" },
  { tool: "angleMeasure", label: "Medir ángulo", icon: Ruler, category: "geometry" },
  { tool: "polygon", label: "Polígono regular", icon: Hexagon, category: "geometry", requiresPolygonSides: true },
  { tool: "hexagon", label: "Hexágono", icon: Hexagon, category: "geometry" },

  { tool: "baseUnit", label: "Base 10: unidad", icon: Square, category: "manipulatives" },
  { tool: "baseRod", label: "Base 10: decena", icon: Minus, category: "manipulatives" },
  { tool: "baseFlat", label: "Base 10: centena", icon: Grid3X3, category: "manipulatives" },

  { tool: "cube", label: "Cubo", icon: Cuboid, category: "solids" },
  { tool: "pyramid", label: "Pirámide (n lados)", icon: Box, category: "solids", requiresPolygonSides: true },
  { tool: "triangularPrism", label: "Prisma (n lados)", icon: Box, category: "solids", requiresPolygonSides: true },
  { tool: "cylinder", label: "Cilindro", icon: Cylinder, category: "solids" },
  { tool: "cone", label: "Cono", icon: Cone, category: "solids" },
  { tool: "sphere", label: "Esfera", icon: Circle, category: "solids" }
];

const GROUP_LABELS: Record<InkToolCategoryId, string> = {
  draw: "Dibujo",
  geometry: "Geometría",
  manipulatives: "Manipulativos",
  solids: "Sólidos"
};

export const INK_TOOL_GROUPS: InkToolGroup[] = (Object.keys(GROUP_LABELS) as InkToolCategoryId[]).map((id) => ({
  id,
  label: GROUP_LABELS[id],
  tools: INK_TOOLS.filter((tool) => tool.category === id)
}));

export function getInkToolDefinition(tool: InkTool) {
  return INK_TOOLS.find((definition) => definition.tool === tool);
}
