// @vitest-environment jsdom
/**
 * El reproductor de música de aula.
 *
 * Lo que se protege aquí: que la atribución CC BY esté SIEMPRE en pantalla
 * (es la condición para poder usar esta música), que un servidor sin música
 * no deje la pizarra rota, y que pasar de pista funcione.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cargarCatalogoMusica = vi.fn();
vi.mock("../lib/musicaCatalogo", () => ({
    cargarCatalogoMusica: () => cargarCatalogoMusica()
}));
vi.mock("../lib/api", () => ({ apiBaseUrl: "" }));

const { ReproductorMusica } = await import("./ReproductorMusica");

const CATALOGO = {
    licencia: { nombre: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    autor: { nombre: "Kevin MacLeod", url: "https://incompetech.com/" },
    modos: [
        {
            id: "individual",
            razon: "Concentración profunda",
            pistas: [
                { id: "uno", titulo: "Late Night Radio", duracion: 264, instrumentos: "Piano", fichero: "uno.mp3", atribucion: "Late Night Radio — Kevin MacLeod (CC BY 4.0)" },
                { id: "dos", titulo: "Northern Glade", duracion: 315, instrumentos: "Piano", fichero: "dos.mp3", atribucion: "Northern Glade — Kevin MacLeod (CC BY 4.0)" }
            ]
        },
        { id: "vacio", razon: "Sin pistas todavía", pistas: [] }
    ]
};

beforeEach(() => {
    vi.clearAllMocks();
    cargarCatalogoMusica.mockResolvedValue(CATALOGO);
});

describe("ReproductorMusica", () => {
    it("muestra la pista del modo pedido", async () => {
        render(<ReproductorMusica modeId="individual" titulo="Música · Individual" />);
        expect(await screen.findByText("Late Night Radio")).toBeTruthy();
        expect(screen.getByText("Música · Individual")).toBeTruthy();
    });

    it("enseña la atribución de la licencia, que es obligatoria", async () => {
        render(<ReproductorMusica modeId="individual" titulo="Música" />);
        expect(await screen.findByText(/Kevin MacLeod \(CC BY 4\.0\)/)).toBeTruthy();
    });

    it("empieza por la pista guardada si el tablero traía una", async () => {
        render(<ReproductorMusica modeId="individual" titulo="Música" pistaInicial="dos" />);
        expect(await screen.findByText("Northern Glade")).toBeTruthy();
    });

    it("pasar de pista cambia el título y avisa al tablero", async () => {
        const onPistaChange = vi.fn();
        render(<ReproductorMusica modeId="individual" titulo="Música" onPistaChange={onPistaChange} />);
        await screen.findByText("Late Night Radio");

        await userEvent.click(screen.getByLabelText("Pista siguiente"));

        expect(await screen.findByText("Northern Glade")).toBeTruthy();
        expect(onPistaChange).toHaveBeenCalledWith("dos");
    });

    it("da la vuelta al llegar al final de la lista", async () => {
        render(<ReproductorMusica modeId="individual" titulo="Música" pistaInicial="dos" />);
        await screen.findByText("Northern Glade");
        await userEvent.click(screen.getByLabelText("Pista siguiente"));
        expect(await screen.findByText("Late Night Radio")).toBeTruthy();
    });

    it("un modo sin pistas lo dice, no se queda en blanco", async () => {
        render(<ReproductorMusica modeId="vacio" titulo="Música" />);
        expect(await screen.findByText(/todavía no tiene pistas/i)).toBeTruthy();
    });

    it("un servidor sin música instalada no rompe la pizarra", async () => {
        cargarCatalogoMusica.mockRejectedValue(new Error("404"));
        render(<ReproductorMusica modeId="individual" titulo="Música" />);
        expect(await screen.findByText(/No hay música instalada/)).toBeTruthy();
    });

    it("apunta al audio de nuestro servidor, no a un tercero", async () => {
        const { container } = render(<ReproductorMusica modeId="individual" titulo="Música" />);
        await screen.findByText("Late Night Radio");
        const audio = container.querySelector("audio");
        expect(audio?.getAttribute("src")).toBe("/api/musica/pista/uno");
    });

    it("con una sola pista, el botón de siguiente queda inhabilitado", async () => {
        cargarCatalogoMusica.mockResolvedValue({
            ...CATALOGO,
            modos: [{ id: "individual", razon: "", pistas: [CATALOGO.modos[0]!.pistas[0]!] }]
        });
        render(<ReproductorMusica modeId="individual" titulo="Música" />);
        await screen.findByText("Late Night Radio");
        expect(screen.getByLabelText("Pista siguiente").hasAttribute("disabled")).toBe(true);
    });
});

describe("no depende de terceros", () => {
    it("no incrusta ningún iframe", async () => {
        const { container } = render(<ReproductorMusica modeId="individual" titulo="Música" />);
        await screen.findByText("Late Night Radio");
        // Si esto falla, hemos vuelto a los embeds de 30 segundos.
        expect(container.querySelector("iframe")).toBeNull();
        await waitFor(() => expect(container.querySelector("audio")).toBeTruthy());
    });
});
