/**
 * El store del tablero: historial, portapapeles y selección.
 *
 * Es el fichero más grande del frontend y hasta ahora no tenía ni una
 * prueba. Lo que se cubre aquí es lo que el docente nota si se rompe:
 * Ctrl+Z, copiar y pegar, y el orden de las capas.
 */
import type { BoardDocument, BoardElement } from "@edumind-board/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "./store";

const MAX_HISTORY = 25;

function tableroVacio(): BoardDocument {
    return {
        id: "board-1",
        title: "Tablero de prueba",
        theme: "clay",
        elements: [],
        ink: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
    } as unknown as BoardDocument;
}

const store = () => useBoardStore.getState();
const elementos = (): BoardElement[] => store().board?.elements ?? [];

beforeEach(() => {
    useBoardStore.getState().setBoard(tableroVacio());
});

describe("historial", () => {
    it("empieza con un solo punto: el tablero recién cargado", () => {
        expect(store()._history).toHaveLength(1);
        expect(store()._historyIndex).toBe(0);
    });

    it("deshacer devuelve el tablero al estado anterior", () => {
        store().addElement("text");
        expect(elementos()).toHaveLength(1);

        store().undo();
        expect(elementos()).toHaveLength(0);
    });

    it("rehacer recupera lo deshecho", () => {
        store().addElement("text");
        store().undo();
        store().redo();
        expect(elementos()).toHaveLength(1);
    });

    it("no deshace más allá del principio", () => {
        store().undo();
        store().undo();
        expect(elementos()).toHaveLength(0);
        expect(store()._historyIndex).toBe(0);
    });

    it("no rehace si no hay nada que rehacer", () => {
        store().addElement("text");
        store().redo();
        expect(elementos()).toHaveLength(1);
    });

    it("una acción nueva tras deshacer descarta la rama de rehacer", () => {
        store().addElement("text");
        const a = elementos()[0]!.id;
        store().addElement("text");
        const b = elementos()[1]!.id;

        store().undo();                       // vuelve a [a]
        store().addElement("text");           // rama nueva: [a, c]
        const c = elementos()[1]!.id;

        expect(elementos().map((e) => e.id)).toEqual([a, c]);
        expect(store()._history).toHaveLength(3);   // h0, [a], [a,c]

        store().redo();                       // ya no hay adonde ir
        expect(elementos().map((e) => e.id)).toEqual([a, c]);

        // Y lo que de verdad delata que la rama vieja se descartó: al
        // deshacer se vuelve a [a], no al [a, b] que quedó abandonado.
        store().undo();
        expect(elementos().map((e) => e.id)).toEqual([a]);
        expect(elementos().map((e) => e.id)).not.toContain(b);
    });

    it(`guarda como mucho ${MAX_HISTORY} pasos`, () => {
        for (let i = 0; i < MAX_HISTORY + 10; i += 1) store().addElement("text");
        expect(store()._history.length).toBe(MAX_HISTORY);
        expect(store()._historyIndex).toBe(MAX_HISTORY - 1);
    });

    it("deshacer limpia la selección: lo seleccionado puede ya no existir", () => {
        store().addElement("text");
        expect(store().selectedId).not.toBeNull();
        store().undo();
        expect(store().selectedId).toBeNull();
        expect(store().selectedIds).toEqual([]);
    });

    it("cargar otro tablero borra el historial del anterior", () => {
        store().addElement("text");
        store().setBoard(tableroVacio());
        expect(store()._history).toHaveLength(1);
        store().undo();
        expect(elementos()).toHaveLength(0);
    });
});

