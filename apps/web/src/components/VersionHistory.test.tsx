// @vitest-environment jsdom
/**
 * Historial de versiones: es la red de seguridad del docente. Si restaurar
 * falla o pide confirmación y no la respeta, se pierde el borrador en curso.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listBoardVersions = vi.fn();
const getBoardVersion = vi.fn();
const confirmDialog = vi.fn();
const toast = vi.fn();

vi.mock("../lib/api", () => ({
    listBoardVersions: (...a: unknown[]) => listBoardVersions(...a),
    getBoardVersion: (...a: unknown[]) => getBoardVersion(...a)
}));
vi.mock("./ui/feedback", () => ({
    confirmDialog: (...a: unknown[]) => confirmDialog(...a),
    toast: (...a: unknown[]) => toast(...a)
}));

const { VersionHistory } = await import("./VersionHistory");

const VERSIONES = [
    { id: "v2", versionNumber: 2, createdAt: "2026-03-02T10:00:00.000Z", isPublished: true },
    { id: "v1", versionNumber: 1, createdAt: "2026-03-01T10:00:00.000Z", isPublished: false }
];

function pintar(props: Partial<Parameters<typeof VersionHistory>[0]> = {}) {
    const onRestore = vi.fn();
    const onClose = vi.fn();
    render(<VersionHistory boardId="board-1" onRestore={onRestore} onClose={onClose} {...props} />);
    return { onRestore, onClose };
}

beforeEach(() => {
    vi.clearAllMocks();
    listBoardVersions.mockResolvedValue({ versions: VERSIONES });
    getBoardVersion.mockResolvedValue({
        version: { board: { id: "board-1", title: "Restaurado", elements: [], ink: [] } }
    });
    confirmDialog.mockResolvedValue(true);
});

describe("VersionHistory", () => {
    it("avisa mientras carga y luego lista las versiones", async () => {
        pintar();
        expect(screen.getByText("Cargando…")).toBeTruthy();

        expect(await screen.findByText("v2")).toBeTruthy();
        expect(screen.getByText("v1")).toBeTruthy();
        // La publicada se distingue de las demás.
        expect(screen.getByText("En vivo")).toBeTruthy();
    });

    it("explica el caso de no haber publicado nunca", async () => {
        listBoardVersions.mockResolvedValue({ versions: [] });
        pintar();
        expect(await screen.findByText(/Todavía no hay versiones/)).toBeTruthy();
    });

    it("no se queda en 'Cargando' si la petición falla", async () => {
        listBoardVersions.mockRejectedValue(new Error("sin red"));
        pintar();
        expect(await screen.findByText(/No se pudo cargar el historial/)).toBeTruthy();
        expect(screen.queryByText("Cargando…")).toBeNull();
    });

    it("restaurar pide confirmación antes de tocar el borrador", async () => {
        confirmDialog.mockResolvedValue(false);
        const { onRestore, onClose } = pintar();

        await userEvent.click(await screen.findByLabelText("Restaurar versión 2"));

        await waitFor(() => expect(confirmDialog).toHaveBeenCalledTimes(1));
        // Lo que de verdad importa: si dices que no, no se toca nada.
        expect(getBoardVersion).not.toHaveBeenCalled();
        expect(onRestore).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("al aceptar, entrega la versión y cierra", async () => {
        const { onRestore, onClose } = pintar();

        await userEvent.click(await screen.findByLabelText("Restaurar versión 1"));

        await waitFor(() => expect(onRestore).toHaveBeenCalledTimes(1));
        expect(getBoardVersion).toHaveBeenCalledWith("board-1", "v1");
        expect(onRestore.mock.calls[0]![0]).toMatchObject({ title: "Restaurado" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("si la versión no se puede cargar, no se pierde el borrador", async () => {
        getBoardVersion.mockRejectedValue(new Error("500"));
        const consola = vi.spyOn(console, "error").mockImplementation(() => {});
        const { onRestore, onClose } = pintar();

        await userEvent.click(await screen.findByLabelText("Restaurar versión 2"));

        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/No se pudo cargar/), "error"));
        expect(onRestore).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        consola.mockRestore();
    });

    it("el botón de cerrar avisa a quien lo abrió", async () => {
        const { onClose } = pintar();
        await userEvent.click(screen.getByLabelText("Cerrar historial"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
