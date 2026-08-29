// Música de aula por modo de trabajo.
//
// Cada modo de trabajo (individual, grupal, expositivo…) mapea a una playlist
// instrumental adecuada a esa tarea. Por defecto suena la música que sirve la
// propia pizarra; el docente puede sustituir la de cada modo por un set de
// SoundCloud o un enlace suyo, que se guarda en ESTE dispositivo (una PDI
// concreta) y se reproduce con el embed del servicio.

export type WorkMode = {
  id: string;
  label: string;
  short: string;
  description: string;
  /** Set de SoundCloud sembrado para este modo. */
  soundcloudUrl: string;
  soundcloudTitle: string;
};

// Los 6 modos de trabajo (orden del slider: de más contenido a más abierto).
export const WORK_MODES: WorkMode[] = [
  { id: "individual", label: "Trabajo individual", short: "Individual", description: "Concentración profunda, sin distracción.", soundcloudUrl: "https://soundcloud.com/lofi_girl/sets/lofi-reading-2024", soundcloudTitle: "Reading lofi" },
  { id: "autonomo",   label: "Trabajo autónomo",   short: "Autónomo",   description: "Estudio sostenido, a ritmo propio.",       soundcloudUrl: "https://soundcloud.com/lofi_girl/sets/study-session-beats-to-study", soundcloudTitle: "Study Session" },
  { id: "grupal",     label: "Trabajo grupal",     short: "Grupal",     description: "Ambiente relajado para colaborar.",        soundcloudUrl: "https://soundcloud.com/chillhopdotcom/sets/spacejazz", soundcloudTitle: "Chillhop Space Jazz" },
  { id: "expositivo", label: "Expositivo",         short: "Expositivo", description: "Calma para escuchar y atender.",           soundcloudUrl: "https://soundcloud.com/lofi_girl/sets/peaceful-piano-music-to-focus", soundcloudTitle: "Peaceful Piano" },
  { id: "abierto",    label: "Abierto / creativo", short: "Abierto",    description: "Estimula ideas y creatividad.",            soundcloudUrl: "https://soundcloud.com/chillhopdotcom/sets/perfect-days", soundcloudTitle: "Perfect Days" },
  { id: "flexible",   label: "Flexible",           short: "Flexible",   description: "Instrumental variado, todoterreno.",       soundcloudUrl: "https://soundcloud.com/chillhopdotcom/sets/calm-evenings-chill-ambient-lofi-beats-instrumental-mix", soundcloudTitle: "Calm Evenings" },
];

// De dónde sale la música de cada modo.
//   servidor    → nuestras pistas CC BY: suenan enteras y no salen datos fuera
//   soundcloud  → tu enlace de SoundCloud; suena entera sin sesión
//   propio      → cualquier enlace (YouTube incluido)
export type FuenteMusica = "servidor" | "soundcloud" | "propio";

const FUENTE_KEY = "edumind-board.music-fuentes";
const SOUNDCLOUD_KEY = "edumind-board.music-soundcloud";
const OVERRIDE_KEY = "edumind-board.music-overrides";

function leerMapa(clave: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function escribirMapa(clave: string, modeId: string, valor: string | null) {
  const todo = leerMapa(clave);
  if (valor) todo[modeId] = valor;
  else delete todo[modeId];
  try {
    localStorage.setItem(clave, JSON.stringify(todo));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Fuente elegida para un modo. Por defecto, la del servidor. */
export function getFuenteMusica(modeId: string): FuenteMusica {
  const guardada = leerMapa(FUENTE_KEY)[modeId];
  return guardada === "soundcloud" || guardada === "propio"
    ? guardada
    : "servidor";
}

export function setFuenteMusica(modeId: string, fuente: FuenteMusica) {
  escribirMapa(FUENTE_KEY, modeId, fuente === "servidor" ? null : fuente);
}

/**
 * Set de SoundCloud del modo: el del docente si lo ha puesto, y si no el
 * sembrado. Antes no había semilla, así que elegir SoundCloud llevaba a un
 * callejón sin salida: «Sin enlace todavía» y un aviso al intentar ponerlo.
 */
export function getSoundcloudUrl(modeId: string): string | null {
  const propio = leerMapa(SOUNDCLOUD_KEY)[modeId];
  if (propio) return propio;
  return WORK_MODES.find((m) => m.id === modeId)?.soundcloudUrl ?? null;
}

/** ¿El enlace de SoundCloud es del docente o el que viene de serie? */
export function soundcloudEsPropio(modeId: string): boolean {
  return Boolean(leerMapa(SOUNDCLOUD_KEY)[modeId]);
}

export function setSoundcloudUrl(modeId: string, url: string | null) {
  escribirMapa(SOUNDCLOUD_KEY, modeId, url);
}

/** Dónde iniciar sesión para que el embed suene entero. */
export const LOGIN_URLS: Record<"soundcloud", string> = {
  soundcloud: "https://soundcloud.com/signin"
};

/**
 * URL pública según la fuente elegida. Devuelve null si la fuente es la del
 * servidor (ahí no hay enlace: la sirve la propia pizarra).
 */
export function urlSegunFuente(mode: WorkMode): string | null {
  switch (getFuenteMusica(mode.id)) {
    case "soundcloud":
      return getSoundcloudUrl(mode.id);
    case "propio":
      return getMusicOverrides()[mode.id] ?? null;
    default:
      return null;
  }
}
type Overrides = Record<string, string>; // modeId -> URL elegida por el docente

export function getMusicOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

export function setMusicOverride(modeId: string, url: string | null) {
  const all = getMusicOverrides();
  if (url) all[modeId] = url;
  else delete all[modeId];
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(all));
  } catch {
    /* almacenamiento no disponible */
  }
}

// ── Conversores a URL embebible (SoundCloud / YouTube) ─────────────────────

export function toYouTubeEmbedUrl(rawUrl: string) {
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

export function toSoundCloudEmbedUrl(rawUrl: string) {
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

export function toMusicEmbedUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
      return toYouTubeEmbedUrl(trimmed);
    }
    if (host === "soundcloud.com" || host === "w.soundcloud.com") return toSoundCloudEmbedUrl(trimmed);
    return trimmed;
  } catch {
    return trimmed;
  }
}
