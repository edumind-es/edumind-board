// Vía de teclado y de lector de pantalla para el lienzo.
//
// Los elementos del tablero se dibujan en un <canvas> de Konva, que no tiene
// foco ni ARIA: sin ratón no se podía elegir ni mover ninguno. Esta lista
// espeja los elementos (misma selección del store, sin modelo de datos nuevo):
// Tab llega a ella, las flechas cambian la selección, Mayús+flechas mueven el
// elemento, Enter lleva el foco al inspector y Supr lo borra (atajo global).
import type { KeyboardEvent } from "react";
import { useBoardStore } from "../lib/store";
import { describirElemento } from "../lib/etiquetasElementos";

const PASO_PX = 10;

function idOpcion(id: string) {
  return `a11y-elemento-${id}`;
}

/** Lleva el foco al primer control del inspector (que ya edita el elemento seleccionado). */
function enfocarInspector() {
  const control = document.querySelector<HTMLElement>(
    ".inspector button:not([disabled]), .inspector input, .inspector select, .inspector textarea"
  );
  control?.focus();
}

export function ListaElementosAccesible() {
  const board = useBoardStore((s) => s.board);
  const selectedId = useBoardStore((s) => s.selectedId);
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const updateElement = useBoardStore((s) => s.updateElement);

  if (!board) return null;
  const elementos = board.elements;
  const indice = elementos.findIndex((el) => el.id === selectedId);

  function seleccionar(nuevoIndice: number) {
    if (elementos.length === 0) return;
    const limitado = Math.max(0, Math.min(elementos.length - 1, nuevoIndice));
    setSelectedId(elementos[limitado].id);
  }

  function mover(dx: number, dy: number) {
    const el = indice >= 0 ? elementos[indice] : undefined;
    if (!el || el.locked) return;
    updateElement(el.id, { x: el.x + dx, y: el.y + dy });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const flechas: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]
    };
    const flecha = flechas[e.key];
    if (flecha && e.shiftKey) {
      e.preventDefault();
      mover(flecha[0] * PASO_PX, flecha[1] * PASO_PX);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); seleccionar(indice < 0 ? 0 : indice + 1); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); seleccionar(indice < 0 ? elementos.length - 1 : indice - 1); return; }
    if (e.key === "Home") { e.preventDefault(); seleccionar(0); return; }
    if (e.key === "End") { e.preventDefault(); seleccionar(elementos.length - 1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (indice < 0) seleccionar(0);
      // El inspector se renderiza tras cambiar la selección: enfocar en el siguiente tick
      setTimeout(enfocarInspector, 0);
    }
  }

  return (
    <div
      className="lista-elementos-a11y"
      role="listbox"
      tabIndex={0}
      aria-label="Elementos del tablero"
      aria-describedby="lista-elementos-a11y-ayuda"
      aria-activedescendant={indice >= 0 ? idOpcion(elementos[indice].id) : undefined}
      onKeyDown={onKeyDown}
    >
      <p id="lista-elementos-a11y-ayuda" className="lista-elementos-a11y-ayuda">
        Flechas: elegir elemento · Mayús+flechas: moverlo · Enter: editarlo en el inspector · Supr: borrarlo
      </p>
      {elementos.length === 0 && <p className="lista-elementos-a11y-ayuda">El tablero está vacío.</p>}
      {elementos.map((el) => (
        <div
          key={el.id}
          id={idOpcion(el.id)}
          role="option"
          aria-selected={el.id === selectedId}
          onClick={() => setSelectedId(el.id)}
        >
          {describirElemento(el)}{el.locked ? " (bloqueado)" : ""}
        </div>
      ))}
    </div>
  );
}
