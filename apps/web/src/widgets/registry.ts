import {
  AlignLeft,
  ArrowRight,
  Calculator,
  Clock,
  Cuboid,
  Dices,
  Divide,
  FileText,
  Grid2x2,
  Image,
  Images,
  LayoutGrid,
  Hash,
  MessageSquareText,
  Mic,
  Network,
  Puzzle,
  QrCode,
  RefreshCw,
  Smartphone,
  StickyNote,
  TrafficCone,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BoardElementType } from "@edumind-board/shared";

export type WidgetCategoryId = "aula" | "contenido" | "manipulativos";

export type WidgetDefinition = {
  type: BoardElementType;
  label: string;
  icon: LucideIcon;
  category: WidgetCategoryId;
  featured?: boolean;
};

export type WidgetGroup = {
  id: WidgetCategoryId;
  label: string;
  icon: LucideIcon;
  widgets: WidgetDefinition[];
};

export const WIDGETS: WidgetDefinition[] = [
  { type: "semaphore", label: "Semáforo", icon: TrafficCone, category: "aula", featured: true },
  { type: "timer", label: "Timer", icon: Clock, category: "aula", featured: true },
  { type: "clock", label: "Reloj", icon: Clock, category: "aula" },
  { type: "dice", label: "Dado", icon: Dices, category: "aula" },
  { type: "spinner", label: "Ruleta", icon: RefreshCw, category: "aula" },
  { type: "dictadoNum", label: "Dictado numérico", icon: Hash, category: "aula", featured: true },

  { type: "note", label: "Nota", icon: StickyNote, category: "contenido", featured: true },
  { type: "text", label: "Texto", icon: FileText, category: "contenido" },
  { type: "image", label: "Imagen", icon: Image, category: "contenido" },
  { type: "comment", label: "Comentario", icon: MessageSquareText, category: "contenido" },
  { type: "connector", label: "Flecha", icon: ArrowRight, category: "contenido" },
  { type: "flow", label: "Diagrama", icon: Workflow, category: "contenido" },
  { type: "mindmap", label: "Mapa mental", icon: Network, category: "contenido", featured: true },

  { type: "guidelines", label: "Pauta", icon: AlignLeft, category: "manipulativos" },
  { type: "math", label: "Mate", icon: Calculator, category: "manipulativos" },
  { type: "mates3d", label: "Mates 3D", icon: Cuboid, category: "manipulativos", featured: true },
  { type: "base10", label: "Base 10", icon: Cuboid, category: "manipulativos", featured: true },
  { type: "fraction", label: "Fracción", icon: Divide, category: "manipulativos", featured: true },
  { type: "algorithm", label: "Algoritmo", icon: Calculator, category: "manipulativos" },
  { type: "logic", label: "Lógica", icon: Puzzle, category: "manipulativos" },
  { type: "grid", label: "Cuadrícula", icon: Grid2x2, category: "manipulativos" },
  { type: "table", label: "Tabla", icon: LayoutGrid, category: "manipulativos" },
  { type: "pictos", label: "Pictos", icon: Images, category: "manipulativos" },
  { type: "noise", label: "Ruido", icon: Mic, category: "manipulativos" },
  { type: "qr", label: "QR", icon: QrCode, category: "manipulativos" },
  { type: "hub", label: "App Hub", icon: Smartphone, category: "manipulativos" }
];

const GROUP_META: Array<Omit<WidgetGroup, "widgets">> = [
  { id: "aula", label: "Aula", icon: TrafficCone },
  { id: "contenido", label: "Contenido", icon: StickyNote },
  { id: "manipulativos", label: "Manipulativos", icon: Cuboid }
];

export const WIDGET_GROUPS: WidgetGroup[] = GROUP_META.map((group) => ({
  ...group,
  widgets: WIDGETS.filter((widget) => widget.category === group.id)
}));

export function getWidgetDefinition(type: BoardElementType) {
  return WIDGETS.find((widget) => widget.type === type);
}

export function getWidgetDefinitions(types: BoardElementType[]) {
  return types
    .map((type) => getWidgetDefinition(type))
    .filter((widget): widget is WidgetDefinition => Boolean(widget));
}
