// @vitest-environment jsdom
/**
 * El ErrorBoundary envuelve cada widget del tablero. Si falla, un widget roto
 * se lleva por delante la pizarra entera en mitad de una clase.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { conErrorEsperado } from "../pruebas/errorEsperado";
import { ErrorBoundary } from "./ErrorBoundary";

function Explota(): never {
    throw new Error("widget roto");
}

describe("ErrorBoundary", () => {
    it("no estorba cuando el hijo funciona", () => {
        render(
            <ErrorBoundary>
                <p>contenido del widget</p>
            </ErrorBoundary>
        );
        expect(screen.getByText("contenido del widget")).toBeTruthy();
    });

    it("muestra un aviso en vez de propagar el fallo", () => {
        conErrorEsperado(() =>
            render(
            <ErrorBoundary>
                <Explota />
            </ErrorBoundary>
            )
        );
        expect(screen.getByText(/Error al renderizar este widget/)).toBeTruthy();
    });

    it("respeta el aviso a medida si se le pasa uno", () => {
        conErrorEsperado(() =>
            render(
            <ErrorBoundary fallback={<span>este widget no está disponible</span>}>
                <Explota />
            </ErrorBoundary>
            )
        );
        expect(screen.getByText("este widget no está disponible")).toBeTruthy();
        expect(screen.queryByText(/Error al renderizar este widget/)).toBeNull();
    });

    it("un widget roto no se lleva a sus vecinos", () => {
        conErrorEsperado(() =>
            render(
            <div>
                <ErrorBoundary><p>widget sano A</p></ErrorBoundary>
                <ErrorBoundary><Explota /></ErrorBoundary>
                <ErrorBoundary><p>widget sano B</p></ErrorBoundary>
            </div>
            )
        );
        expect(screen.getByText("widget sano A")).toBeTruthy();
        expect(screen.getByText("widget sano B")).toBeTruthy();
        expect(screen.getByText(/Error al renderizar este widget/)).toBeTruthy();
    });
});
