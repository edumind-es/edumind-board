// @vitest-environment jsdom
/**
 * Vía de teclado del lienzo: la lista espeja los elementos del tablero y
 * mueve la selección real del store con las flechas. Se usa el store real.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

const { useBoardStore } = await import("../lib/store");
const { ListaElementosAccesible } = await import("./ListaElementosAccesible");

const store = () => useBoardStore.getState();

function tablero() {
    return {
        id: "b1", title: "Tablero", theme: "edumind", elements: [], ink: [],
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        viewport: { x: 0, y: 0, zoom: 1 }
    } as never;
}

beforeEach(() => {
    store().setBoard(tablero());
    store().setSelectedId(null);
});

describe("ListaElementosAccesible", () => {
    it("describe cada elemento con su tipo y su texto", () => {
        store().addElement("note");
        const nota = store().board!.elements[0];
        store().updateElementData(nota.id, { text: "Traer el chándal" } as never);

        render(<ListaElementosAccesible />);
        expect(screen.getByRole("option", { name: /Nota: Traer el chándal/ })).toBeTruthy();
    });

    it("las flechas mueven la selección y Mayús+flecha desplaza el elemento", async () => {
        store().addElement("note");
        store().addElement("text");
        const [nota, texto] = store().board!.elements;
        store().setSelectedId(null);

        render(<ListaElementosAccesible />);
        const lista = screen.getByRole("listbox", { name: "Elementos del tablero" });
        lista.focus();

        await userEvent.keyboard("{ArrowDown}");
        expect(store().selectedId).toBe(nota.id);
        await userEvent.keyboard("{ArrowDown}");
        expect(store().selectedId).toBe(texto.id);
        await userEvent.keyboard("{ArrowUp}");
        expect(store().selectedId).toBe(nota.id);

        const xAntes = store().board!.elements.find((el) => el.id === nota.id)!.x;
        await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
        expect(store().board!.elements.find((el) => el.id === nota.id)!.x).toBe(xAntes + 10);
        expect(store().selectedId).toBe(nota.id);
    });
});
