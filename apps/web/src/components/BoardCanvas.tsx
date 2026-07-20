// Canvas del board: Stage Konva, selección/transformación, overlays HTML
// para iframes y capa de tinta global. El renderizado de cada widget vive
// en src/widgets/components/* y se resuelve via renderWidget().
import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Group, Layer, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { isAllowedEmbedUrl, type BoardDocument, type BoardElement, type BoardInkObject } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { getHubApp } from "../lib/hubApps";
import { renderWidget } from "../widgets/renderers";
import { withEmbedParams } from "../widgets/components/HubWidget";
import { GlobalInkLayer, renderInkObject } from "./GlobalInkLayer";

// Nombre de host legible para la tarjeta-lanzador (sin www.).
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// Escena WebGL de manipulativos 3D: chunk aparte, solo se descarga si el
// board contiene un widget mates3d.
const Mates3DSceneLazy = lazy(() => import("../three/Mates3DScene"));
// Editor de mapa mental: chunk aparte, solo si el board tiene un widget mindmap.
const MindMapCanvasLazy = lazy(() => import("./MindMapCanvas"));

type BoardCanvasProps = {
  /** Prop explícito para vistas de solo lectura (AulaView, ShareView) que
   * reciben el board por SSE. El editor (App.tsx) NO lo pasa: BoardCanvas
   * se suscribe directamente al store, aislándose de los re-renders de App. */
  board?: BoardDocument;
  readonly?: boolean;
  presentation?: boolean;
  liveControls?: boolean;
  /** Ref que recibe la función de captura del canvas (para grabación de sesión) */
  captureRef?: React.MutableRefObject<(() => string | null) | null>;
  /**
   * Modo invitado: true cuando el canvas se muestra a alumnos sin cuenta EDUmind
   * (AulaView). Los widgets Hub usan guestUrl en lugar de la URL autenticada.
   */
  guestMode?: boolean;
};

const LONG_PRESS_MS = 1500;
const EMPTY_INK: BoardInkObject[] = [];
// Umbral de imantado en px de pantalla para bordes/centros de otros elementos
const SNAP_THRESHOLD = 6;

function isInkContainerElement(element: BoardElement) {
  return ["grid", "guidelines", "table", "base10", "drawing", "fraction", "algorithm", "logic"].includes(element.type);
}

type SnapGuide = { orientation: "v" | "h"; position: number };

/** Calcula la posición imantada de un elemento contra bordes/centros del resto. */
function computeSnap(
  element: BoardElement,
  x: number,
  y: number,
  others: BoardElement[],
  threshold: number
): { x: number; y: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];
  let bestX: { delta: number; guide: number } | null = null;
  let bestY: { delta: number; guide: number } | null = null;

  const selfXs = [x, x + element.width / 2, x + element.width];
  const selfYs = [y, y + element.height / 2, y + element.height];

  for (const other of others) {
    const otherXs = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherYs = [other.y, other.y + other.height / 2, other.y + other.height];
    for (const sx of selfXs) {
      for (const ox of otherXs) {
        const delta = ox - sx;
        if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
          bestX = { delta, guide: ox };
        }
      }
    }
    for (const sy of selfYs) {
      for (const oy of otherYs) {
        const delta = oy - sy;
        if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
          bestY = { delta, guide: oy };
        }
      }
    }
  }

  if (bestX) guides.push({ orientation: "v", position: bestX.guide });
  if (bestY) guides.push({ orientation: "h", position: bestY.guide });
  return { x: x + (bestX?.delta ?? 0), y: y + (bestY?.delta ?? 0), guides };
}

