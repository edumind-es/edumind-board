// Panel «Nube»: traer al tablero un archivo alojado en Drive, OneDrive,
// Dropbox o el Nextcloud del centro, a partir de su enlace de compartir.
//
// No hay integración con cuenta (ver lib/nube.ts para el porqué): se pega el
// enlace y el tablero decide si puede mostrarlo dentro o si toca abrirlo fuera.
import { useState } from "react";
import { CloudUpload, X } from "lucide-react";
import { PROVEEDORES, detectarProveedor, resolverEnlaceNube } from "../lib/nube";
import { toast } from "./ui/feedback";

export function NubePanel({
  onInsert,
  onClose
}: {
  onInsert: (url: string, titulo: string, modo: "embed" | "launcher") => void;
  onClose: () => void;
}) {
  const [enlace, setEnlace] = useState("");
  const [titulo, setTitulo] = useState("");

  const resuelto = enlace.trim() ? resolverEnlaceNube(enlace, titulo) : null;
  const proveedor = enlace.trim() ? detectarProveedor(enlace.trim()) : null;

  function anadir() {
    const nube = resolverEnlaceNube(enlace, titulo);
    if (!nube) {
      toast("Ese enlace no es válido. Pega la URL https de compartir del archivo.", "error");
      return;
    }
    onInsert(nube.url, nube.titulo, nube.modo);
    onClose();
  }

  return (
    <div className="tool-palette nube-panel" role="dialog" aria-label="Archivo en la nube">
      <div className="nube-header">
        <div className="tool-palette-title"><CloudUpload size={16} /> Nube</div>
        <button type="button" className="icon-only" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>
      <p className="nube-sub">
        Comparte el archivo en tu nube («cualquiera con el enlace») y pega aquí esa URL.
      </p>

      <section>
        <label className="nube-campo">
          <span>Enlace de compartir</span>
          <input
            type="url"
            value={enlace}
            placeholder="https://drive.google.com/file/d/…/view"
            onChange={(e) => setEnlace(e.target.value)}
          />
        </label>
        <label className="nube-campo">
          <span>Título en el tablero (opcional)</span>
          <input
            type="text"
            value={titulo}
            placeholder="Ficha de la unidad 3"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
      </section>

      {resuelto && (
        <p className={`nube-estado ${resuelto.modo === "embed" ? "is-embed" : "is-launcher"}`}>
          {resuelto.modo === "embed"
            ? `Detectado: ${resuelto.titulo}. Se verá dentro del tablero.`
            : `Detectado: ${resuelto.titulo}. Este servicio no permite verse dentro del tablero, así que se añade como tarjeta que abre en una pestaña nueva.`}
        </p>
      )}
      {enlace.trim() && !resuelto && (
        <p className="nube-estado is-error">Eso no parece una URL https válida.</p>
      )}

      <div className="nube-actions">
        <button type="button" className="primary" onClick={anadir} disabled={!resuelto}>
          Poner en el tablero
        </button>
      </div>

      <section>
        <div className="tool-palette-title">Formato del enlace</div>
        <ul className="nube-ejemplos">
          {PROVEEDORES.map((item) => (
            <li key={item.id} className={proveedor === item.id ? "is-active" : ""}>
              <strong>{item.nombre}</strong>
              <code>{item.ejemplo}</code>
            </li>
          ))}
        </ul>
      </section>

      <p className="nube-note">
        El archivo sigue en tu nube: el tablero solo guarda el enlace. Quien vea el tablero
        publicado necesitará permiso para abrirlo, y el proveedor sabrá que se ha abierto.
      </p>
    </div>
  );
}
