import { create } from "zustand";
import type { BoardDocument, BoardElement, BoardInkObject, ThemeName } from "@edumind-board/shared";
import { createConnectorAnclado, createElement } from "./boardFactory";
import { marcoEntreCajas, reanclarConectores } from "./conectores";
import { newId } from "./ids";

type SaveState = "local" | "dirty" | "publishing" | "published" | "error";
export type InkTool =
  | "select"
  | "pen"
  | "eraser"
  | "line"
  | "rect"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "angle"
  | "angleMeasure"
  | "baseUnit"
  | "baseRod"
  | "baseFlat"
  | "hexagon"
  | "cube"
  | "pyramid"
  | "triangularPrism"
  | "cylinder"
  | "cone"
  | "sphere";

// Máximo de pasos en el historial de deshacer
const MAX_HISTORY = 25;

// Snapshot de historial: elementos + tinta (Ctrl+Z deshace ambos)
type HistoryEntry = {
  elements: BoardElement[];
  ink: BoardInkObject[];
};

// Portapapeles interno de elementos (módulo, no estado: no provoca renders)
let elementClipboard: BoardElement[] = [];

type BoardState = {
  board: BoardDocument | null;
  /** Último elemento seleccionado (para Inspector y overlays). */
  selectedId: string | null;
  /** Selección completa; selectedId es siempre el último de esta lista. */
  selectedIds: string[];
  saveState: SaveState;
  shareToken: string | null;
  _history: HistoryEntry[];
  _historyIndex: number;
  // Imantado a bordes/centros durante drag
  snapEnabled: boolean;
  // Modo selección "escritorio": arrastrar en vacío dibuja un marco que
  // selecciona varios widgets (sin necesidad de Shift) y desactiva el paneo.
  marqueeMode: boolean;
  // Modo lienzo global — UI ephemera, no se persiste en el board
  globalInkMode: boolean;
  inkTool: InkTool;
  inkColor: string;
  inkWidth: number;
  inkPolygonSides: number;
  selectedInkIndex: number | null;

  setBoard: (board: BoardDocument) => void;
  setSelectedId: (id: string | null) => void;
  toggleSelectedId: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  setSaveState: (saveState: SaveState) => void;
  setShareToken: (token: string | null) => void;
  updateBoard: (patch: Partial<BoardDocument>) => void;
  addElement: (type: BoardElement["type"]) => void;
  addElementObject: (element: BoardElement) => void;
  upsertMusica: (element: BoardElement) => void;
  addInkObject: (object: BoardInkObject) => void;
  setInkObjects: (objects: BoardInkObject[]) => void;
  setSelectedInkIndex: (index: number | null) => void;
  updateSelectedInkStyle: (style: Partial<Pick<BoardInkObject, "color" | "width">>) => void;
  deleteSelectedInk: () => void;
  duplicateSelectedInk: () => void;
  bringSelectedInkToFront: () => void;
  sendSelectedInkToBack: () => void;
  updateElement: (id: string, patch: Partial<BoardElement>) => void;
  updateElementData: (id: string, data: Record<string, unknown>) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  /** Mueve en bloque los elementos indicados (un único paso de historial). */
  moveElementsBy: (ids: string[], dx: number, dy: number) => void;
  /** Conexión rápida: crea una flecha anclada entre dos elementos. */
  conectarElementos: (origenId: string, destinoId: string) => void;
  copySelected: () => number;
  cutSelected: () => number;
  pasteClipboard: () => number;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setTheme: (theme: ThemeName) => void;
  undo: () => void;
  redo: () => void;
  toggleSnap: () => void;
  toggleMarqueeMode: () => void;
  setMarqueeMode: (enabled: boolean) => void;
  toggleGlobalInkMode: () => void;
  setGlobalInkMode: (enabled: boolean) => void;
  setInkTool: (tool: InkTool) => void;
  setInkColor: (color: string) => void;
  setInkWidth: (width: number) => void;
  setInkPolygonSides: (sides: number) => void;
};

function touch(board: BoardDocument): BoardDocument {
  return { ...board, updatedAt: new Date().toISOString() };
}

// Inserta un snapshot (elementos + tinta) en el historial
function pushHistory(
  history: HistoryEntry[],
  index: number,
  elements: BoardElement[],
  ink: BoardInkObject[]
): { _history: HistoryEntry[]; _historyIndex: number } {
  const next = history.slice(0, index + 1);
  next.push({ elements: [...elements], ink: [...ink] });
  if (next.length > MAX_HISTORY) next.shift();
  return { _history: next, _historyIndex: next.length - 1 };
}

