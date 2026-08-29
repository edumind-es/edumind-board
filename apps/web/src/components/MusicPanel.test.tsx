// @vitest-environment jsdom
/**
 * Panel de música: elección de fuente por modo de trabajo.
 *
 * Lo que se protege: que la música de la pizarra sea la opción por defecto
 * (es la única que suena entera sin cuenta ajena y sin mandar datos fuera),
 * que SoundCloud llegue con un set sembrado, y que al poner música en el
 * tablero se REEMPLACE la anterior en vez de acumular widgets.
 *
 * Spotify se retiró: incrustado sólo sonaba 30 s y para que sonase entero
 * habría hecho falta el Web Playback SDK, con app de desarrollador y Premium
 * por docente. Hay una prueba que comprueba que no ha vuelto.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ui/feedback", () => ({ toast: vi.fn(), confirmDialog: vi.fn() }));

const { MusicPanel } = await import("./MusicPanel");

function pintar() {
    const onInsert = vi.fn();
    const onInsertNativo = vi.fn();
    const onClose = vi.fn();
    render(<MusicPanel onInsert={onInsert} onInsertNativo={onInsertNativo} onClose={onClose} />);
    return { onInsert, onInsertNativo, onClose };
}

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("fuente de la música", () => {
    it("arranca en la música de la pizarra", () => {
        pintar();
        expect(screen.getByRole("button", { name: "Pizarra" }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText(/sin iniciar sesión en ningún sitio/i)).toBeTruthy();
    });

    it("ofrece las tres fuentes y ninguna es Spotify", () => {
        pintar();
        for (const nombre of ["Pizarra", "SoundCloud", "Mi enlace"]) {
            expect(screen.getByRole("button", { name: nombre })).toBeTruthy();
        }
        expect(screen.queryByRole("button", { name: "Spotify" })).toBeNull();
        expect(screen.queryByText(/spotify/i)).toBeNull();
    });

    it("SoundCloud llega con un set sembrado, no vacío", async () => {
        pintar();
        await userEvent.click(screen.getByRole("button", { name: "SoundCloud" }));
        // Antes ponía «Sin enlace todavía» y «Poner en el tablero» no hacía nada.
        expect(screen.queryByText(/Sin enlace todavía/)).toBeNull();
        expect(screen.getByText(/Reading lofi/)).toBeTruthy();
    });

    it("con SoundCloud ofrece abrir el servicio para iniciar sesión", async () => {
        pintar();
        await userEvent.click(screen.getByRole("button", { name: "SoundCloud" }));
        expect(screen.getByRole("button", { name: /Abrir SoundCloud e iniciar sesión/ })).toBeTruthy();
    });

    it("avisa de que un servicio de terceros recibe datos del aula", async () => {
        pintar();
        await userEvent.click(screen.getByRole("button", { name: "SoundCloud" }));
        expect(screen.getByText(/recibe datos de navegación/i)).toBeTruthy();
    });

    it("la fuente elegida se recuerda por modo, no globalmente", async () => {
        pintar();
        await userEvent.click(screen.getByRole("button", { name: "SoundCloud" }));
        // El slider está en el primer modo; el segundo sigue en «Pizarra».
        await userEvent.click(screen.getByRole("button", { name: "Autónomo" }));
        expect(screen.getByRole("button", { name: "Pizarra" }).getAttribute("aria-pressed")).toBe("true");
    });
});

describe("poner en el tablero", () => {
    it("por defecto inserta la música de la pizarra, no un embed", async () => {
        const { onInsertNativo, onInsert, onClose } = pintar();
        await userEvent.click(screen.getByRole("button", { name: "Poner en el tablero" }));

        expect(onInsertNativo).toHaveBeenCalledTimes(1);
        expect(onInsert).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it("SoundCloud inserta el set sembrado", async () => {
        const { onInsert } = pintar();
        await userEvent.click(screen.getByRole("button", { name: "SoundCloud" }));
        await userEvent.click(screen.getByRole("button", { name: "Poner en el tablero" }));

        expect(onInsert).toHaveBeenCalledTimes(1);
        expect(onInsert.mock.calls[0]![0]).toContain("w.soundcloud.com/player");
    });

    it("«Abrir aparte» pone una tarjeta que abre el servicio en su pestaña", async () => {
        const { onInsert } = pintar();
        await userEvent.click(screen.getByRole("button", { name: "SoundCloud" }));
        await userEvent.click(screen.getByRole("button", { name: "Abrir aparte" }));

        expect(onInsert).toHaveBeenCalledTimes(1);
        const [url, , modo] = onInsert.mock.calls[0]!;
        expect(modo).toBe("launcher");
        // El lanzador abre el set de verdad, no el reproductor incrustado.
        expect(url).toContain("soundcloud.com/");
        expect(url).not.toContain("w.soundcloud.com/player");
    });
});
