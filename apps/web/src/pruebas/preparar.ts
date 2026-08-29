// Desmonta lo renderizado entre pruebas. Sin esto, cada prueba hereda el DOM
// de la anterior y los `getBy*` encuentran dos coincidencias.
// Solo aplica a las pruebas de componentes: en entorno node no hay document.
import { afterEach } from "vitest";

if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    afterEach(() => cleanup());
}
