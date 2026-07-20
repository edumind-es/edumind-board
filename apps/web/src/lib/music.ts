// Música de aula por modo de trabajo.
//
// Cada modo de trabajo (individual, grupal, expositivo…) mapea a una playlist
// instrumental adecuada a esa tarea. Se siembran playlists oficiales de Spotify
// (verificadas), y el docente puede sustituir la de cada modo por la suya, que
// se guarda en ESTE dispositivo (una PDI concreta). La reproducción usa el embed.
//
// Nota de reproducción: los embeds de Spotify sin sesión iniciada reproducen
// solo previews de 30 s. Para reproducción completa: iniciar sesión de Spotify
// en el navegador de la pizarra, o pegar una playlist de YouTube (reproducción
// libre) con «Usar mi enlace».

export type WorkMode = {
  id: string;
  label: string;
  short: string;
  description: string;
  spotifyId: string;
  seededTitle: string;
};

// Los 6 modos de trabajo (orden del slider: de más contenido a más abierto).
export const WORK_MODES: WorkMode[] = [
  { id: "individual", label: "Trabajo individual", short: "Individual", description: "Concentración profunda, sin distracción.", spotifyId: "37i9dQZF1DWZeKCadgRdKQ", seededTitle: "Deep Focus" },
  { id: "autonomo",   label: "Trabajo autónomo",   short: "Autónomo",   description: "Estudio sostenido, a ritmo propio.",       spotifyId: "37i9dQZF1DX9sIqqvKsjG8", seededTitle: "Instrumental Study" },
  { id: "grupal",     label: "Trabajo grupal",     short: "Grupal",     description: "Ambiente relajado para colaborar.",        spotifyId: "37i9dQZF1DWWQRwui0ExPn", seededTitle: "lofi beats" },
  { id: "expositivo", label: "Expositivo",         short: "Expositivo", description: "Calma para escuchar y atender.",           spotifyId: "37i9dQZF1DX4sWSpwq3LiO", seededTitle: "Peaceful Piano" },
  { id: "abierto",    label: "Abierto / creativo", short: "Abierto",    description: "Estimula ideas y creatividad.",            spotifyId: "37i9dQZF1DWXLeA8Omikj7", seededTitle: "Brain Food" },
  { id: "flexible",   label: "Flexible",           short: "Flexible",   description: "Instrumental variado, todoterreno.",       spotifyId: "37i9dQZF1DWZZbwlv3Vmtr", seededTitle: "Focus Flow" }
];

const OVERRIDE_KEY = "edumind-board.music-overrides";
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

// URL pública de la playlist del modo (para «ver/abrir»): el override del
// docente o la playlist de Spotify sembrada.
export function publicUrlForMode(mode: WorkMode): string {
  return getMusicOverrides()[mode.id] ?? `https://open.spotify.com/playlist/${mode.spotifyId}`;
}

// ── Conversores a URL embebible (Spotify / SoundCloud / YouTube) ───────────

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

export function toSpotifyEmbedUrl(rawUrl: string) {
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
    if (host === "open.spotify.com") return toSpotifyEmbedUrl(trimmed);
    if (host === "soundcloud.com" || host === "w.soundcloud.com") return toSoundCloudEmbedUrl(trimmed);
    return trimmed;
  } catch {
    return trimmed;
  }
}

// URL embebible final para un modo (override convertido o el Spotify sembrado).
export function embedUrlForMode(mode: WorkMode): string {
  return toMusicEmbedUrl(publicUrlForMode(mode));
}
