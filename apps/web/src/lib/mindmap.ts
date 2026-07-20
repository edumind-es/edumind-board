// Motor puro del mapa mental/conceptual: geometría de enlaces y auto-layout.
// Sin dependencias de React/DOM. Las coordenadas de nodo (x, y) representan el
// CENTRO del nodo, en px locales del widget.
import type { MindmapEdge, MindmapNode } from "@edumind-board/shared";

export type Point = { x: number; y: number };

// Paleta por ramas — colores EDUmind, legibles sobre fondo claro.
export const MINDMAP_PALETTE = [
  "#2a7a6d", "#c45d3e", "#1a5fa8", "#8b5cf6", "#e0a72e", "#2f9f72", "#d94b3d", "#0f8f83"
];

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Trazado SVG de un enlace entre dos centros de nodo. */
export function edgePath(a: Point, b: Point, style: "curved" | "elbow" | "straight"): string {
  if (style === "straight") return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  if (style === "elbow") {
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
  }
  // Curva Bézier con salida/entrada horizontal (aspecto de mapa mental)
  const dx = Math.max(30, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

function adjacency(nodes: MindmapNode[], edges: MindmapEdge[]) {
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) { children.set(node.id, []); indegree.set(node.id, 0); }
  for (const edge of edges) {
    if (children.has(edge.from) && children.has(edge.to)) {
      children.get(edge.from)!.push(edge.to);
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }
  }
  return { children, indegree };
}

/** Raíz del mapa: primer nodo sin enlaces entrantes; si no, el primero. */
export function rootNode(nodes: MindmapNode[], edges: MindmapEdge[]): MindmapNode | null {
  if (nodes.length === 0) return null;
  const { indegree } = adjacency(nodes, edges);
  return nodes.find((node) => (indegree.get(node.id) ?? 0) === 0) ?? nodes[0];
}

/**
 * Auto-organización radial: la raíz al centro, cada nivel en un anillo, los
 * hijos repartidos en el sector angular de su padre. Devuelve nodos recolocados.
 */
export function radialLayout(
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  cx: number,
  cy: number,
  ringGap = 180
): MindmapNode[] {
  const root = rootNode(nodes, edges);
  if (!root) return nodes;
  const { children } = adjacency(nodes, edges);
  const pos = new Map<string, Point>([[root.id, { x: cx, y: cy }]]);
  const visited = new Set<string>([root.id]);

  const place = (id: string, depth: number, a0: number, a1: number) => {
    const kids = (children.get(id) ?? []).filter((k) => !visited.has(k));
    if (kids.length === 0) return;
    const step = (a1 - a0) / kids.length;
    kids.forEach((kid, index) => {
      visited.add(kid);
      const angle = a0 + step * (index + 0.5);
      const r = ringGap * depth;
      pos.set(kid, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      place(kid, depth + 1, angle - step / 2, angle + step / 2);
    });
  };
  place(root.id, 1, -Math.PI / 2, Math.PI * 1.5);

  // Nodos desconectados: se reparten en una franja inferior
  let loose = 0;
  for (const node of nodes) {
    if (!pos.has(node.id)) {
      pos.set(node.id, { x: cx + (loose % 5 - 2) * 170, y: cy + (Math.floor(loose / 5) + 3) * 150 });
      loose += 1;
    }
  }

  return nodes.map((node) => {
    const p = pos.get(node.id)!;
    return { ...node, x: Math.round(p.x), y: Math.round(p.y) };
  });
}

/** Profundidad de cada nodo desde la raíz (para colorear por rama/nivel). */
export function nodeDepths(nodes: MindmapNode[], edges: MindmapEdge[]): Map<string, number> {
  const root = rootNode(nodes, edges);
  const depths = new Map<string, number>();
  if (!root) return depths;
  const { children } = adjacency(nodes, edges);
  const queue: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }];
  depths.set(root.id, 0);
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    for (const kid of children.get(id) ?? []) {
      if (!depths.has(kid)) { depths.set(kid, depth + 1); queue.push({ id: kid, depth: depth + 1 }); }
    }
  }
  return depths;
}

export function branchColor(depth: number, accent: string) {
  if (depth <= 0) return accent;
  return MINDMAP_PALETTE[(depth - 1) % MINDMAP_PALETTE.length];
}
