// Resuelve la URL de un archivo del tablero.
//
// Las URLs `local:<id>` apuntan a IndexedDB de este navegador y hay que
// convertirlas en `blob:` antes de poder pintarlas o meterlas en un iframe.
// El resto (data:, https:, /api/uploads/…) pasan tal cual.
import { useEffect, useState } from "react";
import { esUrlLocal, idDeUrlLocal, urlDeArchivoLocal } from "./almacenLocal";

export type EstadoArchivo = "listo" | "cargando" | "ausente";

export function useArchivoUrl(url: string): { url: string | null; estado: EstadoArchivo } {
  const local = esUrlLocal(url);
  const [resuelta, setResuelta] = useState<string | null>(local ? null : url);
  const [estado, setEstado] = useState<EstadoArchivo>(local ? "cargando" : "listo");

  useEffect(() => {
    if (!esUrlLocal(url)) {
      setResuelta(url);
      setEstado("listo");
      return;
    }
    let vigente = true;
    setEstado("cargando");
    void urlDeArchivoLocal(idDeUrlLocal(url)).then((blobUrl) => {
      if (!vigente) return;
      setResuelta(blobUrl);
      // Ausente = el archivo se guardó en OTRO navegador, o se borraron los
      // datos del sitio. Hay que decirlo, no dejar un hueco en blanco.
      setEstado(blobUrl ? "listo" : "ausente");
    });
    return () => { vigente = false; };
  }, [url]);

  return { url: resuelta, estado };
}