function cloneElementWithOffset(element: BoardElement, offset: number, zIndex: number): BoardElement {
  return { ...element, id: newId(), x: element.x + offset, y: element.y + offset, zIndex } as BoardElement;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  selectedId: null,
  selectedIds: [],
  saveState: "local",
  shareToken: null,
  _history: [],
  _historyIndex: -1,
  snapEnabled: true,
  marqueeMode: false,
  globalInkMode: false,
  inkTool: "pen",
  inkColor: "#1c1a16",
  inkWidth: 4,
  inkPolygonSides: 5,
  selectedInkIndex: null,

  // Al cargar un board nuevo se resetea el historial y el modo lienzo
  setBoard: (board) =>
    set({
      board,
      selectedId: null,
      selectedIds: [],
      selectedInkIndex: null,
      saveState: "local",
      _history: [{ elements: [...board.elements], ink: [...(board.ink ?? [])] }],
      _historyIndex: 0,
      globalInkMode: false
    }),

  setSelectedId: (selectedId) =>
    set({ selectedId, selectedIds: selectedId ? [selectedId] : [] }),

  toggleSelectedId: (id) =>
    set((state) => {
      const exists = state.selectedIds.includes(id);
      const selectedIds = exists
        ? state.selectedIds.filter((value) => value !== id)
        : [...state.selectedIds, id];
      return { selectedIds, selectedId: selectedIds[selectedIds.length - 1] ?? null };
    }),

  setSelectedIds: (ids) =>
    set({ selectedIds: ids, selectedId: ids[ids.length - 1] ?? null }),

  setSaveState: (saveState) => set({ saveState }),
  setShareToken: (shareToken) => set({ shareToken }),

  updateBoard: (patch) =>
    set((state) =>
      state.board ? { board: touch({ ...state.board, ...patch }), saveState: "dirty" } : state
    ),

  addElement: (type) =>
    set((state) => {
      if (!state.board) return state;
      const element = createElement(type);
      const elements = [...state.board.elements, element];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: element.id,
        selectedIds: [element.id],
        saveState: "dirty"
      };
    }),

  addElementObject: (element) =>
    set((state) => {
      if (!state.board) return state;
      const elements = [...state.board.elements, element];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: element.id,
        selectedIds: [element.id],
        saveState: "dirty"
      };
    }),

  // La musica no se acumula: cada vez que se elige un modo se REEMPLAZA el
  // reproductor que ya hubiera, conservando donde estaba y su tamano. Antes
  // cada clic en «Musica» dejaba otro widget encima y el tablero se llenaba.
  upsertMusica: (element) =>
    set((state) => {
      if (!state.board) return state;
      const esMusica = (e: BoardElement) =>
        e.type === "musica" ||
        (e.type === "iframe" && e.data.title.startsWith("Música · "));
      const anterior = state.board.elements.find(esMusica);

      const elements = anterior
        ? state.board.elements.map((e) =>
            e === anterior
              ? ({
                  ...element,
                  // Se queda donde el docente lo habia puesto.
                  id: anterior.id,
                  x: anterior.x,
                  y: anterior.y,
                  width: anterior.width,
                  height: anterior.height,
                  zIndex: anterior.zIndex
                } as BoardElement)
              : e
          )
        : [...state.board.elements, element];

      const vivo = anterior ? anterior.id : element.id;
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: vivo,
        selectedIds: [vivo],
        saveState: "dirty"
      };
    }),

  addInkObject: (object) =>
    set((state) => {
      if (!state.board) return state;
      const ink = [...(state.board.ink ?? []), object].slice(-1000);
      return {
        ...pushHistory(state._history, state._historyIndex, state.board.elements, ink),
        board: touch({ ...state.board, ink }),
        selectedInkIndex: null,
        saveState: "dirty"
      };
    }),

  // setInkObjects se usa en flujos continuos (borrador) — no hace push por sí solo
  setInkObjects: (objects) =>
    set((state) =>
      state.board ? {
        board: touch({ ...state.board, ink: objects.slice(-1000) }),
        selectedInkIndex: state.selectedInkIndex !== null && state.selectedInkIndex >= objects.length ? null : state.selectedInkIndex,
        saveState: "dirty"
      } : state
    ),

  setSelectedInkIndex: (selectedInkIndex) => set({ selectedInkIndex }),

  updateSelectedInkStyle: (style) =>
    set((state) => {
      if (!state.board || state.selectedInkIndex === null) return state;
      const ink = state.board.ink ?? [];
      const selected = ink[state.selectedInkIndex];
      if (!selected) return state;
      const nextInk = ink.map((item, index) =>
        index === state.selectedInkIndex ? ({ ...item, ...style } as BoardInkObject) : item
      );
      return {
        board: touch({ ...state.board, ink: nextInk }),
        saveState: "dirty"
      };
    }),

  deleteSelectedInk: () =>
    set((state) => {
      if (!state.board || state.selectedInkIndex === null) return state;
      const ink = state.board.ink ?? [];
      if (!ink[state.selectedInkIndex]) return state;
      const nextInk = ink.filter((_, index) => index !== state.selectedInkIndex);
      return {
        ...pushHistory(state._history, state._historyIndex, state.board.elements, nextInk),
        board: touch({ ...state.board, ink: nextInk }),
        selectedInkIndex: null,
        saveState: "dirty"
      };
    }),

  duplicateSelectedInk: () =>
    set((state) => {
      if (!state.board || state.selectedInkIndex === null) return state;
      const ink = state.board.ink ?? [];
      const selected = ink[state.selectedInkIndex];
      if (!selected) return state;
      const clone = selected.kind === "stroke"
        ? { ...selected, points: selected.points.map((value, index) => value + (index % 2 === 0 ? 24 : 24)) }
        : { ...selected, x: selected.x + 24, y: selected.y + 24 };
      const nextInk = [...ink, clone as BoardInkObject].slice(-1000);
      return {
        ...pushHistory(state._history, state._historyIndex, state.board.elements, nextInk),
        board: touch({ ...state.board, ink: nextInk }),
        selectedInkIndex: nextInk.length - 1,
        saveState: "dirty"
      };
    }),

  bringSelectedInkToFront: () =>
    set((state) => {
      if (!state.board || state.selectedInkIndex === null) return state;
      const ink = [...(state.board.ink ?? [])];
      const [selected] = ink.splice(state.selectedInkIndex, 1);
      if (!selected) return state;
      ink.push(selected);
      return {
        board: touch({ ...state.board, ink }),
        selectedInkIndex: ink.length - 1,
        saveState: "dirty"
      };
    }),

  sendSelectedInkToBack: () =>
    set((state) => {
      if (!state.board || state.selectedInkIndex === null) return state;
      const ink = [...(state.board.ink ?? [])];
      const [selected] = ink.splice(state.selectedInkIndex, 1);
      if (!selected) return state;
      ink.unshift(selected);
      return {
        board: touch({ ...state.board, ink }),
        selectedInkIndex: 0,
        saveState: "dirty"
      };
    }),

  // updateElement hace push de historial (cubre drag y Transformer)
  updateElement: (id, patch) =>
    set((state) => {
      if (!state.board) return state;
      const movidos = state.board.elements.map((element) =>
        element.id === id ? ({ ...element, ...patch } as BoardElement) : element
      );
      // Las flechas ancladas a este elemento se recolocan solas.
      const elements = reanclarConectores(movidos, [id]);
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        saveState: "dirty"
      };
    }),

  // updateElementData NO hace push (evitar flood por tipeo continuo)
  updateElementData: (id, data) =>
    set((state) => {
      if (!state.board) return state;
      return {
        board: touch({
          ...state.board,
          elements: state.board.elements.map((element) =>
            element.id === id
              ? ({ ...element, data: { ...element.data, ...data } } as BoardElement)
              : element
          )
        }),
        saveState: "dirty"
      };
    }),

  removeSelected: () =>
    set((state) => {
      if (!state.board || state.selectedIds.length === 0) return state;
      const selectedSet = new Set(state.selectedIds);
      const elements = state.board.elements.filter((element) => !selectedSet.has(element.id));
      if (elements.length === state.board.elements.length) return state;
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: null,
        selectedIds: [],
        saveState: "dirty"
      };
    }),

  moveElementsBy: (ids, dx, dy) =>
    set((state) => {
      if (!state.board || ids.length === 0 || (dx === 0 && dy === 0)) return state;
      const moving = new Set(ids);
      const movidos = state.board.elements.map((element) =>
        moving.has(element.id) ? ({ ...element, x: element.x + dx, y: element.y + dy } as BoardElement) : element
      );
      const elements = reanclarConectores(movidos, moving);
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        saveState: "dirty"
      };
    }),

  // Conexión rápida entre dos elementos: la flecha nace ya colocada y anclada.
  // Antes había que añadir el widget «Flecha» y encajarlo a mano entre las dos
  // cajas, que es justo lo que hacía inviable montar un diagrama en clase.
  conectarElementos: (origenId, destinoId) =>
    set((state) => {
      if (!state.board || origenId === destinoId) return state;
      const origen = state.board.elements.find((element) => element.id === origenId);
      const destino = state.board.elements.find((element) => element.id === destinoId);
      if (!origen || !destino) return state;
      // Una flecha no puede ser extremo de otra: el reanclado entraría en bucle.
      if (origen.type === "connector" || destino.type === "connector") return state;
      const yaExiste = state.board.elements.some(
        (element) =>
          element.type === "connector" &&
          element.data.anclaDesde === origenId &&
          element.data.anclaHasta === destinoId
      );
      if (yaExiste) return state;

      const zIndex = Math.max(0, ...state.board.elements.map((element) => element.zIndex)) + 1;
      const conector = createConnectorAnclado(marcoEntreCajas(origen, destino), origenId, destinoId, zIndex);
      const elements = [...state.board.elements, conector];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: conector.id,
        selectedIds: [conector.id],
        saveState: "dirty"
      };
    }),

  duplicateSelected: () =>
    set((state) => {
      if (!state.board || state.selectedIds.length === 0) return state;
      const selectedSet = new Set(state.selectedIds);
      const originals = state.board.elements.filter((e) => selectedSet.has(e.id));
      if (originals.length === 0) return state;
      let maxZ = state.board.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const clones = originals.map((original) => cloneElementWithOffset(original, 24, ++maxZ));
      const elements = [...state.board.elements, ...clones] as BoardElement[];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: clones[clones.length - 1].id,
        selectedIds: clones.map((clone) => clone.id),
        saveState: "dirty"
      };
    }),

  copySelected: (): number => {
    const state = get();
    if (!state.board || state.selectedIds.length === 0) return 0;
    const selectedSet = new Set(state.selectedIds);
    elementClipboard = state.board.elements
      .filter((element) => selectedSet.has(element.id))
      .map((element) => ({ ...element }));
    return elementClipboard.length;
  },

  cutSelected: (): number => {
    const copied = get().copySelected();
    if (copied > 0) get().removeSelected();
    return copied;
  },

  pasteClipboard: () => {
    if (elementClipboard.length === 0) return 0;
    let pasted = 0;
    set((state) => {
      if (!state.board) return state;
      let maxZ = state.board.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const clones = elementClipboard.map((element) => cloneElementWithOffset(element, 32, ++maxZ));
      pasted = clones.length;
      const elements = [...state.board.elements, ...clones] as BoardElement[];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        selectedId: clones[clones.length - 1].id,
        selectedIds: clones.map((clone) => clone.id),
        saveState: "dirty"
      };
    });
    return pasted;
  },

  bringToFront: (id) =>
    set((state) => {
      if (!state.board) return state;
      const maxZ = state.board.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const elements = state.board.elements.map((e) => (e.id === id ? { ...e, zIndex: maxZ + 1 } : e)) as BoardElement[];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        saveState: "dirty"
      };
    }),

  sendToBack: (id) =>
    set((state) => {
      if (!state.board) return state;
      const minZ = state.board.elements.reduce((m, e) => Math.min(m, e.zIndex), 0);
      const elements = state.board.elements.map((e) => (e.id === id ? { ...e, zIndex: minZ - 1 } : e)) as BoardElement[];
      return {
        ...pushHistory(state._history, state._historyIndex, elements, state.board.ink ?? []),
        board: touch({ ...state.board, elements }),
        saveState: "dirty"
      };
    }),

  setTheme: (theme) =>
    set((state) =>
      state.board ? { board: touch({ ...state.board, theme }), saveState: "dirty" } : state
    ),

  undo: () =>
    set((state) => {
      if (!state.board || state._historyIndex <= 0) return state;
      const newIndex = state._historyIndex - 1;
      const entry = state._history[newIndex];
      if (!entry) return state;
      return {
        board: touch({ ...state.board, elements: entry.elements, ink: entry.ink }),
        _historyIndex: newIndex,
        selectedId: null,
        selectedIds: [],
        selectedInkIndex: null,
        saveState: "dirty"
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.board || state._historyIndex >= state._history.length - 1) return state;
      const newIndex = state._historyIndex + 1;
      const entry = state._history[newIndex];
      if (!entry) return state;
      return {
        board: touch({ ...state.board, elements: entry.elements, ink: entry.ink }),
        _historyIndex: newIndex,
        selectedId: null,
        selectedIds: [],
        selectedInkIndex: null,
        saveState: "dirty"
      };
    }),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleMarqueeMode: () => set((s) => ({ marqueeMode: !s.marqueeMode })),
  setMarqueeMode: (marqueeMode) => set({ marqueeMode }),
  toggleGlobalInkMode: () => set((s) => ({ globalInkMode: !s.globalInkMode })),
  setGlobalInkMode: (globalInkMode) => set({ globalInkMode }),
  setInkTool: (inkTool) => set((state) => ({
    inkTool,
    selectedInkIndex: inkTool === "select" ? state.selectedInkIndex : null
  })),
  setInkColor: (inkColor) => set({ inkColor }),
  setInkWidth: (inkWidth) => set({ inkWidth }),
  setInkPolygonSides: (inkPolygonSides) => set({ inkPolygonSides: Math.max(3, Math.min(24, Math.round(inkPolygonSides))) })
}));