describe("portapapeles", () => {
    it("copiar y pegar duplica sin tocar el original", () => {
        store().addElement("text");
        const original = elementos()[0]!;

        expect(store().copySelected()).toBe(1);
        expect(store().pasteClipboard()).toBe(1);

        expect(elementos()).toHaveLength(2);
        expect(elementos()[0]!.id).toBe(original.id);
        expect(elementos()[1]!.id).not.toBe(original.id);
    });

    it("cortar quita el original y pegar lo devuelve", () => {
        store().addElement("text");
        expect(store().cutSelected()).toBe(1);
        expect(elementos()).toHaveLength(0);

        expect(store().pasteClipboard()).toBe(1);
        expect(elementos()).toHaveLength(1);
    });

    it("copiar sin selección no borra lo que ya había copiado", () => {
        store().addElement("text");
        store().copySelected();          // hay algo en el portapapeles

        store().setSelectedIds([]);
        expect(store().copySelected()).toBe(0);   // Ctrl+C en vacío

        expect(store().pasteClipboard()).toBe(1); // lo anterior sigue ahí
    });

    it("el portapapeles cruza de un tablero a otro", () => {
        store().addElement("text");
        store().copySelected();

        store().setBoard(tableroVacio());         // otro tablero
        expect(elementos()).toHaveLength(0);

        expect(store().pasteClipboard()).toBe(1);
        expect(elementos()).toHaveLength(1);
    });

    it("lo pegado se puede deshacer", () => {
        store().addElement("text");
        store().copySelected();
        store().pasteClipboard();
        expect(elementos()).toHaveLength(2);
        store().undo();
        expect(elementos()).toHaveLength(1);
    });
});

describe("selección", () => {
    it("alternar añade y quita", () => {
        store().addElement("text");
        store().addElement("text");
        const [a, b] = elementos();

        store().setSelectedIds([a!.id]);
        store().toggleSelectedId(b!.id);
        expect(store().selectedIds).toEqual([a!.id, b!.id]);

        store().toggleSelectedId(a!.id);
        expect(store().selectedIds).toEqual([b!.id]);
        expect(store().selectedId).toBe(b!.id);
    });

    it("al quedarse sin selección, selectedId queda a null", () => {
        store().addElement("text");
        const id = elementos()[0]!.id;
        store().setSelectedIds([id]);
        store().toggleSelectedId(id);
        expect(store().selectedIds).toEqual([]);
        expect(store().selectedId).toBeNull();
    });
});

describe("lados del polígono de tinta", () => {
    it("se queda entre 3 y 24 y redondea", () => {
        store().setInkPolygonSides(1);
        expect(store().inkPolygonSides).toBe(3);
        store().setInkPolygonSides(99);
        expect(store().inkPolygonSides).toBe(24);
        store().setInkPolygonSides(5.6);
        expect(store().inkPolygonSides).toBe(6);
    });
});

describe("música: no se acumula", () => {
    function reproductor(modeId: string) {
        const base = store().board!;
        return {
            id: `m-${modeId}`, type: "musica" as const, x: 10, y: 10,
            width: 380, height: 190, rotation: 0, zIndex: base.elements.length,
            data: { modeId, titulo: `Música · ${modeId}` }
        };
    }

    it("elegir otro modo reemplaza el reproductor, no añade otro", () => {
        store().upsertMusica(reproductor("individual") as never);
        store().upsertMusica(reproductor("grupal") as never);
        store().upsertMusica(reproductor("abierto") as never);

        const musicas = elementos().filter((e) => e.type === "musica");
        // Antes cada clic en «Música» dejaba otro widget encima.
        expect(musicas).toHaveLength(1);
        expect((musicas[0] as { data: { modeId: string } }).data.modeId).toBe("abierto");
    });

    it("el reproductor se queda donde el docente lo había puesto", () => {
        store().upsertMusica(reproductor("individual") as never);
        const id = elementos()[0]!.id;
        store().moveElementsBy([id], 200, 120);
        const movido = elementos()[0]!;

        store().upsertMusica(reproductor("grupal") as never);

        const ahora = elementos()[0]!;
        expect(ahora.x).toBe(movido.x);
        expect(ahora.y).toBe(movido.y);
        expect(ahora.id).toBe(id);
    });

    it("no toca los demás elementos del tablero", () => {
        store().addElement("text");
        store().upsertMusica(reproductor("individual") as never);
        store().upsertMusica(reproductor("grupal") as never);

        expect(elementos()).toHaveLength(2);
        expect(elementos().filter((e) => e.type === "text")).toHaveLength(1);
    });

    it("cambiar de música se puede deshacer", () => {
        store().upsertMusica(reproductor("individual") as never);
        store().upsertMusica(reproductor("grupal") as never);
        store().undo();
        const musicas = elementos().filter((e) => e.type === "musica");
        expect((musicas[0] as { data: { modeId: string } }).data.modeId).toBe("individual");
    });
});
