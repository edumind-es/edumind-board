// @vitest-environment jsdom
/**
 * Panel de la sala de clase.
 *
 * Es la pantalla que el docente mira mientras la clase responde, así que lo
 * que se protege es: que el código de la sala se vea, que las respuestas que
 * llegan por SSE aparezcan, y que un corte de conexión no deje la pantalla
 * mintiendo.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({ apiBaseUrl: "" }));

// jsdom no trae EventSource. Este doble deja empujar mensajes a mano.
class EventSourceFalso {
    static ultima: EventSourceFalso | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    cerrada = false;
    constructor(public url: string) {
        EventSourceFalso.ultima = this;
    }
    close() { this.cerrada = true; }
    empujar(dato: unknown) { this.onmessage?.({ data: JSON.stringify(dato) }); }
}
vi.stubGlobal("EventSource", EventSourceFalso as unknown as typeof EventSource);

const { SalaPanel } = await import("./SalaPanel");

const TABLERO = {
    id: "b1", title: "Tablero", theme: "clay", elements: [], ink: [],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    viewport: { x: 0, y: 0, zoom: 1 }
} as never;

function pintar() {
    const onClose = vi.fn();
    render(<SalaPanel code="ABC123" board={TABLERO} onClose={onClose} />);
    return { onClose };
}

beforeEach(() => {
    vi.clearAllMocks();
    EventSourceFalso.ultima = null;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe("SalaPanel", () => {
    it("enseña el código que los alumnos tienen que teclear", () => {
        pintar();
        expect(screen.getByText("ABC123")).toBeTruthy();
    });

    it("se conecta al canal del docente de esa sala", () => {
        pintar();
        expect(EventSourceFalso.ultima?.url).toContain("/api/sala/ABC123/teacher-stream");
    });

    it("mientras no hay respuestas lo dice, en vez de quedarse en blanco", () => {
        pintar();
        expect(screen.getByText(/Sin respuestas aún/)).toBeTruthy();
        expect(screen.getByText(/Respuestas \(0\)/)).toBeTruthy();
    });

    it("una mano levantada aparece en cuanto llega", async () => {
        pintar();
        EventSourceFalso.ultima!.empujar({
            type: "response",
            response: { id: "r1", type: "hand", payload: {}, studentLabel: null, createdAt: new Date().toISOString() }
        });
        expect(await screen.findByText("Mano levantada")).toBeTruthy();
        expect(screen.getByText(/Respuestas \(1\)/)).toBeTruthy();
    });

    it("cuenta las respuestas que van llegando", async () => {
        pintar();
        for (const id of ["r1", "r2", "r3"]) {
            EventSourceFalso.ultima!.empujar({
                type: "response",
                response: { id, type: "hand", payload: {}, studentLabel: null, createdAt: new Date().toISOString() }
            });
        }
        await waitFor(() => expect(screen.getByText(/Respuestas \(3\)/)).toBeTruthy());
    });

    it("cerrar el panel avisa a quien lo abrió", async () => {
        const { onClose } = pintar();
        await userEvent.click(screen.getByTitle("Cerrar sala"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("al desmontar cierra la conexión: si no, se acumulan por cada apertura", () => {
        const { unmount } = render(<SalaPanel code="ABC123" board={TABLERO} onClose={vi.fn()} />);
        const es = EventSourceFalso.ultima!;
        unmount();
        expect(es.cerrada).toBe(true);
    });
});
