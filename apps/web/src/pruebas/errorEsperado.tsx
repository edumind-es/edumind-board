import { vi } from "vitest";

/**
 * Ejecuta algo que provoca un fallo de renderizado a propósito.
 *
 * React vuelca la traza por console.error y jsdom la reenvía como error no
 * capturado, así que la salida de las pruebas se llena de ruido y un fallo
 * de verdad pasa desapercibido. Esto silencia SOLO durante la llamada, y
 * deja todo como estaba después: un error inesperado fuera de aquí se sigue
 * viendo.
 */
export function conErrorEsperado<T>(accion: () => T): T {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const tragar = (evento: ErrorEvent) => evento.preventDefault();
    window.addEventListener("error", tragar);
    try {
        return accion();
    } finally {
        window.removeEventListener("error", tragar);
        consola.mockRestore();
    }
}
