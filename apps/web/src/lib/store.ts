import { create } from "zustand";
import type { BoardDocument, BoardElement, BoardInkObject, ThemeName } from "@edumind-board/shared";
import { createElement } from "./boardFactory";
import { newId } from "./ids";

type SaveState = "local" | "dirty" | "publishing" | "published" | "error";
export type InkTool =
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

type BoardState = {
  board: BoardDocument | null;
  selectedId: string | null;
  saveState: SaveState;
  shareToken: string | null;
  // Historial para deshacer/rehacer (solo elementos, no viewport ni título)
  _history: BoardElement[][];
  _historyIndex: number;
  // Modo lienzo global — UI ephemera, no se persiste en el board
  globalInkMode: boolean;
  inkTool: InkTool;
  inkColor: string;
  inkWidth: number;
  inkPolygonSides: number;

  setBoard: (board: BoardDocument) => void;
  setSelectedId: (id: string | null) => void;
  setSaveState: (saveState: SaveState) => void;
  setShareToken: (token: string | null) => void;
  updateBoard: (patch: Partial<BoardDocument>) => void;
  addElement: (type: BoardElement["type"]) => void;
  addElementObject: (element: BoardElement) => void;
  addInkObject: (object: BoardInkObject) => void;
  setInkObjects: (objects: BoardInkObject[]) => void;
  updateElement: (id: string, patch: Partial<BoardElement>) => void;
  updateElementData: (id: string, data: Record<string, unknown>) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setTheme: (theme: ThemeName) => void;
  undo: () => void;
  redo: () => void;
  toggleGlobalInkMode: () => void;
  setInkTool: (tool: InkTool) => void;
  setInkColor: (color: string) => void;
  setInkWidth: (width: number) => void;
  setInkPolygonSides: (sides: number) => void;
};

function touch(board: BoardDocument): BoardDocument {
  return { ...board, updatedAt: new Date().toISOString() };
}

// Inserta un snapshot de elementos en el historial y devuelve los campos actualizados
function pushHistory(
  history: BoardElement[][],
  index: number,
  elements: BoardElement[]
): { _history: BoardElement[][]; _historyIndex: number } {
  const next = history.slice(0, index + 1);
  next.push([...elements]);
  if (next.length > MAX_HISTORY) next.shift();
  return { _history: next, _historyIndex: next.length - 1 };
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  selectedId: null,
  saveState: "local",
  shareToken: null,
  _history: [],
  _historyIndex: -1,
  globalInkMode: false,
  inkTool: "pen",
  inkColor: "#5e8fa3",
  inkWidth: 4,
  inkPolygonSides: 5,

  // Al cargar un board nuevo se resetea el historial y el modo lienzo
  setBoard: (board) =>
    set({ board, selectedId: null, saveState: "local", _history: [[...board.elements]], _historyIndex: 0, globalInkMode: false }),

  setSelectedId: (selectedId) => set({ selectedId }),
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
        ...pushHistory(state._history, state._historyIndex, elements),
        board: touch({ ...state.board, elements }),
        selectedId: element.id,
        saveState: "dirty"
      };
    }),

  addElementObject: (element) =>
    set((state) => {
      if (!state.board) return state;
      const elements = [...state.board.elements, element];
      return {
        ...pushHistory(state._history, state._historyIndex, elements),
        board: touch({ ...state.board, elements }),
        selectedId: element.id,
        saveState: "dirty"
      };
    }),

  addInkObject: (object) =>
    set((state) =>
      state.board ? {
        board: touch({ ...state.board, ink: [...(state.board.ink ?? []), object].slice(-1000) }),
        saveState: "dirty"
      } : state
    ),

  setInkObjects: (objects) =>
    set((state) =>
      state.board ? {
        board: touch({ ...state.board, ink: objects.slice(-1000) }),
        saveState: "dirty"
      } : state
    ),

  // updateElement hace push de historial (cubre drag y Transformer)
  updateElement: (id, patch) =>
    set((state) => {
      if (!state.board) return state;
      const elements = state.board.elements.map((element) =>
        element.id === id ? ({ ...element, ...patch } as BoardElement) : element
      );
      return {
        ...pushHistory(state._history, state._historyIndex, elements),
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
      if (!state.board || !state.selectedId) return state;
      const elements = state.board.elements.filter((element) => element.id !== state.selectedId);
      return {
        ...pushHistory(state._history, state._historyIndex, elements),
        board: touch({ ...state.board, elements }),
        selectedId: null,
        saveState: "dirty"
      };
    }),

  duplicateSelected: () =>
    set((state) => {
      if (!state.board || !state.selectedId) return state;
      const original = state.board.elements.find((e) => e.id === state.selectedId);
      if (!original) return state;
      const maxZ = state.board.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const clone = { ...original, id: newId(), x: original.x + 24, y: original.y + 24, zIndex: maxZ + 1 };
      const elements = [...state.board.elements, clone] as BoardElement[];
      return {
        ...pushHistory(state._history, state._historyIndex, elements),
        board: touch({ ...state.board, elements }),
        selectedId: clone.id,
        saveState: "dirty"
      };
    }),

  bringToFront: (id) =>
    set((state) => {
      if (!state.board) return state;
      const maxZ = state.board.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const elements = state.board.elements.map((e) => (e.id === id ? { ...e, zIndex: maxZ + 1 } : e)) as BoardElement[];
      return {
        ...pushHistory(state._history, state._historyIndex, elements),
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
        ...pushHistory(state._history, state._historyIndex, elements),
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
      const elements = state._history[newIndex];
      if (!elements) return state;
      return {
        board: touch({ ...state.board, elements }),
        _historyIndex: newIndex,
        selectedId: null,
        saveState: "dirty"
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.board || state._historyIndex >= state._history.length - 1) return state;
      const newIndex = state._historyIndex + 1;
      const elements = state._history[newIndex];
      if (!elements) return state;
      return {
        board: touch({ ...state.board, elements }),
        _historyIndex: newIndex,
        selectedId: null,
        saveState: "dirty"
      };
    }),

  toggleGlobalInkMode: () => set((s) => ({ globalInkMode: !s.globalInkMode })),
  setInkTool: (inkTool) => set({ inkTool }),
  setInkColor: (inkColor) => set({ inkColor }),
  setInkWidth: (inkWidth) => set({ inkWidth }),
  setInkPolygonSides: (inkPolygonSides) => set({ inkPolygonSides: Math.max(3, Math.min(24, Math.round(inkPolygonSides))) })
}));
