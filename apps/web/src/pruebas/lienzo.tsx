import { render } from "@testing-library/react";
import type Konva from "konva";
import { createRef } from "react";
import { Layer, Stage } from "react-konva";

import type { BoardElement } from "@edumind-board/shared";
import { renderWidget, type WidgetRenderContext } from "../widgets/renderers";

/**
 * Renderiza un widget de verdad y devuelve su árbol de Konva.
 *
 * Los widgets dibujan sobre un canvas, así que en el DOM sólo hay un
 * `<canvas>` opaco: no se puede afirmar nada mirando el HTML. Konva sí
 * mantiene un árbol de escena consultable, y ahí es donde están los textos,
 * los colores y las formas que ve el alumnado.
 *
 * Esto necesita el paquete nativo `canvas`: sin él, konva resuelve a su
 * build de Node y ni siquiera se puede importar un widget.
 */
export function pintarWidget(
    element: BoardElement,
    ctx: Partial<WidgetRenderContext> = {}
) {
    const ref = createRef<Konva.Stage>();
    const contexto: WidgetRenderContext = {
        liveControls: ctx.liveControls ?? false,
        guestMode: ctx.guestMode ?? false
    };

    const vista = render(
        <Stage ref={ref} width={element.width + 40} height={element.height + 40}>
            <Layer>{renderWidget(element, contexto)}</Layer>
        </Stage>
    );

    const stage = ref.current!;
    return {
        stage,
        vista,
        /** Todos los textos que el widget pinta, en orden. */
        textos: () => stage.find("Text").map((n) => (n as Konva.Text).text()),
        /** Rellenos de las formas, para comprobar colores. */
        rellenos: () =>
            stage.find((n: Konva.Node) => typeof (n as Konva.Shape).fill === "function")
                .map((n) => (n as Konva.Shape).fill())
                .filter((f): f is string => typeof f === "string"),
        /** Cuántos nodos de un tipo hay: círculos de un dado, celdas de una tabla… */
        cuantos: (tipo: string) => stage.find(tipo).length
    };
}
