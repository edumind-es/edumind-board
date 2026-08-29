// Visor del PDF de un elemento «archivo» dentro del overlay del tablero.
//
// Existe como componente propio porque la URL puede ser `local:<id>` y hay que
// resolverla con un hook — dentro del .map() del canvas no se puede.
import type { CSSProperties } from "react";
import { useArchivoUrl } from "../lib/useArchivoUrl";

export function ArchivoOverlay({
  id,
  name,
  url,
  style
}: {
  id: string;
  name: string;
  url: string;
  style: CSSProperties;
}) {
  const { url: resuelta, estado } = useArchivoUrl(url);

  if (estado !== "listo" || !resuelta) {
    return (
      <div className="archivo-overlay-aviso" style={style}>
        {estado === "cargando"
          ? "Abriendo archivo…"
          : "Este archivo se guardó en otro navegador y no está disponible aquí."}
      </div>
    );
  }

  return <iframe data-board-element-id={id} title={name} src={resuelta} style={style} />;
}
