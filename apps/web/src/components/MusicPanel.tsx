import { useState } from "react";
import { ExternalLink, Music2, X } from "lucide-react";
import { isAllowedEmbedUrl } from "@edumind-board/shared";
import {
  WORK_MODES,
  LOGIN_URLS,
  getFuenteMusica,
  getMusicOverrides,
  getSoundcloudUrl,
  soundcloudEsPropio,
  setFuenteMusica,
  setMusicOverride,
  setSoundcloudUrl,
  toMusicEmbedUrl,
  urlSegunFuente,
  type FuenteMusica
} from "../lib/music";
import { toast } from "./ui/feedback";

// Panel de música por modo de trabajo: un slider recorre los modos (individual,
// grupal, expositivo…) y cada uno propone una playlist instrumental adecuada.
export function MusicPanel({
  onInsert,
  onInsertNativo,
  onClose
}: {
  onInsert: (url: string, title: string, mode?: "embed" | "launcher") => void;
  onInsertNativo: (modeId: string, title: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [, force] = useState(0); // refresco tras cambiar la fuente o un enlace
  const mode = WORK_MODES[index];
  const fuente = getFuenteMusica(mode.id);
  const isCustom = Boolean(getMusicOverrides()[mode.id]);

  const NOMBRE_FUENTE: Record<FuenteMusica, string> = {
    servidor: "Música de la pizarra",
    soundcloud: soundcloudEsPropio(mode.id) ? "Tu set de SoundCloud" : mode.soundcloudTitle,
    propio: isCustom ? "Tu enlace" : "Sin enlace todavía"
  };
  const playlistName = NOMBRE_FUENTE[fuente];
  const urlPublica = urlSegunFuente(mode);

  function cambiarFuente(nueva: FuenteMusica) {
    setFuenteMusica(mode.id, nueva);
    force((n) => n + 1);
  }

  function pedirEnlaceSoundcloud() {
    const url = window.prompt(
      `Pega un set o playlist de SoundCloud para «${mode.label}»`,
      getSoundcloudUrl(mode.id) ?? "https://soundcloud.com/"
    );
    if (!url) return;
    if (!isAllowedEmbedUrl(toMusicEmbedUrl(url))) {
      toast("No pude reconocer ese enlace de SoundCloud.", "error");
      return;
    }
    setSoundcloudUrl(mode.id, url.trim());
    force((n) => n + 1);
    toast(`SoundCloud de «${mode.label}» guardado en esta pizarra.`, "success");
  }

  function insertMode() {
    // La musica del servidor es la opcion por defecto: suena entera, sin
    // iniciar sesion en ningun sitio y sin mandar datos a terceros.
    if (fuente === "servidor") {
      onInsertNativo(mode.id, `Música · ${mode.short}`);
      onClose();
      return;
    }
    if (!urlPublica) {
      toast("Esa fuente todavía no tiene enlace. Añádelo o vuelve a la música de la pizarra.", "error");
      return;
    }
    const embed = toMusicEmbedUrl(urlPublica);
    if (!isAllowedEmbedUrl(embed)) {
      toast("Ese enlace no es embebible. Usa SoundCloud o YouTube.", "error");
      return;
    }
    onInsert(embed, `Música · ${mode.short}`);
    onClose();
  }

  // Abre el servicio en su propia pestaña en vez de incrustarlo. Es la unica
  // forma de que una cuenta Premium suene entera: dentro de un iframe de
  // tercero el navegador no le pasa la sesion.
  function abrirAparte() {
    if (!urlPublica) {
      toast("Esa fuente todavía no tiene enlace.", "error");
      return;
    }
    onInsert(urlPublica, `Música · ${mode.short}`, "launcher");
    onClose();
  }

  function useMyLink() {
    const url = window.prompt(
      `Pega una playlist para «${mode.label}» (SoundCloud o YouTube)`,
      "https://"
    );
    if (!url) return;
    if (!isAllowedEmbedUrl(toMusicEmbedUrl(url))) {
      toast("No pude reconocer ese enlace. Usa SoundCloud o YouTube públicos.", "error");
      return;
    }
    setMusicOverride(mode.id, url.trim());
    force((n) => n + 1);
    toast(`Playlist de «${mode.label}» actualizada en esta pizarra.`, "success");
  }

  function restoreMode() {
    if (fuente === "soundcloud") setSoundcloudUrl(mode.id, null);
    else setMusicOverride(mode.id, null);
    force((n) => n + 1);
  }

  return (
    <div className="tool-palette music-panel" role="dialog" aria-label="Música por modo de trabajo">
      <div className="music-header">
        <div className="tool-palette-title"><Music2 size={16} /> Música</div>
        <button type="button" className="icon-only" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>
      <p className="music-sub">Elige el modo de trabajo; suena instrumental adecuada a la tarea.</p>

      <input
        className="music-slider"
        type="range"
        min={0}
        max={WORK_MODES.length - 1}
        step={1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        aria-label="Modo de trabajo"
      />
      <div className="music-ticks">
        {WORK_MODES.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className={`music-tick${i === index ? " is-active" : ""}`}
            onClick={() => setIndex(i)}
          >
            {m.short}
          </button>
        ))}
      </div>

      {/* Submenú de fuente. La de la pizarra es la primera a propósito: es la
          única que suena entera sin depender de una cuenta ajena. */}
      <div className="music-fuentes" role="group" aria-label="Fuente de la música">
        {([
          ["servidor", "Pizarra"],
          ["soundcloud", "SoundCloud"],
          ["propio", "Mi enlace"]
        ] as [FuenteMusica, string][]).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            className={`music-fuente${fuente === id ? " is-active" : ""}`}
            aria-pressed={fuente === id}
            onClick={() => cambiarFuente(id)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="music-card">
        <div className="music-mode-label">{mode.label}</div>
        <div className="music-mode-desc">{mode.description}</div>
        <div className="music-playlist">
          <span className="music-playlist-name">♪ {playlistName}</span>
          {urlPublica && (
            <a className="music-open" href={urlPublica} target="_blank" rel="noopener noreferrer">
              Ver <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="music-actions">
          <button type="button" className="primary" onClick={insertMode}>Poner en el tablero</button>
          {fuente === "soundcloud" && (
            <button type="button" onClick={abrirAparte}>Abrir aparte</button>
          )}
          {fuente === "soundcloud" && (
            <button type="button" onClick={pedirEnlaceSoundcloud}>Otro set</button>
          )}
          {fuente === "propio" && <button type="button" onClick={useMyLink}>Poner enlace</button>}
          {fuente === "soundcloud" && soundcloudEsPropio(mode.id) && (
            <button type="button" onClick={restoreMode}>Restaurar</button>
          )}
        </div>
      </div>

      {fuente === "servidor" && (
        <p className="music-note">
          Suena entera y sin iniciar sesión en ningún sitio: la sirve esta misma pizarra.
          No sale ningún dato del aula.
        </p>
      )}

      {fuente === "soundcloud" && (
        <div className="music-note">
          <p>
            SoundCloud suena entero sin cuenta, también incrustado. Con «Abrir aparte» se
            abre en su propia pestaña, donde además valen tus «me gusta» y tus sets privados.
          </p>
          <button
            type="button"
            className="music-login"
            onClick={() => window.open(LOGIN_URLS.soundcloud, "_blank", "noopener,noreferrer")}
          >
            Abrir SoundCloud e iniciar sesión <ExternalLink size={12} />
          </button>
          <p className="music-aviso">
            Al incrustarlo, SoundCloud recibe datos de navegación de quien use la pizarra.
          </p>
        </div>
      )}
    </div>
  );
}
