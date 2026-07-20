// Editor de mapa mental/conceptual (overlay HTML+SVG, estilo CmapTools).
// Nodos arrastrables con texto editable en línea; enlaces curvos que se
// recalculan solos al mover; etiquetas de relación en modo conceptual;
// auto-organización radial. La geometría pura vive en lib/mindmap.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardElement, MindmapEdge, MindmapNode } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { newId } from "../lib/ids";
import { branchColor, edgePath, midpoint, nodeDepths, radialLayout, type Point } from "../lib/mindmap";

type MindmapElement = Extract<BoardElement, { type: "mindmap" }>;

type Props = {
  element: MindmapElement;
  liveControls: boolean;
  persist: boolean;
};

const NODE_TRIM_TARGET = 46; // recorte del enlace para que la flecha quede fuera del nodo
const NODE_TRIM_SOURCE = 10;

function trim(a: Point, b: Point, inset: number): Point {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const t = Math.min(inset, d * 0.4) / d;
  return { x: b.x - (b.x - a.x) * t, y: b.y - (b.y - a.y) * t };
}

export default function MindMapCanvas({ element, liveControls, persist }: Props) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const [nodes, setNodes] = useState<MindmapNode[]>(element.data.nodes);
  const [edges, setEdges] = useState<MindmapEdge[]>(element.data.edges);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);

  useEffect(() => { setNodes(element.data.nodes); }, [element.data.nodes]);
  useEffect(() => { setEdges(element.data.edges); }, [element.data.edges]);

  // Escala del contenido = ancho renderizado / ancho lógico del widget
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / Math.max(1, element.width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [element.width]);

  const editable = liveControls;
  const accent = element.data.accent;
  const variant = element.data.variant;

  const commit = useCallback((nextNodes: MindmapNode[], nextEdges: MindmapEdge[]) => {
    setNodes(nextNodes);
    setEdges(nextEdges);
    if (persist) updateElementData(element.id, { nodes: nextNodes, edges: nextEdges });
  }, [persist, updateElementData, element.id]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const center = (id: string): Point | null => {
    const n = nodeById.get(id);
    return n ? { x: n.x, y: n.y } : null;
  };

  // ── Arrastre de nodos (con umbral para distinguir de la edición) ──────────
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const onNodePointerDown = (e: React.PointerEvent, node: MindmapNode) => {
    if (!editable || editingId) return;
    if (linkMode) { handleLinkClick(node.id); return; }
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { id: node.id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y, moved: false };
  };

  const onNodePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setNodes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x: Math.round(d.origX + dx), y: Math.round(d.origY + dy) } : n)));
  };

  const onNodePointerUp = (e: React.PointerEvent, node: MindmapNode) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    e.stopPropagation();
    if (d.moved) {
      // Persiste la posición final leyendo el estado más reciente
      setNodes((prev) => { if (persist) updateElementData(element.id, { nodes: prev }); return prev; });
    } else if (editable && !linkMode) {
      setEditingId(node.id); // clic sin arrastre → editar
    }
  };

  // ── Enlazar nodos (modo conceptual/mapa) ──────────────────────────────────
  function handleLinkClick(nodeId: string) {
    if (!linkSource) { setLinkSource(nodeId); return; }
    if (linkSource === nodeId) { setLinkSource(null); return; }
    const exists = edges.some((edge) => edge.from === linkSource && edge.to === nodeId);
    if (!exists) {
      const edge: MindmapEdge = { id: newId(), from: linkSource, to: nodeId, label: "" };
      commit(nodes, [...edges, edge]);
      if (variant === "concept") setEditingEdgeId(edge.id);
    }
    setLinkSource(null);
  }

  // ── Alta / baja de nodos ──────────────────────────────────────────────────
  function addNode() {
    const node: MindmapNode = {
      id: newId(), text: "Idea",
      x: Math.round(element.width / 2 + (Math.random() * 80 - 40)),
      y: Math.round(element.height / 2 + (Math.random() * 80 - 40)),
      color: accent, shape: "rounded"
    };
    commit([...nodes, node], edges);
    setEditingId(node.id);
  }

  function addChild(parentId: string) {
    const parent = nodeById.get(parentId);
    if (!parent) return;
    const depth = (nodeDepths(nodes, edges).get(parentId) ?? 0) + 1;
    const siblings = edges.filter((edge) => edge.from === parentId).length;
    const node: MindmapNode = {
      id: newId(), text: "",
      x: Math.round(Math.max(60, Math.min(element.width - 60, parent.x + 170))),
      y: Math.round(Math.max(50, Math.min(element.height - 50, parent.y + (siblings - 1) * 84))),
      color: branchColor(depth, accent), shape: "rounded"
    };
    commit([...nodes, node], [...edges, { id: newId(), from: parentId, to: node.id, label: "" }]);
    setEditingId(node.id);
  }

  function deleteNode(id: string) {
    commit(nodes.filter((n) => n.id !== id), edges.filter((e) => e.from !== id && e.to !== id));
  }

  function commitNodeText(id: string, text: string) {
    commit(nodes.map((n) => (n.id === id ? { ...n, text: text.trim() || "Idea" } : n)), edges);
    setEditingId(null);
  }

  function commitEdgeLabel(id: string, label: string) {
    commit(nodes, edges.map((e) => (e.id === id ? { ...e, label: label.trim() } : e)));
    setEditingEdgeId(null);
  }

  function autoLayout() {
    const laid = radialLayout(nodes, edges, element.width / 2, element.height / 2);
    const depths = nodeDepths(laid, edges);
    const colored = laid.map((n) => ({ ...n, color: branchColor(depths.get(n.id) ?? 0, accent) }));
    commit(colored, edges);
  }

  return (
    <div ref={frameRef} className="mindmap-frame" style={{ background: element.data.background }}>
      <div className="mindmap-inner" style={{ width: element.width, height: element.height, transform: `scale(${scale})` }}>
        <svg className="mindmap-edges" width={element.width} height={element.height}>
          <defs>
            <marker id={`mm-arrow-${element.id}`} markerWidth="10" markerHeight="10" refX="7" refY="3"
              orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3 L0,6 Z" fill="#8a99a6" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const a = center(edge.from);
            const b = center(edge.to);
            if (!a || !b) return null;
            const start = trim(b, a, NODE_TRIM_SOURCE);
            const end = trim(a, b, NODE_TRIM_TARGET);
            return (
              <path key={edge.id} d={edgePath(start, end, element.data.edgeStyle)}
                fill="none" stroke="#8a99a6" strokeWidth={2}
                markerEnd={`url(#mm-arrow-${element.id})`} />
            );
          })}
        </svg>

        {/* Etiquetas de relación (mapa conceptual) */}
        {variant === "concept" && edges.map((edge) => {
          const a = center(edge.from);
          const b = center(edge.to);
          if (!a || !b) return null;
          const m = midpoint(a, b);
          if (editingEdgeId === edge.id) {
            return (
              <input key={edge.id} className="mindmap-edge-input" autoFocus defaultValue={edge.label}
                style={{ left: m.x, top: m.y }}
                onBlur={(ev) => commitEdgeLabel(edge.id, ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
            );
          }
          if (!edge.label && !editable) return null;
          return (
            <button key={edge.id} type="button" className={`mindmap-edge-label ${edge.label ? "" : "is-empty"}`}
              style={{ left: m.x, top: m.y }}
              onDoubleClick={() => editable && setEditingEdgeId(edge.id)}
              onClick={() => editable && setEditingEdgeId(edge.id)}>
              {edge.label || "+"}
            </button>
          );
        })}

        {/* Nodos */}
        {nodes.map((node) => {
          const isEditing = editingId === node.id;
          const isLinkSource = linkSource === node.id;
          return (
            <div key={node.id}
              className={`mindmap-node shape-${node.shape} ${isLinkSource ? "is-link-source" : ""} ${linkMode ? "is-linkable" : ""}`}
              style={{ left: node.x, top: node.y, borderColor: node.color, boxShadow: `0 6px 18px ${node.color}22` }}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              onPointerMove={onNodePointerMove}
              onPointerUp={(e) => onNodePointerUp(e, node)}
            >
              <span className="mindmap-node-bar" style={{ background: node.color }} />
              {isEditing ? (
                <textarea className="mindmap-node-edit" autoFocus defaultValue={node.text}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => commitNodeText(node.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} />
              ) : (
                <span className="mindmap-node-text">{node.text || "…"}</span>
              )}
              {editable && !linkMode && !isEditing && (
                <span className="mindmap-node-actions">
                  <button type="button" title="Añadir idea enlazada" onClick={(e) => { e.stopPropagation(); addChild(node.id); }}>＋</button>
                  <button type="button" title="Eliminar" onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}>×</button>
                </span>
              )}
            </div>
          );
        })}

        {nodes.length === 0 && (
          <div className="mindmap-empty">Pulsa «+ Idea» para empezar el mapa</div>
        )}
      </div>

      {/* Barra de herramientas del mapa */}
      {editable && (
        <div className="mindmap-toolbar">
          <button type="button" onClick={addNode}>+ Idea</button>
          <button type="button" onClick={autoLayout} disabled={nodes.length < 2}>Auto-organizar</button>
          <button type="button" className={linkMode ? "is-active" : ""}
            onClick={() => { setLinkMode((v) => !v); setLinkSource(null); }}>
            {linkMode ? (linkSource ? "Elige destino…" : "Enlazando…") : "Enlazar"}
          </button>
          <button type="button"
            onClick={() => persist && updateElementData(element.id, { variant: variant === "mindmap" ? "concept" : "mindmap" })}>
            {variant === "mindmap" ? "Mental" : "Conceptual"}
          </button>
        </div>
      )}
    </div>
  );
}