type ElementNodeProps = {
  element: BoardElement;
  readonly: boolean;
  liveControls: boolean;
  onLongPress: (id: string) => void;
  onLiveFrameChange?: (element: BoardElement, frame: Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation">>) => void;
  onSnapDrag?: (element: BoardElement, x: number, y: number) => { x: number; y: number };
  guestMode: boolean;
  anchoredInk: BoardInkObject[];
};

// memo: un cambio en un elemento no re-renderiza los demás nodos del board.
const ElementNode = memo(function ElementNode({
  element, readonly, liveControls, onLongPress, onLiveFrameChange, onSnapDrag, guestMode, anchoredInk
}: ElementNodeProps) {
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const toggleSelectedId = useBoardStore((s) => s.toggleSelectedId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef(false);
  // Estado del arrastre en grupo: posiciones iniciales de la selección
  const groupDragRef = useRef<{ startX: number; startY: number; peers: Array<{ id: string; x: number; y: number }> } | null>(null);

  // El lienzo libre desactiva el arrastre cuando está en modo dibujo
  const isDrawMode = element.type === "drawing" && element.data.drawMode;

  function startLongPress() {
    touchMovedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) onLongPress(element.id);
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }

  function handleSelect(e: Konva.KonvaEventObject<MouseEvent | Event>) {
    e.cancelBubble = true;
    if (readonly) return;
    const shiftKey = "shiftKey" in e.evt ? Boolean((e.evt as MouseEvent).shiftKey) : false;
    if (shiftKey) toggleSelectedId(element.id);
    // Si el elemento ya forma parte de una multiselección, un clic simple no la
    // rompe (permite arrastrar el grupo). Solo selecciona en solitario si no.
    else if (!useBoardStore.getState().selectedIds.includes(element.id)) setSelectedId(element.id);
  }

  return (
    <Group id={element.id} x={element.x} y={element.y} rotation={element.rotation}
      opacity={element.opacity} draggable={!readonly && !element.locked && !isDrawMode}
      onClick={handleSelect}
      onTap={handleSelect}
      onTouchStart={() => { if (!readonly) startLongPress(); }}
      onTouchMove={() => { touchMovedRef.current = true; cancelLongPress(); }}
      onTouchEnd={cancelLongPress}
      onDragStart={(e) => {
        cancelLongPress();
        // Si hay varios seleccionados y este es uno, preparamos arrastre en grupo
        const { selectedIds, board } = useBoardStore.getState();
        if (selectedIds.length > 1 && selectedIds.includes(element.id) && board) {
          groupDragRef.current = {
            startX: e.target.x(),
            startY: e.target.y(),
            peers: selectedIds
              .filter((id) => id !== element.id)
              .map((id) => board.elements.find((el) => el.id === id))
              .filter((el): el is BoardElement => el !== undefined && !el.locked)
              .map((el) => ({ id: el.id, x: el.x, y: el.y }))
          };
        } else {
          groupDragRef.current = null;
        }
      }}
      onDragMove={(e) => {
        if (e.target.id() !== element.id) return;
        const group = groupDragRef.current;
        if (group) {
          // Arrastre en grupo: mueve los demás nodos en vivo por el mismo delta
          const ddx = e.target.x() - group.startX;
          const ddy = e.target.y() - group.startY;
          const stage = e.target.getStage();
          const elements = useBoardStore.getState().board?.elements;
          for (const peer of group.peers) {
            const node = stage?.findOne("#" + peer.id);
            node?.position({ x: peer.x + ddx, y: peer.y + ddy });
            const peerEl = elements?.find((el) => el.id === peer.id);
            if (peerEl) onLiveFrameChange?.(peerEl, { x: peer.x + ddx, y: peer.y + ddy });
          }
          onLiveFrameChange?.(element, { x: e.target.x(), y: e.target.y() });
          return;
        }
        let nextX = e.target.x();
        let nextY = e.target.y();
        if (onSnapDrag) {
          const snapped = onSnapDrag(element, nextX, nextY);
          if (snapped.x !== nextX || snapped.y !== nextY) {
            nextX = snapped.x;
            nextY = snapped.y;
            e.target.position({ x: nextX, y: nextY });
          }
        }
        onLiveFrameChange?.(element, { x: nextX, y: nextY });
      }}
      onDragEnd={(e) => {
        if (e.target.id() !== element.id) return;
        const group = groupDragRef.current;
        if (group) {
          const ddx = e.target.x() - group.startX;
          const ddy = e.target.y() - group.startY;
          groupDragRef.current = null;
          useBoardStore.getState().moveElementsBy(useBoardStore.getState().selectedIds, ddx, ddy);
        } else {
          updateElement(element.id, { x: e.target.x(), y: e.target.y() });
        }
      }}
    >
      {renderWidget(element, { liveControls, guestMode })}
      {anchoredInk.length > 0 && (
        <Group clipX={0} clipY={0} clipWidth={element.width} clipHeight={element.height} listening={false}>
          {anchoredInk.map((item, index) => renderInkObject(item, `${element.id}-ink-${index}`))}
        </Group>
      )}
    </Group>
  );
});

// ── BoardCanvas ──────────────────────────────────────────────────────────────
// memo: evita que re-renders de App.tsx (saveState, _history, recording, etc.)
// se propaguen al canvas durante un drag y reseteen la posición del Stage.

export const BoardCanvas = memo(function BoardCanvas({
  board: boardProp, readonly = false, presentation = false, liveControls = !readonly, captureRef, guestMode = false
}: BoardCanvasProps) {
  // Si viene prop (AulaView/ShareView via SSE) se usa directamente.
  // En el editor (App.tsx no pasa board) se suscribe al store.
  const storeBoard = useBoardStore((s) => s.board);
  const board = boardProp ?? storeBoard;
  const updateBoard = useBoardStore((s) => s.updateBoard);
  const updateElement = useBoardStore((s) => s.updateElement);
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const selectedId = useBoardStore((s) => s.selectedId);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds);
  const globalInkMode = useBoardStore((s) => s.globalInkMode);
  const inkTool = useBoardStore((s) => s.inkTool);
  const snapEnabled = useBoardStore((s) => s.snapEnabled);
  const marqueeMode = useBoardStore((s) => s.marqueeMode);

  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const pinchRef = useRef<{ distance: number; center: { x: number; y: number }; scale: number; x: number; y: number } | null>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  // isDragging como ref (no estado) — oculta iframes durante drag sin provocar re-renders
  const overlayDivRef = useRef<HTMLDivElement>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  // Rubber band de selección múltiple (Shift+arrastre en zona vacía)
  const rubberRef = useRef<{ x: number; y: number } | null>(null);
  const [rubberRect, setRubberRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Evita que el clic sintético tras un arrastre de marco borre la selección recién hecha
  const suppressStageClickRef = useRef(false);

  useEffect(() => {
    const measure = () => {
      const rect = shellRef.current?.getBoundingClientRect();
      setStageSize({
        width: Math.max(320, Math.round(rect?.width ?? window.innerWidth)),
        height: Math.max(240, Math.round(rect?.height ?? window.innerHeight))
      });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (shellRef.current) observer?.observe(shellRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () =>
      stageRef.current?.toDataURL({ mimeType: "image/jpeg", quality: 0.82 }) ?? null;
    return () => { if (captureRef) captureRef.current = null; };
  }, [captureRef]);

  useEffect(() => {
    const showOverlays = () => {
      if (overlayDivRef.current) {
        overlayDivRef.current.style.opacity = "1";
        overlayDivRef.current.style.transition = "opacity 0.1s";
      }
    };
    window.addEventListener("mouseup", showOverlays);
    window.addEventListener("touchend", showOverlays);
    window.addEventListener("touchcancel", showOverlays);
    return () => {
      window.removeEventListener("mouseup", showOverlays);
      window.removeEventListener("touchend", showOverlays);
      window.removeEventListener("touchcancel", showOverlays);
    };
  }, []);

  const boardElements = board?.elements;

  // Transformer sobre la selección (uno o varios nodos, sin bloqueados)
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const stage = stageRef.current;
    if (!stage || selectedIds.length === 0) { tr.nodes([]); tr.getLayer()?.batchDraw(); return; }
    const nodes = selectedIds
      .map((id) => {
        const el = boardElements?.find((e) => e.id === id);
        if (!el || el.locked) return null;
        return stage.findOne("#" + id) ?? null;
      })
      .filter((node): node is Konva.Node => Boolean(node));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, boardElements]);

  // Tinta anclada por elemento — referencias estables para no romper el memo de ElementNode
  const anchoredInkByElement = useMemo(() => {
    const map = new Map<string, BoardInkObject[]>();
    for (const item of board?.ink ?? []) {
      if (!item.anchorElementId) continue;
      const list = map.get(item.anchorElementId);
      if (list) list.push(item);
      else map.set(item.anchorElementId, [item]);
    }
    return map;
  }, [board?.ink]);

  // Callbacks estables para ElementNode (memo): la última versión vive en un ref
  const syncOverlayFrameRef = useRef<((el: BoardElement, frame: Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation">>) => void) | null>(null);
  const snapDragRef = useRef<((el: BoardElement, x: number, y: number) => { x: number; y: number }) | null>(null);

  const stableSyncOverlayFrame = useCallback(
    (el: BoardElement, frame: Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation">>) => {
      syncOverlayFrameRef.current?.(el, frame);
    },
    []
  );
  const stableSnapDrag = useCallback((el: BoardElement, x: number, y: number) => {
    return snapDragRef.current?.(el, x, y) ?? { x, y };
  }, []);
  const stableLongPress = useCallback((id: string) => {
    useBoardStore.getState().setSelectedId(id);
  }, []);

  if (!board) return null;

  const sortedElements = [...board.elements].sort((a, b) => a.zIndex - b.zIndex);
  const selectedInkAnchor = selectedId
    ? sortedElements.find((element) => element.id === selectedId && isInkContainerElement(element))
    : null;
  const inkAnchor = selectedInkAnchor
    ? {
        id: selectedInkAnchor.id,
        x: selectedInkAnchor.x,
        y: selectedInkAnchor.y,
        rotation: selectedInkAnchor.rotation
      }
    : null;
  const overlayShellStyle = (
    el: Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation" | "zIndex">
  ): CSSProperties => {
    const z = board.viewport.zoom;

    return {
      left: `${board.viewport.x + el.x * z}px`,
      top: `${board.viewport.y + el.y * z}px`,
      width: `${el.width * z}px`,
      height: `${el.height * z}px`,
      zIndex: el.zIndex,
      transform: `rotate(${el.rotation}deg)`,
      transformOrigin: "top left"
    };
  };

  const syncOverlayFrame = (
    el: BoardElement,
    frame: Partial<Pick<BoardElement, "x" | "y" | "width" | "height" | "rotation">>
  ) => {
    if (!["iframe", "file", "hub", "mates3d", "mindmap"].includes(el.type)) return;
    const shell = overlayDivRef.current?.querySelector(`[data-overlay-id="${el.id}"]`) as HTMLElement | null;
    if (!shell) return;
    const next = { ...el, ...frame };
    const shellStyle = overlayShellStyle(next);
    shell.style.left = String(shellStyle.left);
    shell.style.top = String(shellStyle.top);
    shell.style.width = String(shellStyle.width);
    shell.style.height = String(shellStyle.height);
    shell.style.transform = String(shellStyle.transform);

    const inner = shell.querySelector("iframe, .mates3d-frame") as HTMLElement | null;
    if (!inner) return;
    const frameStyle = overlayFrameStyle(next);
    inner.style.left = `${Number(frameStyle.left ?? 0)}px`;
    inner.style.top = `${Number(frameStyle.top ?? 0)}px`;
    inner.style.width = `${Number(frameStyle.width ?? 0)}px`;
    inner.style.height = `${Number(frameStyle.height ?? 0)}px`;
  };
  syncOverlayFrameRef.current = syncOverlayFrame;

  // Imantado durante drag: bordes y centros del resto de elementos
  snapDragRef.current = (el, x, y) => {
    if (!snapEnabled || readonly) return { x, y };
    const others = board.elements.filter((other) => other.id !== el.id && !selectedIds.includes(other.id));
    const threshold = SNAP_THRESHOLD / Math.max(0.15, board.viewport.zoom);
    const result = computeSnap(el, x, y, others, threshold);
    setSnapGuides((prev) => {
      if (prev.length === result.guides.length &&
        prev.every((g, i) => g.orientation === result.guides[i].orientation && g.position === result.guides[i].position)) {
        return prev;
      }
      return result.guides;
    });
    return { x: result.x, y: result.y };
  };

  const clearSnapGuides = () => setSnapGuides((prev) => (prev.length ? [] : prev));

  const overlayFrameStyle = (el: Pick<BoardElement, "id" | "type" | "width" | "height">): CSSProperties => {
    const z = board.viewport.zoom;
    const alwaysInteractive = el.type === "hub" || el.type === "mates3d" || el.type === "mindmap";
    const isInteractive = alwaysInteractive || readonly || presentation || selectedId === el.id;
    const topHandle = !readonly && !presentation && isInteractive ? Math.min(alwaysInteractive ? 42 : 28, el.height * 0.18) : 0;
    const sideHandle = !readonly && !presentation && isInteractive ? Math.min(alwaysInteractive ? 18 : 12, el.width * 0.08) : 0;

    return {
      left: sideHandle * z,
      top: topHandle * z,
      width: Math.max(24, (el.width - sideHandle * 2) * z),
      height: Math.max(24, (el.height - topHandle - sideHandle) * z),
      pointerEvents: isInteractive ? "auto" : "none"
    };
  };

  const overlayClassName = (id: string) => {
    const el = board.elements.find((element) => element.id === id);
    const selected = selectedId === id;
    const interactive = el?.type === "hub" || el?.type === "mates3d" || el?.type === "mindmap" || readonly || presentation || selected;
    return [
      "embed-overlay",
      selected ? "is-selected" : "",
      interactive ? "is-interactive" : ""
    ].filter(Boolean).join(" ");
  };

  const onWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    if (readonly) return;
    event.evt.preventDefault();
    const stage = event.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mp = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const next = Math.min(4, Math.max(0.15, event.evt.deltaY > 0 ? oldScale / 1.04 : oldScale * 1.04));
    updateBoard({ viewport: { x: pointer.x - mp.x * next, y: pointer.y - mp.y * next, zoom: next } });
  };

  const onTouchMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (globalInkMode || (readonly && boardProp)) return;
    const touches = event.evt.touches;
    if (touches.length !== 2) return;
    event.evt.preventDefault();

    const stage = event.target.getStage();
    if (!stage) return;
    const [a, b] = [touches[0], touches[1]];
    const center = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    if (!pinchRef.current) {
      pinchRef.current = {
        distance,
        center,
        scale: stage.scaleX(),
        x: stage.x(),
        y: stage.y()
      };
      stage.draggable(false);
      return;
    }

    const start = pinchRef.current;
    const next = Math.min(4, Math.max(0.15, start.scale * (distance / start.distance)));
    const boardPoint = {
      x: (start.center.x - start.x) / start.scale,
      y: (start.center.y - start.y) / start.scale
    };
    updateBoard({
      viewport: {
        x: center.x - boardPoint.x * next,
        y: center.y - boardPoint.y * next,
        zoom: next
      }
    });
  };

  const endTouchGesture = () => {
    pinchRef.current = null;
    stageRef.current?.draggable(!readonly && !globalInkMode && !marqueeMode);
  };

  // ── Rubber band: Shift+arrastre sobre zona vacía selecciona en área ────────
  const boardPointFromPointer = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const z = board.viewport.zoom;
    return { x: (pointer.x - board.viewport.x) / z, y: (pointer.y - board.viewport.y) / z };
  };

  // Marco de selección ("modo escritorio"): funciona con arrastre libre cuando
  // el modo selección está activo, o con Shift+arrastre en cualquier momento.
  // Soporta ratón y táctil (PDI).
  const beginMarquee = (onEmptyTarget: boolean) => {
    if (readonly || globalInkMode || !onEmptyTarget) return false;
    const point = boardPointFromPointer();
    if (!point) return false;
    rubberRef.current = point;
    setRubberRect({ x: point.x, y: point.y, width: 0, height: 0 });
    stageRef.current?.draggable(false);
    return true;
  };

  const updateMarquee = () => {
    if (!rubberRef.current) return;
    const point = boardPointFromPointer();
    if (!point) return;
    const start = rubberRef.current;
    setRubberRect({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y)
    });
  };

  const endMarquee = () => {
    const rect = rubberRect;
    rubberRef.current = null;
    setRubberRect(null);
    stageRef.current?.draggable(!readonly && !globalInkMode && !marqueeMode);
    if (!rect) return;
    // Un clic sin apenas movimiento no es marco: lo trata onClick (deseleccionar)
    if (rect.width <= 3 && rect.height <= 3) return;
    const within = board.elements.filter((el) =>
      el.x < rect.x + rect.width &&
      el.x + el.width > rect.x &&
      el.y < rect.y + rect.height &&
      el.y + el.height > rect.y
    );
    setSelectedIds(within.map((el) => el.id));
    suppressStageClickRef.current = true;
  };

  const isStageTarget = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => e.target === e.target.getStage();

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isStageTarget(e)) return;
    if (!marqueeMode && !e.evt.shiftKey) return;
    if (beginMarquee(true)) e.evt.preventDefault();
  };

  const onStageTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isStageTarget(e) || !marqueeMode) return;
    if (e.evt.touches.length !== 1) return;
    if (beginMarquee(true)) e.evt.preventDefault();
  };

  return (
    <div ref={shellRef} className={`canvas-shell ${!readonly && !presentation ? "has-editor-chrome" : ""} ${presentation ? "is-presentation" : ""} ${globalInkMode ? "ink-mode" : ""} ${globalInkMode && inkTool === "select" ? "ink-select-mode" : ""} ${marqueeMode ? "marquee-mode" : ""}`}>
      {/* Stage sin setIsDragging en onMouseDown: evita el re-render que causaba
          snap-back. Los overlays se controlan de forma imperativa (ref DOM). */}
      <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
        x={board.viewport.x} y={board.viewport.y}
        scaleX={board.viewport.zoom} scaleY={board.viewport.zoom}
        draggable={!readonly && !globalInkMode && !marqueeMode} onWheel={globalInkMode ? undefined : onWheel}
        onTouchStart={onStageTouchStart}
        onTouchMove={(e) => { if (rubberRef.current) updateMarquee(); else onTouchMove(e); }}
        onTouchEnd={() => { if (rubberRef.current) endMarquee(); else endTouchGesture(); }}
        onTouchCancel={() => { if (rubberRef.current) endMarquee(); else endTouchGesture(); }}
        onMouseDown={onStageMouseDown}
        onMouseMove={updateMarquee}
        onMouseUp={endMarquee}
        onDragStart={(e) => {
          if (e.target === e.target.getStage() && overlayDivRef.current) {
            overlayDivRef.current.style.opacity = "0";
            overlayDivRef.current.style.transition = "none";
          }
        }}
        onClick={(e) => {
          if (suppressStageClickRef.current) { suppressStageClickRef.current = false; return; }
          if (e.target === e.target.getStage() && !readonly && !e.evt.shiftKey) setSelectedId(null);
        }}
        onTap={(e) => {
          if (suppressStageClickRef.current) { suppressStageClickRef.current = false; return; }
          if (e.target === e.target.getStage() && !readonly) setSelectedId(null);
        }}
        onDragEnd={(e) => {
          if (overlayDivRef.current) {
            overlayDivRef.current.style.opacity = "1";
            overlayDivRef.current.style.transition = "opacity 0.1s";
          }
          clearSnapGuides();
          if (!readonly && e.target === e.target.getStage()) {
            updateBoard({ viewport: { x: e.target.x(), y: e.target.y(), zoom: board.viewport.zoom } });
          }
        }}
      >
        <Layer>
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill="rgba(250,248,244,0.01)" listening={false} />
          {sortedElements.map((el) => (
            <ElementNode key={el.id} element={el} readonly={readonly} liveControls={liveControls}
              onLongPress={stableLongPress} guestMode={guestMode}
              onLiveFrameChange={stableSyncOverlayFrame}
              onSnapDrag={stableSnapDrag}
              anchoredInk={anchoredInkByElement.get(el.id) ?? EMPTY_INK} />
          ))}
          {/* Guías de imantado durante drag */}
          {snapGuides.map((guide, index) => (
            <Rect key={`${guide.orientation}-${index}`} listening={false}
              x={guide.orientation === "v" ? guide.position - 0.5 : -5000}
              y={guide.orientation === "h" ? guide.position - 0.5 : -5000}
              width={guide.orientation === "v" ? 1 : 10000}
              height={guide.orientation === "h" ? 1 : 10000}
              fill="#c45d3e" opacity={0.85} />
          ))}
          {/* Rubber band de selección */}
          {rubberRect && (
            <Rect listening={false} x={rubberRect.x} y={rubberRect.y}
              width={rubberRect.width} height={rubberRect.height}
              fill="rgba(196,93,62,0.08)" stroke="#c45d3e" strokeWidth={1} dash={[6, 4]} />
          )}
          {!readonly && (
            <Transformer ref={trRef} keepRatio={false} rotateEnabled
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              anchorSize={14} anchorCornerRadius={4}
              anchorStroke="#c45d3e" anchorFill="#ffffff" anchorStrokeWidth={2}
              borderStroke="#c45d3e" borderDash={[6, 4]} borderStrokeWidth={2}
              onTransform={(e) => {
                const node = e.target;
                const id = node.id();
                const el = useBoardStore.getState().board?.elements.find((item) => item.id === id);
                if (!el) return;
                syncOverlayFrame(el, {
                  x: node.x(),
                  y: node.y(),
                  width: Math.max(40, Math.round(el.width * node.scaleX())),
                  height: Math.max(40, Math.round(el.height * node.scaleY())),
                  rotation: node.rotation()
                });
              }}
              onTransformEnd={(e) => {
                const node = e.target;
                const id = node.id();
                const sx = node.scaleX(), sy = node.scaleY();
                node.scaleX(1); node.scaleY(1);
                const el = useBoardStore.getState().board?.elements.find((el) => el.id === id);
                if (!el) return;
                updateElement(id, {
                  x: node.x(), y: node.y(),
                  width: Math.max(40, Math.round(el.width * sx)),
                  height: Math.max(40, Math.round(el.height * sy)),
                  rotation: node.rotation()
                });
              }}
            />
          )}
        </Layer>

        {/* Capa de tinta global persistente — se monta sobre todos los elementos del board */}
        {((board.ink?.length ?? 0) > 0 || (globalInkMode && !readonly)) && (
          <GlobalInkLayer
            active={globalInkMode && !readonly}
            objects={boardProp ? (board.ink ?? []) : undefined}
            anchor={globalInkMode && !readonly ? inkAnchor : null}
          />
        )}
      </Stage>

      {/* Overlays controlados imperativamente durante drag para evitar re-renders */}
      <div ref={overlayDivRef} className="iframe-overlays"
        style={{ opacity: 1, transition: "opacity 0.1s" }}>
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "iframe" }> => e.type === "iframe")
          .filter((e) => isAllowedEmbedUrl(e.data.url))
          .map((el) => (
            <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
              <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
              {el.data.mode === "launcher" ? (
                // Sitios que prohíben el framing (EVA/LMS): tarjeta con botón.
                <div className="embed-launcher" style={overlayFrameStyle(el)}>
                  <span className="embed-launcher-title">{el.data.title}</span>
                  <span className="embed-launcher-host">{hostOf(el.data.url)}</span>
                  <button type="button" className="embed-launcher-btn" onClick={() => openInNewTab(el.data.url)}>
                    Abrir en pestaña nueva ↗
                  </button>
                  <span className="embed-launcher-note">Este sitio no permite verse dentro del tablero</span>
                </div>
              ) : (
                <>
                  <iframe data-board-element-id={el.id} title={el.data.title} src={el.data.url}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    style={overlayFrameStyle(el)} />
                  {/* Botón de reserva: por si el frame sale en blanco (X-Frame-Options) */}
                  <button type="button" className="embed-open-reserve" title="Abrir en pestaña nueva"
                    aria-label="Abrir en pestaña nueva" onClick={() => openInNewTab(el.data.url)}>↗</button>
                </>
              )}
            </div>
          ))}
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "file" }> => e.type === "file")
          .filter((e) => e.data.kind === "pdf")
          .map((el) => (
            <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
              <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
              <iframe data-board-element-id={el.id} title={el.data.name} src={el.data.url}
                style={overlayFrameStyle(el)} />
            </div>
          ))}
        {/* Manipulativos matemáticos 3D → escena WebGL lazy */}
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "mates3d" }> => e.type === "mates3d")
          .map((el) => (
            <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
              <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
              <div className="mates3d-frame" style={overlayFrameStyle(el)}>
                <Suspense fallback={<div className="mates3d-loading">Cargando escena 3D…</div>}>
                  <Mates3DSceneLazy element={el} liveControls={liveControls} persist={!readonly && !boardProp} />
                </Suspense>
              </div>
            </div>
          ))}
        {/* Mapa mental / conceptual → editor HTML/SVG lazy */}
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "mindmap" }> => e.type === "mindmap")
          .map((el) => (
            <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
              <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
              <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
              <div className="mindmap-host" style={overlayFrameStyle(el)}>
                <Suspense fallback={<div className="mates3d-loading">Cargando mapa…</div>}>
                  <MindMapCanvasLazy element={el} liveControls={liveControls} persist={!readonly && !boardProp} />
                </Suspense>
              </div>
            </div>
          ))}
        {/* Hub widgets en modo embed → iframe de la app EDUmind.
            En guestMode usa guestUrl para acceso sin cuenta EDUmind. */}
        {sortedElements
          .filter((e): e is Extract<BoardElement, { type: "hub" }> => e.type === "hub" && e.data.mode === "embed")
          .map((el) => {
            const app = getHubApp(el.data.appId);
            if (!app) return null;
            const hubSrc = withEmbedParams((guestMode && app.guestUrl) ? app.guestUrl : app.url);
            return (
              <div key={el.id} data-overlay-id={el.id} className={overlayClassName(el.id)} style={overlayShellStyle(el)}>
                <div className="embed-move-handle embed-move-handle-top" aria-hidden="true" />
                <div className="embed-move-handle embed-move-handle-left" aria-hidden="true" />
                <div className="embed-move-handle embed-move-handle-right" aria-hidden="true" />
                <div className="embed-move-handle embed-move-handle-bottom" aria-hidden="true" />
                <iframe data-board-element-id={el.id} title={app.name} src={hubSrc}
                  allow="camera; microphone; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                  style={overlayFrameStyle(el)} />
              </div>
            );
          })}
      </div>
    </div>
  );
});
