// @vitest-environment jsdom
/**
 * Panel de propiedades del elemento seleccionado.
 *
 * Es por donde el docente borra, duplica y ordena las capas. Lo que se
 * protege aquí es que esos botones hagan lo que dicen sobre el tablero de
 * verdad: se usa el store real, no un doble.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({ apiBaseUrl: "", searchArasaac: vi.fn() }));
vi.mock("./ui/feedback", () => ({ toast: vi.fn(), confirmDialog: vi.fn() }));

const { useBoardStore } = await import("../lib/store");
const { Inspector } = await import("./Inspector");

const store = () => useBoardStore.getState();
const elementos = () => store().board?.elements ?? [];

function tablero() {
    return {
        id: "b1", title: "Tablero", theme: "clay", elements: [], ink: [],
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        viewport: { x: 0, y: 0, zoom: 1 }
    } as never;
}

beforeEach(() => {
    store().setBoard(tablero());
});

describe("Inspector", () => {
    it("sin nada seleccionado no estorba", () => {
        const { container } = render(<Inspector />);
        expect(container.querySelector(".inspector-delete")).toBeNull();
    });

    it("eliminar quita el elemento del tablero", async () => {
        store().addElement("text");
        expect(elementos()).toHaveLength(1);

        render(<Inspector />);
        await userEvent.click(screen.getByTitle("Eliminar elemento"));

        expect(elementos()).toHaveLength(0);
    });

    it("duplicar deja dos, con identificadores distintos", async () => {
        store().addElement("note");
        render(<Inspector />);
        await userEvent.click(screen.getByTitle("Duplicar"));

        expect(elementos()).toHaveLength(2);
        expect(elementos()[0]!.id).not.toBe(elementos()[1]!.id);
    });

    it("traer al frente pone el elemento por encima del resto", async () => {
        store().addElement("text");
        const primero = elementos()[0]!.id;
        store().addElement("note");
        store().setSelectedId(primero);

        render(<Inspector />);
        await userEvent.click(screen.getByTitle("Traer al frente"));

        const traido = elementos().find((e) => e.id === primero)!;
        const otros = elementos().filter((e) => e.id !== primero);
        expect(otros.every((e) => e.zIndex < traido.zIndex)).toBe(true);
    });

    it("enviar al fondo lo deja por debajo del resto", async () => {
        store().addElement("text");
        store().addElement("note");
        const ultimo = elementos()[1]!.id;
        store().setSelectedId(ultimo);

        render(<Inspector />);
        await userEvent.click(screen.getByTitle("Enviar al fondo"));

        const enviado = elementos().find((e) => e.id === ultimo)!;
        const otros = elementos().filter((e) => e.id !== ultimo);
        expect(otros.every((e) => e.zIndex > enviado.zIndex)).toBe(true);
    });

    it("borrar desde el inspector se puede deshacer", async () => {
        store().addElement("text");
        render(<Inspector />);
        await userEvent.click(screen.getByTitle("Eliminar elemento"));
        expect(elementos()).toHaveLength(0);

        store().undo();
        expect(elementos()).toHaveLength(1);
    });

    it("nombra el tipo del elemento seleccionado", () => {
        store().addElement("musica");
        render(<Inspector />);
        expect(screen.getByText("Música")).toBeTruthy();
    });
});
