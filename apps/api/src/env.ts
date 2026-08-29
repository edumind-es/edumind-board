// Configuración derivada de variables de entorno.
// Importa config.js primero para que el .env esté cargado antes de leer process.env.
import path from "node:path";
import "./config.js";

export const authEnabled = process.env.AUTHENTIK_ENABLED === "true";
export const appBaseUrl = (process.env.APP_BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
export const webBaseUrl = (process.env.WEB_BASE_URL ?? appBaseUrl).replace(/\/$/, "");
export const classroomEventRetentionHours = Math.max(1, Number(process.env.CLASSROOM_EVENT_RETENTION_HOURS ?? 24));
export const arasaacCacheTtlHours = Math.max(1, Number(process.env.ARASAAC_CACHE_TTL_HOURS ?? 24 * 7));
export const authIssuer = process.env.AUTHENTIK_ISSUER_URL?.replace(/\/$/, "");
export const authClientId = process.env.AUTHENTIK_CLIENT_ID;
export const authClientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
export const authScopes = process.env.AUTHENTIK_SCOPES ?? "openid profile email";
export const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "edumind_board_session";

// SESSION_SECRET debe definirse explícitamente. No se acepta fallback hardcodeado.
export const sessionSecret = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "change-me" || s.length < 32) {
    // En producción (HTTPS), fallar en el arranque si el secreto no está configurado
    const isProduction = (process.env.APP_BASE_URL ?? "").startsWith("https://");
    if (isProduction) {
      throw new Error(
        "SESSION_SECRET must be set to a random string of at least 32 characters in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
      );
    }
    // En desarrollo, usar el client secret de Authentik como fallback (solo local)
    return process.env.AUTHENTIK_CLIENT_SECRET ?? "edumind-board-dev-only-not-for-production";
  }
  return s;
})();

export const secureCookies = appBaseUrl.startsWith("https://");

export const resourcesRoot = process.env.EDUMIND_RESOURCES_ROOT ?? "/var/www/edumind_content/published";
export const resourcesCatalogUrl = process.env.EDUMIND_RESOURCES_CATALOG_URL ?? "https://edumind.es/es/explore/resources";
// Quien puede embeber los recursos en un iframe. Estaba escrito a fuego con
// los dominios de EDUmind, lo que dejaba la instalacion de cualquier otro
// centro sin poder embeber nada suyo.
export const resourcesFrameAncestors =
    process.env.EDUMIND_RESOURCES_FRAME_ANCESTORS ??
    "'self' https://board.edumind.es https://*.edumind.es https://*.losmundosedufis.com";
// Música de aula. El catálogo vive JUNTO a los ficheros que describe: si se
// resolviera aparte acabaría dependiendo del directorio de trabajo, que no es
// el mismo en desarrollo (apps/api) que en producción (la raíz del repo).
export const musicaRoot = process.env.EDUMIND_MUSICA_ROOT ?? "./data/musica";
export const musicaCatalogoPath =
    process.env.EDUMIND_MUSICA_CATALOGO ?? path.join(musicaRoot, "catalogo.json");

