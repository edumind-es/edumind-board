import { useState } from "react";
import { ExternalLink, Music2, X } from "lucide-react";
import { isAllowedEmbedUrl } from "@edumind-board/shared";
import {
  WORK_MODES,
  embedUrlForMode,
  getMusicOverrides,
  publicUrlForMode,
  setMusicOverride,
  toMusicEmbedUrl
} from "../lib/music";
import { toast } from "./ui/feedback";

// Panel de música por modo de trabajo: un slider recorre los modos (individual,
// grupal, expositivo…) y cada uno propone una playlist instrumental adecuada.
export function MusicPanel({
  onInsert,
  onClose
}: {
  onInsert: (embedUrl: string, title: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [, force] = useState(0); // refresco tras cambiar un override
  const mode = WORK_MODES[index];
  const isCustom = Boolean(getMusicOverrides()[mode.id]);
  const playlistName = isCustom ? "Tu enlace" : mode.seededTitle;

  function insertMode() {
    const embed = embedUrlForMode(mode);
    if (!isAllowedEmbedUrl(embed)) {
      toast("Ese enlace no es embebible. Usa Spotify, SoundCloud o YouTube.", "error");
      return;
    }
    onInsert(embed, `Música · ${mode.short}`);
    onClose();
  }

  function useMyLink() {
    const url = window.prompt(
      `Pega una playlist para «${mode.label}» (Spotify, SoundCloud o YouTube)`,
      "https://open.spotify.com/playlist/"
    );
    if (!url) return;
    if (!isAllowedEmbedUrl(toMusicEmbedUrl(url))) {
      toast("No pude reconocer ese enlace. Usa Spotify, SoundCloud o YouTube públicos.", "error");
      return;
    }
    setMusicOverride(mode.id, url.trim());
    force((n) => n + 1);
    toast(`Playlist de «${mode.label}» actualizada en esta pizarra.`, "success");
  }

  function restoreMode() {
    setMusicOverride(mode.id, null);
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

      <div className="music-card">
        <div className="music-mode-label">{mode.label}</div>
        <div className="music-mode-desc">{mode.description}</div>
        <div className="music-playlist">
          <span className="music-playlist-name">♪ {playlistName}</span>
          <a className="music-open" href={publicUrlForMode(mode)} target="_blank" rel="noopener noreferrer">
            Ver <ExternalLink size={12} />
          </a>
        </div>
        <div className="music-actions">
          <button type="button" className="primary" onClick={insertMode}>Poner en el tablero</button>
          <button type="button" onClick={useMyLink}>Usar mi enlace</button>
          {isCustom && <button type="button" onClick={restoreMode}>Restaurar</button>}
        </div>
      </div>

      <p className="music-note">
        Spotify sin sesión suena 30&nbsp;s. Para reproducción completa, inicia sesión de Spotify en la pizarra
        o usa un enlace de YouTube con «Usar mi enlace».
      </p>
    </div>
  );
}
