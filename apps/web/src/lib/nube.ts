// Enlaces a nubes de terceros (Drive, OneDrive, Dropbox, Nextcloud…).
//
// Qué se puede y qué no: integrarse de verdad con esas nubes (listar carpetas,
// elegir archivo) exige registrar una aplicación en cada proveedor, con su
// OAuth, su verificación y sus datos de menores viajando a un tercero. Eso no
// se hace a la ligera y no es lo que resuelve el problema de clase.
//
// Lo que sí es viable hoy, y es lo que hace este módulo: pegar el enlace de
// compartir y convertirlo en su URL de VISTA PREVIA, que sí se puede empotrar.
// Cuando el proveedor no lo permite —o es un Nextcloud autoalojado, cuyo
// dominio no se puede conocer de antemano— se añade como tarjeta-lanzador que
// abre en pestaña nueva: mejor eso que un marco en blanco.
import { isAllowedEmbedUrl } from "@edumind-board/shared";

export type ProveedorNube = "drive" | "onedrive" | "dropbox" | "nextcloud" | "desconocido";

export type EnlaceNube = {
  proveedor: ProveedorNube;
  /** URL lista para el tablero (vista previa si la hay, si no la original). */
  url: string;
  /** "embed" = se ve dentro del tablero; "launcher" = tarjeta que abre fuera. */
  modo: "embed" | "launcher";
  titulo: string;
};

export const PROVEEDORES: Array<{ id: ProveedorNube; nombre: string; ejemplo: string }> = [
  { id: "drive", nombre: "Google Drive", ejemplo: "https://drive.google.com/file/d/…/view" },
  { id: "onedrive", nombre: "OneDrive", ejemplo: "https://1drv.ms/… o onedrive.live.com/…" },
  { id: "dropbox", nombre: "Dropbox", ejemplo: "https://www.dropbox.com/s/…?dl=0" },
  { id: "nextcloud", nombre: "Nextcloud / ownCloud", ejemplo: "https://nube.micentro.es/s/TOKEN" }
];

function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function detectarProveedor(url: string): ProveedorNube {
  const host = hostDe(url);
  if (!host) return "desconocido";
  if (host === "drive.google.com" || host === "docs.google.com") return "drive";
  if (host === "1drv.ms" || host === "onedrive.live.com" || host.endsWith(".sharepoint.com")) return "onedrive";
  if (host === "dropbox.com" || host === "www.dropbox.com" || host === "dl.dropboxusercontent.com") return "dropbox";
  // Nextcloud/ownCloud: el dominio lo pone cada centro, así que se reconoce
  // por la forma del enlace de compartir público (/s/TOKEN o /index.php/s/TOKEN).
  if (/\/(index\.php\/)?s\/[A-Za-z0-9]{8,}/.test(url)) return "nextcloud";
  return "desconocido";
}

/** Google Drive: /file/d/ID/view → /file/d/ID/preview; documentos → /preview. */
function urlDrive(url: string): string {
  const archivo = url.match(/\/file\/d\/([^/]+)/);
  if (archivo) return `https://drive.google.com/file/d/${archivo[1]}/preview`;
  const porParametro = url.match(/[?&]id=([^&]+)/);
  if (porParametro) return `https://drive.google.com/file/d/${porParametro[1]}/preview`;
  // Docs, Hojas, Presentaciones: cambiar la acción final por /preview.
  const documento = url.match(/^(https:\/\/docs\.google\.com\/[^?#]*\/d\/[^/]+)/);
  if (documento) return `${documento[1]}/preview`;
  return url;
}

/** Dropbox: el enlace de compartir sirve el visor con `dl=0`; `raw=1` da el archivo. */
function urlDropbox(url: string): string {
  const sinParametro = url.replace(/[?&]dl=\d/, "");
  const separador = sinParametro.includes("?") ? "&" : "?";
  return `${sinParametro}${separador}raw=1`;
}

/** OneDrive personal: el visor embebible es /embed con los mismos parámetros. */
function urlOneDrive(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "onedrive.live.com") {
      parsed.pathname = "/embed";
      return parsed.toString();
    }
  } catch {
    /* URL rara: se deja tal cual y acabará como tarjeta-lanzador. */
  }
  return url;
}

/**
 * Convierte un enlace de compartir en algo que el tablero pueda mostrar.
 *
 * Devuelve null si no es una URL https válida.
 */
export function resolverEnlaceNube(entrada: string, titulo?: string): EnlaceNube | null {
  const limpia = entrada.trim();
  let parsed: URL;
  try {
    parsed = new URL(limpia);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const proveedor = detectarProveedor(limpia);
  const url =
    proveedor === "drive" ? urlDrive(limpia)
    : proveedor === "dropbox" ? urlDropbox(limpia)
    : proveedor === "onedrive" ? urlOneDrive(limpia)
    : limpia;

  // El modo lo decide la lista de dominios embebibles, no el proveedor: un
  // Nextcloud del centro puede permitir el marco, pero no podemos saberlo, y
  // el esquema del tablero rechazaría un iframe a un dominio desconocido.
  const modo = isAllowedEmbedUrl(url) ? "embed" : "launcher";

  return {
    proveedor,
    url,
    modo,
    titulo: titulo?.trim() || nombrePorDefecto(proveedor, parsed.hostname)
  };
}

function nombrePorDefecto(proveedor: ProveedorNube, host: string) {
  const conocido = PROVEEDORES.find((p) => p.id === proveedor);
  return conocido ? conocido.nombre : host.replace(/^www\./, "");
}
