import {
  AlignLeft, ArrowRight, BookOpen, Calculator, Clock, Cuboid, Dices, Divide, FileText,
  FilePlus2, Grid2x2, Image, Images, Link2, Maximize2, Mic, PenLine, LayoutGrid,
  MessageSquareText, Music, Puzzle, QrCode, RefreshCw, Square, StickyNote, TrafficCone, Youtube, Smartphone, Workflow
} from "lucide-react";
// PenLine se usa para el botón de Lienzo global
import type { LucideIcon } from "lucide-react";
import { isAllowedEmbedUrl, type BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { createIframePreset } from "../lib/boardFactory";

type Tool = { type: BoardElement["type"]; label: string; icon: LucideIcon };

const toolsAula: Tool[] = [
  { type: "semaphore", label: "Semáforo", icon: TrafficCone },
  { type: "timer",    label: "Timer",    icon: Clock },
  { type: "clock",   label: "Reloj",    icon: Clock },
  { type: "dice",    label: "Dado",     icon: Dices },
  { type: "spinner", label: "Ruleta",   icon: RefreshCw }
];

const toolsContenido: Tool[] = [
  { type: "note",  label: "Nota",    icon: StickyNote },
  { type: "text",  label: "Texto",   icon: FileText },
  { type: "image", label: "Imagen",  icon: Image },
  { type: "comment", label: "Comentario", icon: MessageSquareText },
  { type: "connector", label: "Flecha", icon: ArrowRight },
  { type: "flow", label: "Diagrama", icon: Workflow }
];

const toolsEdu: Tool[] = [
  { type: "guidelines", label: "Pauta",      icon: AlignLeft },
  { type: "math",       label: "Mate",       icon: Calculator },
  { type: "base10",     label: "Base 10",    icon: Cuboid },
  { type: "fraction",   label: "Fracción",   icon: Divide },
  { type: "algorithm",  label: "Algoritmo",  icon: Calculator },
  { type: "logic",      label: "Lógica",     icon: Puzzle },
  { type: "grid",       label: "Cuadrícula", icon: Grid2x2 },
  { type: "table",      label: "Tabla",      icon: LayoutGrid },
  { type: "pictos",     label: "Pictos",     icon: Images },
  { type: "noise",      label: "Ruido",      icon: Mic },
  { type: "qr",         label: "QR",         icon: QrCode },
  { type: "hub",        label: "App Hub",    icon: Smartphone }
];

type IframePreset = { label: string; icon: LucideIcon; url: string; title: string };

const iframePresets: IframePreset[] = [
  { label: "Música",  icon: Music,   url: "", title: "Música" },
  { label: "YouTube", icon: Youtube, url: "https://www.youtube-nocookie.com/embed/", title: "YouTube" }
];

function toYouTubeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";
    const playlistId = url.searchParams.get("list") ?? "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname.startsWith("/embed/videoseries")) {
        return playlistId ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}` : rawUrl.trim();
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
      } else if (url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
      } else {
        videoId = url.searchParams.get("v") ?? "";
      }
    }

    if ((!videoId || url.pathname.startsWith("/playlist")) && playlistId) {
      return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`;
    }
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : rawUrl.trim();
  } catch {
    return rawUrl.trim();
  }
}

function toSpotifyEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "open.spotify.com") return rawUrl.trim();

    const parts = url.pathname.split("/").filter(Boolean);
    const embedIndex = parts[0] === "embed" ? 1 : 0;
    const type = parts[embedIndex] ?? "";
    const id = parts[embedIndex + 1] ?? "";
    const allowedTypes = new Set(["album", "artist", "episode", "playlist", "show", "track"]);
    if (!allowedTypes.has(type) || !id) return rawUrl.trim();

    const embedUrl = new URL(`https://open.spotify.com/embed/${type}/${id}`);
    embedUrl.searchParams.set("utm_source", "edumind_board");
    return embedUrl.toString();
  } catch {
    return rawUrl.trim();
  }
}

function toSoundCloudEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host === "w.soundcloud.com") return rawUrl.trim();
    if (host !== "soundcloud.com") return rawUrl.trim();

    const embedUrl = new URL("https://w.soundcloud.com/player/");
    embedUrl.searchParams.set("url", url.toString());
    embedUrl.searchParams.set("auto_play", "false");
    embedUrl.searchParams.set("hide_related", "true");
    embedUrl.searchParams.set("show_comments", "false");
    embedUrl.searchParams.set("show_user", "true");
    embedUrl.searchParams.set("show_reposts", "false");
    embedUrl.searchParams.set("visual", "false");
    return embedUrl.toString();
  } catch {
    return rawUrl.trim();
  }
}

function toMusicEmbedUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
      return toYouTubeEmbedUrl(trimmed);
    }
    if (host === "open.spotify.com") return toSpotifyEmbedUrl(trimmed);
    if (host === "soundcloud.com" || host === "w.soundcloud.com") return toSoundCloudEmbedUrl(trimmed);
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function Toolbar({
  onPresent,
  onImportAsset,
  onOpenResources
}: {
  onPresent: () => void;
  onImportAsset: () => void;
  onOpenResources: () => void;
}) {
  const addElement = useBoardStore((s) => s.addElement);
  const addElementObject = useBoardStore((s) => s.addElementObject);
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const globalInkMode = useBoardStore((s) => s.globalInkMode);
  const toggleGlobalInkMode = useBoardStore((s) => s.toggleGlobalInkMode);

  function addWebEmbed() {
    const url = window.prompt("URL https:// para embeber en el board", "https://phet.colorado.edu/");
    if (!url) return;
    const normalizedUrl = url.includes("youtube") || url.includes("youtu.be") ? toYouTubeEmbedUrl(url) : url.trim();
    if (!isAllowedEmbedUrl(normalizedUrl)) {
      alert("Ese dominio no está permitido para embeber. Usa PhET, YouTube, Vimeo, Canva, Spotify, SoundCloud o apps EDUmind.");
      return;
    }
    addElementObject(createIframePreset(normalizedUrl, "Recurso web"));
  }

  function addPresetEmbed(preset: IframePreset) {
    if (preset.label === "Música") {
      const url = window.prompt("Pega una URL de YouTube, Spotify o SoundCloud", "https://open.spotify.com/playlist/");
      if (!url) return;
      const embedUrl = toMusicEmbedUrl(url);
      if (!isAllowedEmbedUrl(embedUrl)) {
        alert("No he podido convertir ese enlace. Usa YouTube, Spotify o SoundCloud con enlaces públicos/embebibles.");
        return;
      }
      addElementObject(createIframePreset(embedUrl, "Música"));
      return;
    }
    if (preset.label === "YouTube") {
      const url = window.prompt("Pega la URL de YouTube", "https://www.youtube.com/watch?v=");
      if (!url) return;
      const embedUrl = toYouTubeEmbedUrl(url);
      if (!isAllowedEmbedUrl(embedUrl) || !embedUrl.includes("/embed/")) {
        alert("No he podido reconocer ese recurso de YouTube. Pega un vídeo o playlist pública.");
        return;
      }
      addElementObject(createIframePreset(embedUrl, "YouTube"));
      return;
    }
    addElementObject(createIframePreset(preset.url, preset.title));
  }

  function renderTool(tool: Tool) {
    const Icon = tool.icon;
    // Reloj y Timer comparten icono Clock — distinguir por tipo en el DOM
    const key = `${tool.type}-${tool.label}`;
    return (
      <button key={key} type="button" title={tool.label} onClick={() => addElement(tool.type)}>
        <Icon size={22} />
        <span>{tool.label}</span>
      </button>
    );
  }

  return (
    <aside className="toolbar" aria-label="Herramientas">
      {/* Aula */}
      <div className="toolbar-group-label">Aula</div>
      {toolsAula.map(renderTool)}

      <div className="toolbar-divider-h" />

      {/* Contenido */}
      <div className="toolbar-group-label">Contenido</div>
      {toolsContenido.map(renderTool)}
      <button type="button" title="PDF o imagen local" onClick={onImportAsset}>
        <FilePlus2 size={22} />
        <span>Archivo</span>
      </button>
      <button type="button" title="Embed web" onClick={addWebEmbed}>
        <Link2 size={22} />
        <span>Web</span>
      </button>
      <button type="button" title="Recursos EDUmind" onClick={onOpenResources}>
        <BookOpen size={22} />
        <span>Recursos</span>
      </button>

      <div className="toolbar-divider-h" />

      {/* Educativo */}
      <div className="toolbar-group-label">Educativo</div>
      {toolsEdu.map(renderTool)}

      <div className="toolbar-divider-h" />

      {/* Apps EDUmind + YouTube */}
      <div className="toolbar-group-label">Apps</div>
      {iframePresets.map(({ label, icon: Icon, url, title }) => (
        <button key={label} type="button" title={title}
          onClick={() => addPresetEmbed({ label, icon: Icon, url, title })}>
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}

      <div className="toolbar-divider-h" />

      {/* Lienzo global */}
      <button type="button" title="Activar lienzo — dibuja sobre todo el board"
        className={globalInkMode ? "toolbar-ink-active" : ""}
        onClick={toggleGlobalInkMode}>
        <PenLine size={22} />
        <span>Lienzo</span>
      </button>

      <div className="toolbar-divider-h" />

      {/* Acciones */}
      <button type="button" title="Deseleccionar" onClick={() => setSelectedId(null)}>
        <Square size={22} />
        <span>Soltar</span>
      </button>
      <button type="button" title="Modo presentación / PDI" onClick={onPresent}>
        <Maximize2 size={22} />
        <span>PDI</span>
      </button>
    </aside>
  );
}
