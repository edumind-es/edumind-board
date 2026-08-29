// Menú de apps EDUmind: cada app del ecosistema, accesible de una en una.
//
// Antes solo existía el widget «App Hub», enterrado en Manipulativos y con
// Motion siempre por defecto: llegar a Quiz o a Robótica costaba tres pasos.
import { Grid2x2, X } from "lucide-react";
import { HUB_APPS, type HubAppId } from "../lib/hubApps";

export function AppsPanel({
  onInsert,
  onClose
}: {
  /** modo "express" = tarjeta de lanzamiento; "embed" = la app dentro. */
  onInsert: (appId: HubAppId, modo: "express" | "embed") => void;
  onClose: () => void;
}) {
  return (
    <div className="tool-palette apps-panel" role="dialog" aria-label="Apps EDUmind">
      <div className="apps-header">
        <div className="tool-palette-title"><Grid2x2 size={16} /> Apps EDUmind</div>
        <button type="button" className="icon-only" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>
      <p className="apps-sub">
        Ponla como tarjeta (se abre al pulsar) o empotrada, con la app funcionando dentro del tablero.
      </p>

      <div className="apps-lista">
        {HUB_APPS.map((app) => (
          <div key={app.id} className="apps-item" style={{ borderColor: app.color }}>
            <span className="apps-emoji" style={{ background: app.bgColor }}>{app.emoji}</span>
            <div className="apps-texto">
              <strong>{app.name}</strong>
              <small>{app.description}</small>
            </div>
            <div className="apps-botones">
              <button type="button" onClick={() => { onInsert(app.id, "express"); onClose(); }}>Tarjeta</button>
              <button type="button" className="primary" onClick={() => { onInsert(app.id, "embed"); onClose(); }}>Dentro</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
