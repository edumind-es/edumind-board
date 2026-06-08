import "./config.js";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyReply, FastifyRequest } from "fastify";
import Fastify from "fastify";
import { createHash, createHmac, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { JsonWebKey } from "node:crypto";
import { ZodError } from "zod";
import {
  boardDocumentSchema,
  createBoardSchema,
  createShareSchema,
  isAllowedEmbedUrl,
  publishBoardSchema
} from "@edumind-board/shared";
import { db, nowIso } from "./db.js";

type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
};

type ClaimsAuthUser = AuthUser & {
  groups: string[];
};

type AuthSession = AuthUser & {
  idToken?: string;
};

const app = Fastify({
  logger: true,
  bodyLimit: 4 * 1024 * 1024  // 4MB: un board con un fichero base64 de 1.5MB necesita margen
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "Validation error",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  const handledError = error as Error & { statusCode?: number };
  const statusCode =
    handledError.statusCode && handledError.statusCode >= 400 ? handledError.statusCode : 500;
  return reply.code(statusCode).send({
    error: statusCode === 500 ? "Internal server error" : handledError.message
  });
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173"],
  credentials: true
});

await app.register(helmet, {
  contentSecurityPolicy: false
});

await app.register(rateLimit, {
  max: 240,
  timeWindow: "1 minute"
});

const authEnabled = process.env.AUTHENTIK_ENABLED === "true";
const appBaseUrl = (process.env.APP_BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
const webBaseUrl = (process.env.WEB_BASE_URL ?? appBaseUrl).replace(/\/$/, "");
const classroomEventRetentionHours = Math.max(1, Number(process.env.CLASSROOM_EVENT_RETENTION_HOURS ?? 24));
const arasaacCacheTtlHours = Math.max(1, Number(process.env.ARASAAC_CACHE_TTL_HOURS ?? 24 * 7));
const authIssuer = process.env.AUTHENTIK_ISSUER_URL?.replace(/\/$/, "");
const authClientId = process.env.AUTHENTIK_CLIENT_ID;
const authClientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
const authScopes = process.env.AUTHENTIK_SCOPES ?? "openid profile email";
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "edumind_board_session";
// SESSION_SECRET debe definirse explícitamente. No se acepta fallback hardcodeado.
const sessionSecret = (() => {
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
const secureCookies = appBaseUrl.startsWith("https://");

let oidcMetadataCache: { expiresAt: number; metadata: Record<string, string> } | null = null;
let oidcJwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function parseCookies(request: FastifyRequest) {
  const header = request.headers.cookie;
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

function cookieAttributes(maxAgeSeconds?: number) {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secureCookies ? "Secure" : "",
    typeof maxAgeSeconds === "number" ? `Max-Age=${maxAgeSeconds}` : ""
  ].filter(Boolean).join("; ");
}

function buildCookie(name: string, value: string, maxAgeSeconds?: number) {
  return `${name}=${encodeURIComponent(value)}; ${cookieAttributes(maxAgeSeconds)}`;
}

function clearCookie(name: string) {
  return buildCookie(name, "", 0);
}

function publicUser(session: AuthSession): AuthUser {
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    role: session.role
  };
}

function signSession(session: AuthSession) {
  const payload = base64Url(JSON.stringify({
    ...session,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 8
  }));
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(value: string | undefined): AuthSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const parsed = decodeBase64UrlJson<AuthSession & { exp?: number }>(payload);
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: parsed.id,
      username: parsed.username,
      email: parsed.email,
      role: parsed.role,
      idToken: parsed.idToken
    };
  } catch {
    return null;
  }
}

function authSessionFromRequest(request: FastifyRequest): AuthSession | null {
  return verifySession(parseCookies(request).get(sessionCookieName));
}

function authUserFromRequest(request: FastifyRequest): AuthUser | null {
  const session = authSessionFromRequest(request);
  return session ? publicUser(session) : null;
}

// X-Teacher-Id eliminado: ya no se acepta como mecanismo de autenticación.
// La única autenticación válida es la cookie HttpOnly firmada (OIDC via Authentik).

function requireTeacher(request: FastifyRequest) {
  const user = authUserFromRequest(request);
  if (!user?.id) {
    const error = new Error("Authentication required");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  return String(user.id);
}

function sanitizeNext(nextValue: unknown) {
  const fallback = "/";
  if (typeof nextValue !== "string" || !nextValue.trim()) return fallback;
  const candidate = nextValue.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/api/")) return fallback;
  return candidate;
}

function webRedirect(nextValue: unknown) {
  return `${webBaseUrl}${sanitizeNext(nextValue)}`;
}

function ensureOidcConfigured() {
  if (!authEnabled || !authIssuer || !authClientId || !authClientSecret) {
    const error = new Error("Board SSO is not configured");
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
}

async function fetchOidcMetadata() {
  ensureOidcConfigured();
  const now = Date.now();
  if (oidcMetadataCache && oidcMetadataCache.expiresAt > now) return oidcMetadataCache.metadata;

  const response = await fetch(`${authIssuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    const error = new Error("Could not load Authentik OIDC metadata");
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }

  const metadata = await response.json() as Record<string, string>;
  const missing = ["issuer", "authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri"]
    .filter((key) => typeof metadata[key] !== "string" || !metadata[key]);
  if (missing.length > 0) {
    const error = new Error(`Authentication provider metadata missing: ${missing.join(", ")}`);
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }
  oidcMetadataCache = { expiresAt: now + 10 * 60 * 1000, metadata };
  return metadata;
}

async function fetchOidcJwks(metadata: Record<string, string>) {
  const now = Date.now();
  if (oidcJwksCache && oidcJwksCache.expiresAt > now) return oidcJwksCache.keys;

  const response = await fetch(metadata.jwks_uri);
  if (!response.ok) {
    const error = new Error("Could not load Authentik OIDC signing keys");
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }

  const payload = await response.json() as { keys?: JsonWebKey[] };
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  if (keys.length === 0) {
    const error = new Error("Authentik OIDC JWKS did not contain signing keys");
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }
  oidcJwksCache = { expiresAt: now + 10 * 60 * 1000, keys };
  return keys;
}

function redirectUri() {
  return `${appBaseUrl}/api/auth/oidc/callback`;
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function verifyIdToken(idToken: string, metadata: Record<string, string>, expectedNonce: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    const error = new Error("OIDC id_token has invalid format");
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string; typ?: string }>(encodedHeader);
  if (header.alg !== "RS256") {
    const error = new Error(`Unsupported OIDC id_token alg: ${header.alg ?? "missing"}`);
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }

  const keys = await fetchOidcJwks(metadata);
  const jwk = keys.find((key) => key.kid === header.kid) ?? keys.find((key) => key.use === "sig");
  if (!jwk) {
    const error = new Error("Could not find matching OIDC signing key");
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }

  const verified = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url")
  );
  if (!verified) {
    const error = new Error("OIDC id_token signature verification failed");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }

  const claims = decodeBase64UrlJson<Record<string, unknown>>(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const expectedIssuer = metadata.issuer ?? authIssuer;
  const audience = claims.aud;
  const audienceMatches =
    audience === authClientId ||
    (Array.isArray(audience) && audience.some((value) => value === authClientId));

  if (claims.iss !== expectedIssuer || !audienceMatches) {
    const error = new Error("OIDC id_token issuer or audience mismatch");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    const error = new Error("OIDC id_token expired");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) {
    const error = new Error("OIDC id_token is not valid yet");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  if (claims.nonce !== expectedNonce) {
    const error = new Error("OIDC nonce mismatch");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }

  return claims;
}

function userFromClaims(claims: Record<string, unknown>): ClaimsAuthUser {
  const sub = typeof claims.sub === "string" ? claims.sub : null;
  if (!sub) {
    const error = new Error("OIDC user profile did not include sub");
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }
  const email = typeof claims.email === "string" ? claims.email : null;
  const username =
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof claims.name === "string" && claims.name) ||
    email ||
    "EDUmind User";
  const groups = Array.isArray(claims.groups) ? claims.groups.map(String) : [];
  const role = groups.some((group) => group.toLowerCase().includes("admin")) ? "admin" : "docente";
  return { id: sub, username, email, role, groups };
}

function persistAuthUser(user: ClaimsAuthUser) {
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO users (
       id, oidc_subject, email, username, role, groups_json, auth_provider, last_login_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       oidc_subject = excluded.oidc_subject,
       email = excluded.email,
       username = excluded.username,
       role = excluded.role,
       groups_json = excluded.groups_json,
       auth_provider = excluded.auth_provider,
       last_login_at = excluded.last_login_at,
       updated_at = excluded.updated_at`
  ).run(
    user.id,
    user.id,
    user.email,
    user.username,
    user.role,
    JSON.stringify(user.groups),
    "authentik",
    timestamp,
    timestamp,
    timestamp
  );
}

function shareToken() {
  return randomBytes(32).toString("base64url");
}

function hasBlockedEmbeds(board: { elements: Array<{ type: string; data: unknown }> }) {
  return board.elements.some((element) => {
    if (element.type !== "iframe") return false;
    const data = element.data as { url?: unknown };
    return typeof data.url !== "string" || !isAllowedEmbedUrl(data.url);
  });
}

const resourcesRoot = process.env.EDUMIND_RESOURCES_ROOT ?? "/var/www/edumind_content/published";
const resourcesCatalogUrl = process.env.EDUMIND_RESOURCES_CATALOG_URL ?? "https://edumind.es/es/explore/resources";

type ResourceItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  kind: "html" | "pdf";
  updatedAt: string;
};

type ArasaacResult = {
  id: number;
  label: string;
  url: string;
};

type ArasaacRawResult = {
  _id?: number;
  keywords?: Array<{ keyword?: string }>;
};

type WebsiteResource = {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  description?: string;
  resource_type?: string;
  sourceUrl?: string;
  category?: string;
  stage?: string[];
  subject_tags?: string[];
  updatedAt?: string;
};

const resourceMimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function encodePathname(relativePath: string) {
  return relativePath.split(path.sep).map(encodeURIComponent).join("/");
}

function requestBaseUrl(request: FastifyRequest) {
  const protoHeader = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const protocol = proto?.split(",")[0]?.trim() || (secureCookies ? "https" : "http");
  const host = request.headers.host || new URL(appBaseUrl).host;
  return `${protocol}://${host}`;
}

function resolveResourcePath(rawPath: string) {
  const decoded = decodeURIComponent(rawPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(resourcesRoot, normalized);
  const root = path.resolve(resourcesRoot);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

function humanizeSlug(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("es"));
}

function extractMeta(html: string, fallbackTitle: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1]
    ?? "";
  return {
    title: title || fallbackTitle,
    description: description.replace(/\s+/g, " ").trim()
  };
}

function extractJsonArrayAt(input: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) return input.slice(start, index + 1);
    }
  }

  return null;
}

function parseWebsiteResources(html: string): WebsiteResource[] {
  const resources: WebsiteResource[] = [];
  const pushExpression = /self\.__next_f\.push\((\[.*?\])\)<\/script>/gs;
  let match: RegExpExecArray | null;

  while ((match = pushExpression.exec(html)) !== null) {
    let payload: unknown;
    try {
      payload = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (!Array.isArray(payload)) continue;

    for (const value of payload) {
      if (typeof value !== "string") continue;
      const marker = "\"resources\":";
      const markerIndex = value.indexOf(marker);
      if (markerIndex < 0) continue;

      const arrayStart = value.indexOf("[", markerIndex + marker.length);
      if (arrayStart < 0) continue;
      const arrayJson = extractJsonArrayAt(value, arrayStart);
      if (!arrayJson) continue;

      try {
        const parsed = JSON.parse(arrayJson) as unknown;
        if (Array.isArray(parsed) && parsed.some((item) => item && typeof item === "object" && "title" in item)) {
          resources.push(...(parsed as WebsiteResource[]));
        }
      } catch {
        continue;
      }
    }
  }

  return resources;
}

function mapWebsiteResource(resource: WebsiteResource): ResourceItem | null {
  const slug = resource.slug || resource.id;
  const title = resource.title?.trim();
  if (!slug || !title) return null;

  const rawUrl = resource.sourceUrl?.startsWith("/api/content/")
    ? resource.sourceUrl.replace("/api/content/", "/contenido/htmls/")
    : resource.sourceUrl || `/es/explore/resources/${slug}`;
  let url: string;
  try {
    url = new URL(rawUrl, resourcesCatalogUrl).toString();
  } catch {
    return null;
  }

  return {
    id: String(slug),
    title,
    description: (resource.summary || resource.description || "").replace(/\s+/g, " ").trim(),
    category: resource.category || resource.subject_tags?.[0] || resource.stage?.[0] || "EDUmind",
    url,
    kind: resource.resource_type === "pdf" || /\.pdf($|\?)/i.test(url) ? "pdf" : "html",
    updatedAt: resource.updatedAt || nowIso()
  };
}

async function discoverCatalogResources(): Promise<ResourceItem[]> {
  const response = await fetch(resourcesCatalogUrl, {
    headers: { "accept": "text/html,application/xhtml+xml" }
  });
  if (!response.ok) throw new Error(`Could not load resources catalog: ${response.status}`);

  const html = await response.text();
  const seen = new Set<string>();
  return parseWebsiteResources(html)
    .map(mapWebsiteResource)
    .filter((resource): resource is ResourceItem => {
      if (!resource || seen.has(resource.id)) return false;
      seen.add(resource.id);
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function discoverLocalResources(publicBaseUrl: string): Promise<ResourceItem[]> {
  const rootStat = await stat(resourcesRoot).catch(() => null);
  if (!rootStat?.isDirectory()) return [];

  const items: ResourceItem[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || !/\.(html?|pdf)$/i.test(entry.name)) continue;

      const relative = path.relative(resourcesRoot, absolute);
      const segments = relative.split(path.sep);
      const category = humanizeSlug(segments[0] ?? "Recursos");
      const fileStat = await stat(absolute);
      const fallbackTitle = humanizeSlug(entry.name);
      const kind = /\.pdf$/i.test(entry.name) ? "pdf" : "html";
      const meta = kind === "html"
        ? extractMeta(await readFile(absolute, "utf8").catch(() => ""), fallbackTitle)
        : { title: fallbackTitle, description: "Documento PDF educativo" };

      items.push({
        id: relative,
        title: meta.title,
        description: meta.description,
        category,
        url: `${publicBaseUrl}/api/resource-content/${encodePathname(relative)}`,
        kind,
        updatedAt: fileStat.mtime.toISOString()
      });
    }
  }

  await walk(resourcesRoot);
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function discoverResources(publicBaseUrl: string, request: FastifyRequest): Promise<ResourceItem[]> {
  try {
    const catalogResources = await discoverCatalogResources();
    if (catalogResources.length > 0) return catalogResources;
  } catch (error) {
    request.log.warn({ error, resourcesCatalogUrl }, "Could not load EDUmind resources catalog; using local fallback");
  }
  return discoverLocalResources(publicBaseUrl);
}

function normalizeArasaacQuery(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("es").replace(/\s+/g, " ").slice(0, 80)
    : "";
}

function arasaacPictogramUrl(id: number) {
  return `https://api.arasaac.org/api/pictograms/${id}?download=false`;
}

function normalizeArasaacResults(payload: unknown, fallback: string): ArasaacResult[] {
  if (!Array.isArray(payload)) return [];
  const seen = new Set<number>();
  const results: ArasaacResult[] = [];
  for (const item of payload as ArasaacRawResult[]) {
    const id = Number(item?._id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const label = item.keywords?.find((keyword) => keyword.keyword?.trim())?.keyword?.trim() || fallback;
    results.push({ id, label, url: arasaacPictogramUrl(id) });
  }
  return results;
}

function cachedArasaacSearch(query: string) {
  return db
    .prepare("SELECT response_json, fetched_at FROM arasaac_search_cache WHERE query = ?")
    .get(query) as { response_json: string; fetched_at: string } | undefined;
}

function isFreshCache(fetchedAt: string) {
  return Date.now() - new Date(fetchedAt).getTime() < arasaacCacheTtlHours * 60 * 60 * 1000;
}

async function fetchArasaacSearch(query: string) {
  const response = await fetch(`https://api.arasaac.org/api/pictograms/es/search/${encodeURIComponent(query)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`ARASAAC search failed with ${response.status}`);
  return normalizeArasaacResults(await response.json(), query);
}

function injectHtmlBase(html: string, sourceUrl: string) {
  const baseTag = `<base href="${sourceUrl}">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  return `${baseTag}${html}`;
}

const resourceEmbedCsp = [
  "default-src 'self' https: data: blob:",
  "base-uri 'self' https://edumind.es https://*.edumind.es",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://edumind.es https://*.edumind.es",
  "media-src 'self' data: blob: https:",
  "frame-src 'self' https://*.edumind.es https://*.losmundosedufis.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com"
].join("; ");

app.get("/health", async () => ({
  ok: true,
  service: "EDUmind Board API",
  timestamp: nowIso()
}));

app.get("/api/auth/config", async () => ({
  auth_mode: authEnabled ? "authentik" : "local",
  sso_enabled: authEnabled,
  sso_provider: authEnabled ? "authentik" : null,
  sso_login_path: authEnabled ? "/api/auth/oidc/start" : null,
  app_base_url: appBaseUrl,
  web_base_url: webBaseUrl
}));

app.get("/api/auth/me", async (request, reply) => {
  const session = authSessionFromRequest(request);
  if (!session) return reply.code(401).send({ error: "Not authenticated" });
  return { user: publicUser(session) };
});

app.get("/api/auth/health", async (_request, reply) => {
  if (!authEnabled) return { ok: true, enabled: false, provider: null };
  try {
    const metadata = await fetchOidcMetadata();
    const jwks = await fetchOidcJwks(metadata);
    return {
      ok: true,
      enabled: true,
      provider: "authentik",
      issuer: metadata.issuer,
      authorization_endpoint: Boolean(metadata.authorization_endpoint),
      token_endpoint: Boolean(metadata.token_endpoint),
      userinfo_endpoint: Boolean(metadata.userinfo_endpoint),
      jwks_uri: Boolean(metadata.jwks_uri),
      end_session_endpoint: Boolean(metadata.end_session_endpoint),
      signing_keys: jwks.length
    };
  } catch (error) {
    return reply.code(503).send({
      ok: false,
      enabled: true,
      provider: "authentik",
      error: error instanceof Error ? error.message : "SSO health check failed"
    });
  }
});

app.get<{ Querystring: { next?: string } }>("/api/auth/oidc/start", async (request, reply) => {
  const metadata = await fetchOidcMetadata();
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const nextPath = sanitizeNext(request.query.next);
  const query = new URLSearchParams({
    client_id: authClientId ?? "",
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: authScopes,
    state,
    nonce,
    code_challenge: codeChallenge(codeVerifier),
    code_challenge_method: "S256"
  });

  reply.header("Set-Cookie", [
    buildCookie("edumind_board_oidc_state", state, 600),
    buildCookie("edumind_board_oidc_nonce", nonce, 600),
    buildCookie("edumind_board_oidc_verifier", codeVerifier, 600),
    buildCookie("edumind_board_oidc_next", nextPath, 600)
  ]);
  return reply.redirect(`${metadata.authorization_endpoint}?${query.toString()}`);
});

app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/api/auth/oidc/callback", async (request, reply) => {
  if (request.query.error) return reply.code(401).send({ error: `Authentik denied login: ${request.query.error}` });
  const cookies = parseCookies(request);
  const expectedState = cookies.get("edumind_board_oidc_state");
  const expectedNonce = cookies.get("edumind_board_oidc_nonce");
  const codeVerifier = cookies.get("edumind_board_oidc_verifier");
  if (!request.query.code || !request.query.state || !expectedState || !expectedNonce || !codeVerifier || request.query.state !== expectedState) {
    return reply.code(400).send({ error: "Invalid SSO callback state" });
  }

  const metadata = await fetchOidcMetadata();
  const tokenResponse = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: request.query.code,
      redirect_uri: redirectUri(),
      client_id: authClientId ?? "",
      client_secret: authClientSecret ?? "",
      code_verifier: codeVerifier
    })
  });
  if (!tokenResponse.ok) return reply.code(502).send({ error: "Could not exchange OIDC authorization code" });
  const tokenPayload = await tokenResponse.json() as { access_token?: string; id_token?: string };
  if (!tokenPayload.access_token || !tokenPayload.id_token) {
    return reply.code(502).send({ error: "OIDC token response did not include required tokens" });
  }
  const idTokenClaims = await verifyIdToken(tokenPayload.id_token, metadata, expectedNonce);

  const userInfoResponse = await fetch(metadata.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
  });
  if (!userInfoResponse.ok) return reply.code(502).send({ error: "Could not load OIDC user profile" });

  const userInfoClaims = await userInfoResponse.json() as Record<string, unknown>;
  const user = userFromClaims({ ...idTokenClaims, ...userInfoClaims });
  persistAuthUser(user);
  reply.header("Set-Cookie", [
    buildCookie(sessionCookieName, signSession({ ...publicUser(user), idToken: tokenPayload.id_token }), 60 * 60 * 24 * 8),
    clearCookie("edumind_board_oidc_state"),
    clearCookie("edumind_board_oidc_nonce"),
    clearCookie("edumind_board_oidc_verifier"),
    clearCookie("edumind_board_oidc_next")
  ]);
  return reply.redirect(webRedirect(cookies.get("edumind_board_oidc_next")));
});

app.get<{ Querystring: { next?: string } }>("/api/auth/logout", async (request, reply) => {
  const session = authSessionFromRequest(request);
  const nextUrl = webRedirect(request.query.next);
  reply.header("Set-Cookie", clearCookie(sessionCookieName));

  if (authEnabled) {
    try {
      const metadata = await fetchOidcMetadata();
      if (metadata.end_session_endpoint) {
        const query = new URLSearchParams({
          client_id: authClientId ?? "",
          post_logout_redirect_uri: nextUrl
        });
        if (session?.idToken) query.set("id_token_hint", session.idToken);
        return reply.redirect(`${metadata.end_session_endpoint}?${query.toString()}`);
      }
    } catch (error) {
      request.log.warn({ error }, "Could not start Authentik logout; falling back to local logout");
    }
  }

  return reply.redirect(nextUrl);
});

app.get<{ Querystring: { q?: string; limit?: string } }>("/api/resources", async (request) => {
  const q = request.query.q?.trim().toLocaleLowerCase("es") ?? "";
  const limit = Math.max(1, Math.min(120, Number(request.query.limit) || 60));
  const resources = await discoverResources(requestBaseUrl(request), request);
  const filtered = q
    ? resources.filter((resource) => {
        const haystack = `${resource.title} ${resource.description} ${resource.category} ${resource.url}`.toLocaleLowerCase("es");
        return haystack.includes(q);
      })
    : resources;
  return { resources: filtered.slice(0, limit) };
});

app.get<{ Querystring: { q?: string; limit?: string } }>("/api/arasaac/search", async (request, reply) => {
  const q = normalizeArasaacQuery(request.query.q);
  const limit = Math.max(1, Math.min(24, Number(request.query.limit) || 12));
  if (q.length < 2) return { results: [], cached: false, stale: false };

  const cached = cachedArasaacSearch(q);
  if (cached && isFreshCache(cached.fetched_at)) {
    const results = JSON.parse(cached.response_json) as ArasaacResult[];
    return { results: results.slice(0, limit), cached: true, stale: false };
  }

  try {
    const results = await fetchArasaacSearch(q);
    db.prepare(
      `INSERT INTO arasaac_search_cache (query, response_json, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(query) DO UPDATE SET response_json = excluded.response_json, fetched_at = excluded.fetched_at`
    ).run(q, JSON.stringify(results), nowIso());
    return { results: results.slice(0, limit), cached: false, stale: false };
  } catch (error) {
    request.log.warn({ error, q }, "Could not load ARASAAC search; using cached fallback when available");
    if (cached) {
      const results = JSON.parse(cached.response_json) as ArasaacResult[];
      return { results: results.slice(0, limit), cached: true, stale: true };
    }
    return reply.code(502).send({ error: "Could not load ARASAAC search and no cached result is available" });
  }
});

app.get<{ Params: { id: string } }>("/api/resource-embed/:id", async (request, reply) => {
  const id = decodeURIComponent(request.params.id ?? "");
  const resource = (await discoverCatalogResources()).find((item) => item.id === id);
  if (!resource || !isAllowedEmbedUrl(resource.url)) return reply.code(404).send({ error: "Resource not found" });

  const response = await fetch(resource.url, {
    headers: { "accept": resource.kind === "pdf" ? "application/pdf,*/*" : "text/html,application/xhtml+xml,*/*" }
  });
  if (!response.ok) return reply.code(502).send({ error: "Could not load resource" });

  const contentType = response.headers.get("content-type") || (resource.kind === "pdf" ? "application/pdf" : "text/html; charset=utf-8");
  reply.header("cache-control", "public, max-age=300");
  reply.header("x-content-type-options", "nosniff");
  reply.header("content-security-policy", resourceEmbedCsp);

  if (contentType.includes("text/html")) {
    const html = injectHtmlBase(await response.text(), resource.url);
    return reply.type("text/html; charset=utf-8").send(html);
  }

  const body = Buffer.from(await response.arrayBuffer());
  return reply.type(contentType).send(body);
});

app.get<{ Params: { "*": string } }>("/api/resource-content/*", async (request, reply) => {
  const requestedPath = request.params["*"] ?? "";
  const absolute = resolveResourcePath(requestedPath);
  if (!absolute) return reply.code(404).send({ error: "Resource not found" });

  const fileStat = await stat(absolute).catch(() => null);
  if (!fileStat?.isFile()) return reply.code(404).send({ error: "Resource not found" });

  const ext = path.extname(absolute).toLowerCase();
  const contentType = resourceMimeTypes[ext] ?? "application/octet-stream";
  const isHtml = contentType.startsWith("text/html");

  reply
    .header("Content-Type", contentType)
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "strict-origin-when-cross-origin")
    .header("Cross-Origin-Resource-Policy", "same-origin")
    .header("Content-Security-Policy", "frame-ancestors 'self' https://board.edumind.es https://*.edumind.es https://*.losmundosedufis.com")
    .header("Cache-Control", isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=604800");

  return reply.send(createReadStream(absolute));
});

app.get("/api/boards", async (request) => {
  const ownerId = requireTeacher(request);
  const rows = db
    .prepare(
      `SELECT id, title, created_at as createdAt, updated_at as updatedAt, published_version_id as publishedVersionId
       FROM boards WHERE owner_id = ? ORDER BY updated_at DESC`
    )
    .all(ownerId);
  return { boards: rows };
});

app.post("/api/boards", async (request, reply) => {
  const ownerId = requireTeacher(request);
  const input = createBoardSchema.parse(request.body ?? {});
  const timestamp = nowIso();
  const board = boardDocumentSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: input.title,
    theme: "edumind",
    viewport: { x: 0, y: 0, zoom: 1 },
    elements: [],
    updatedAt: timestamp
  });

  db.prepare(
    `INSERT INTO boards (id, owner_id, title, draft_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(board.id, ownerId, board.title, JSON.stringify(board), timestamp, timestamp);

  return reply.code(201).send({ board });
});

app.get<{ Params: { id: string } }>("/api/boards/:id", async (request, reply) => {
  const ownerId = requireTeacher(request);
  const row = db
    .prepare("SELECT draft_json FROM boards WHERE id = ? AND owner_id = ?")
    .get(request.params.id, ownerId) as { draft_json: string } | undefined;

  if (!row) {
    return reply.code(404).send({ error: "Board not found" });
  }

  return { board: JSON.parse(row.draft_json) };
});

app.put<{ Params: { id: string } }>("/api/boards/:id/publish", async (request, reply) => {
  const ownerId = requireTeacher(request);
  const input = publishBoardSchema.parse(request.body);
  if (input.board.id !== request.params.id) {
    return reply.code(400).send({ error: "Board id mismatch" });
  }

  if (hasBlockedEmbeds(input.board)) {
    return reply.code(422).send({ error: "Board contains iframe URLs outside the allowed embed list" });
  }

  const existing = db
    .prepare("SELECT id FROM boards WHERE id = ? AND owner_id = ?")
    .get(request.params.id, ownerId);

  const versionRow = db
    .prepare("SELECT COALESCE(MAX(version_number), 0) + 1 as nextVersion FROM board_versions WHERE board_id = ?")
    .get(input.board.id) as { nextVersion: number };

  const versionId = randomUUID();
  const timestamp = nowIso();
  const snapshotJson = JSON.stringify({ ...input.board, updatedAt: timestamp });

  const transaction = db.transaction(() => {
    if (!existing) {
      db.prepare(
        `INSERT INTO boards (id, owner_id, title, draft_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(input.board.id, ownerId, input.board.title, snapshotJson, timestamp, timestamp);
    }

    db.prepare(
      `INSERT INTO board_versions (id, board_id, version_number, snapshot_json, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(versionId, input.board.id, versionRow.nextVersion, snapshotJson, timestamp);

    db.prepare(
      `UPDATE boards
       SET title = ?, draft_json = ?, updated_at = ?, published_version_id = ?
       WHERE id = ? AND owner_id = ?`
    ).run(input.board.title, snapshotJson, timestamp, versionId, input.board.id, ownerId);

    db.prepare(
      `UPDATE share_links
       SET version_id = ?
       WHERE board_id = ? AND active = 1`
    ).run(versionId, input.board.id);
  });

  transaction();

  return {
    published: true,
    boardId: input.board.id,
    versionId,
    versionNumber: versionRow.nextVersion,
    updatedAt: timestamp
  };
});

app.post<{ Params: { id: string } }>("/api/boards/:id/share", async (request, reply) => {
  const ownerId = requireTeacher(request);
  const input = createShareSchema.parse(request.body ?? {});
  const row = db
    .prepare("SELECT published_version_id as versionId FROM boards WHERE id = ? AND owner_id = ?")
    .get(request.params.id, ownerId) as { versionId: string | null } | undefined;

  if (!row) {
    return reply.code(404).send({ error: "Board not found" });
  }

  if (!row.versionId) {
    return reply.code(409).send({ error: "Publish the board before creating a share link" });
  }

  const token = shareToken();
  db.prepare(
    `INSERT INTO share_links (token, board_id, version_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, request.params.id, row.versionId, input.expiresAt ?? null, nowIso());

  return reply.code(201).send({
    token,
    url: `/share/${token}`,
    expiresAt: input.expiresAt ?? null
  });
});

app.get<{ Params: { id: string } }>("/api/boards/:id/shares", async (request, reply) => {
  const ownerId = requireTeacher(request);
  const board = db
    .prepare("SELECT id FROM boards WHERE id = ? AND owner_id = ?")
    .get(request.params.id, ownerId);

  if (!board) {
    return reply.code(404).send({ error: "Board not found" });
  }

  const rows = db
    .prepare(
      `SELECT token,
              active = 1 as active,
              expires_at as expiresAt,
              created_at as createdAt,
              revoked_at as revokedAt
       FROM share_links
       WHERE board_id = ?
       ORDER BY created_at DESC`
    )
    .all(request.params.id) as Array<{
      token: string;
      active: number;
      expiresAt: string | null;
      createdAt: string;
      revokedAt: string | null;
    }>;

  return { shares: rows.map((row) => ({ ...row, active: Boolean(row.active) })) };
});

app.delete<{ Params: { token: string } }>("/api/share/:token", async (request, reply) => {
  const ownerId = requireTeacher(request);
  const timestamp = nowIso();
  const result = db
    .prepare(
      `UPDATE share_links
       SET active = 0, revoked_at = ?
       WHERE token = ?
         AND board_id IN (SELECT id FROM boards WHERE owner_id = ?)`
    )
    .run(timestamp, request.params.token, ownerId);

  if (result.changes === 0) {
    return reply.code(404).send({ error: "Share link not found" });
  }

  return { revoked: true, token: request.params.token };
});

app.get<{ Params: { token: string } }>("/api/share/:token", async (request, reply) => {
  const row = db
    .prepare(
      `SELECT sl.expires_at as expiresAt, bv.snapshot_json as snapshotJson
       FROM share_links sl
       JOIN board_versions bv ON bv.id = sl.version_id
       WHERE sl.token = ? AND sl.active = 1`
    )
    .get(request.params.token) as { expiresAt: string | null; snapshotJson: string } | undefined;

  if (!row) {
    return reply.code(404).send({ error: "Share link not found" });
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    return reply.code(410).send({ error: "Share link expired" });
  }

  reply.header("Cache-Control", "public, max-age=10, stale-while-revalidate=20");
  return { board: JSON.parse(row.snapshotJson) };
});

// SSE: el alumno recibe actualizaciones en tiempo real cuando el docente publica.
// Nota Nginx: añadir `proxy_buffering off;` en la location /api/share/ para que fluya.
app.get<{ Params: { token: string } }>("/api/share/:token/stream", async (request, reply) => {
  type ShareRow = { active: number; expiresAt: string | null; versionId: string | null; snapshotJson: string | null };

  const initial = db
    .prepare(
      `SELECT sl.active, sl.expires_at as expiresAt, sl.version_id as versionId, bv.snapshot_json as snapshotJson
       FROM share_links sl
       LEFT JOIN board_versions bv ON bv.id = sl.version_id
       WHERE sl.token = ?`
    )
    .get(request.params.token) as ShareRow | undefined;

  if (!initial || !initial.active) {
    return reply.code(404).send({ error: "Share link not found" });
  }

  if (initial.expiresAt && new Date(initial.expiresAt).getTime() < Date.now()) {
    return reply.code(410).send({ error: "Share link expired" });
  }

  const raw = reply.raw;
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  function send(data: object) {
    if (!raw.destroyed) raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Estado inicial al conectar — evita un HTTP round-trip separado
  if (initial.snapshotJson) {
    send({ type: "connected", board: JSON.parse(initial.snapshotJson) });
  } else {
    send({ type: "connected" });
  }

  let lastVersionId = initial.versionId;

  // Polling ligero de la DB (2s) — emite solo cuando el docente publica
  const pollInterval = setInterval(() => {
    if (raw.destroyed) return;
    type PollRow = { active: number; versionId: string | null; snapshotJson: string | null };
    const current = db
      .prepare(
        `SELECT sl.active, sl.version_id as versionId, bv.snapshot_json as snapshotJson
         FROM share_links sl
         LEFT JOIN board_versions bv ON bv.id = sl.version_id
         WHERE sl.token = ?`
      )
      .get(request.params.token) as PollRow | undefined;

    if (!current || !current.active) {
      send({ type: "revoked" });
      clearInterval(pollInterval);
      clearInterval(keepAlive);
      raw.end();
      return;
    }

    if (current.versionId !== lastVersionId && current.snapshotJson) {
      lastVersionId = current.versionId;
      send({ type: "update", board: JSON.parse(current.snapshotJson) });
    }
  }, 2000);

  // Ping cada 25s para mantener viva la conexión a través de proxies
  const keepAlive = setInterval(() => {
    if (!raw.destroyed) raw.write(":ping\n\n");
  }, 25000);

  function cleanup() {
    clearInterval(pollInterval);
    clearInterval(keepAlive);
  }

  request.raw.on("close", cleanup);
  request.raw.on("error", cleanup);

  await new Promise<void>((resolve) => request.raw.on("close", resolve));
});

// ── Sala de clase ─────────────────────────────────────────────────────────────
// Bus de eventos en memoria para SSE en tiempo real (proceso único Node.js)
type ClassroomAudience = "students" | "teacher";
type SendFn = (eventId: number, data: object) => void;
const studentBus = new Map<string, Set<SendFn>>();
const teacherBus = new Map<string, Set<SendFn>>();

type ClassroomEventRow = {
  id: number;
  event_json: string;
};

type ClassroomResponseRow = {
  id: string;
  type: string;
  payload: string;
  student_label: string | null;
  created_at: string;
};

function serializeClassroomResponse(row: ClassroomResponseRow) {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    studentLabel: row.student_label,
    createdAt: row.created_at
  };
}

function salaSse(eventId: number, data: object) {
  return `id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;
}

function pruneOldClassroomEvents() {
  const cutoff = new Date(Date.now() - classroomEventRetentionHours * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM classroom_events WHERE created_at < ?").run(cutoff);
}

function getLastClassroomEventId(code: string, audience: ClassroomAudience) {
  const row = db
    .prepare("SELECT COALESCE(MAX(id), 0) as id FROM classroom_events WHERE session_code = ? AND audience = ?")
    .get(code, audience) as { id: number };
  return Number(row.id ?? 0);
}

function publishClassroomEvent(code: string, audience: ClassroomAudience, data: object) {
  const info = db
    .prepare("INSERT INTO classroom_events (session_code, audience, event_json, created_at) VALUES (?, ?, ?, ?)")
    .run(code, audience, JSON.stringify(data), nowIso());
  if (Number(info.lastInsertRowid) % 250 === 0) pruneOldClassroomEvents();

  const listeners = audience === "students" ? studentBus.get(code) : teacherBus.get(code);
  if (!listeners?.size) return;
  for (const send of [...listeners]) {
    try { send(Number(info.lastInsertRowid), data); } catch { listeners.delete(send); }
  }
}

function fetchClassroomEvents(code: string, audience: ClassroomAudience, afterId: number) {
  return db
    .prepare(
      `SELECT id, event_json
       FROM classroom_events
       WHERE session_code = ? AND audience = ? AND id > ?
       ORDER BY id ASC
       LIMIT 100`
    )
    .all(code, audience, afterId) as ClassroomEventRow[];
}

function streamStoredClassroomEvents(code: string, audience: ClassroomAudience, afterId: number, send: SendFn) {
  const rows = fetchClassroomEvents(code, audience, afterId);
  for (const row of rows) {
    send(row.id, JSON.parse(row.event_json) as object);
  }
}

function generateSalaCode(): string {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const existing = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND active = 1").get(code);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique sala code");
}

// Crear sala (docente)
app.post("/api/sala", async (request, reply) => {
  const teacherId = requireTeacher(request);
  // Cierra sesiones activas previas de este docente
  db.prepare("UPDATE classroom_sessions SET active = 0 WHERE teacher_id = ? AND active = 1").run(teacherId);
  const code = generateSalaCode();
  const now = nowIso();
  db.prepare(
    "INSERT INTO classroom_sessions (code, teacher_id, board_json, active, created_at, updated_at) VALUES (?, ?, NULL, 1, ?, ?)"
  ).run(code, teacherId, now, now);
  return reply.code(201).send({ code, url: `/aula/${code}` });
});

// Enviar board a los alumnos (docente)
app.put<{ Params: { code: string } }>("/api/sala/:code/board", async (request, reply) => {
  const teacherId = requireTeacher(request);
  const { code } = request.params;
  const body = request.body as { board?: unknown };
  const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
  if (!session) return reply.code(404).send({ error: "Sala not found" });
  const boardJson = JSON.stringify(body.board ?? {});
  db.prepare("UPDATE classroom_sessions SET board_json = ?, updated_at = ? WHERE code = ?").run(boardJson, nowIso(), code);
  publishClassroomEvent(code, "students", { type: "board", board: body.board });
  return { ok: true };
});

// Listar respuestas recientes (docente)
app.get<{ Params: { code: string } }>("/api/sala/:code/responses", async (request, reply) => {
  const teacherId = requireTeacher(request);
  const { code } = request.params;
  const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
  if (!session) return reply.code(404).send({ error: "Sala not found" });
  const rows = db.prepare(
    "SELECT id, type, payload, student_label, created_at FROM classroom_responses WHERE session_code = ? ORDER BY created_at DESC LIMIT 50"
  ).all(code) as ClassroomResponseRow[];
  return { responses: rows.map(serializeClassroomResponse) };
});

// Limpiar respuestas de la sala (docente)
app.delete<{ Params: { code: string } }>("/api/sala/:code/responses", async (request, reply) => {
  const teacherId = requireTeacher(request);
  const { code } = request.params;
  const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
  if (!session) return reply.code(404).send({ error: "Sala not found" });
  db.prepare("DELETE FROM classroom_responses WHERE session_code = ?").run(code);
  publishClassroomEvent(code, "teacher", { type: "responses:cleared" });
  return { ok: true, code };
});

// Cerrar sala (docente)
app.delete<{ Params: { code: string } }>("/api/sala/:code", async (request, reply) => {
  const teacherId = requireTeacher(request);
  const { code } = request.params;
  db.prepare("UPDATE classroom_sessions SET active = 0 WHERE code = ? AND teacher_id = ?").run(code, teacherId);
  publishClassroomEvent(code, "students", { type: "ended" });
  studentBus.delete(code);
  teacherBus.delete(code);
  return { ok: true, code };
});

// SSE docente: recibe respuestas de alumnos en tiempo real
app.get<{ Params: { code: string } }>("/api/sala/:code/teacher-stream", async (request, reply) => {
  const teacherId = requireTeacher(request);
  const { code } = request.params;
  const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
  if (!session) return reply.code(404).send({ error: "Sala not found" });

  const raw = reply.raw;
  raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });

  const existing = db.prepare(
    "SELECT id, type, payload, student_label, created_at FROM classroom_responses WHERE session_code = ? ORDER BY created_at DESC LIMIT 20"
  ).all(code) as ClassroomResponseRow[];
  raw.write(`data: ${JSON.stringify({ type: "connected", responses: existing.map(serializeClassroomResponse) })}\n\n`);

  let lastEventId = getLastClassroomEventId(code, "teacher");
  const send: SendFn = (eventId, data) => {
    if (raw.destroyed || eventId <= lastEventId) return;
    lastEventId = eventId;
    raw.write(salaSse(eventId, data));
  };
  if (!teacherBus.has(code)) teacherBus.set(code, new Set());
  teacherBus.get(code)!.add(send);

  const poll = setInterval(() => streamStoredClassroomEvents(code, "teacher", lastEventId, send), 1200);
  const ping = setInterval(() => { if (!raw.destroyed) raw.write(":ping\n\n"); }, 25000);
  const cleanup = () => { clearInterval(poll); clearInterval(ping); teacherBus.get(code)?.delete(send); };
  request.raw.on("close", cleanup);
  request.raw.on("error", cleanup);
  await new Promise<void>((resolve) => request.raw.on("close", resolve));
});

// Info sesión para alumno (sin auth)
app.get<{ Params: { code: string } }>("/api/sala/:code", async (request, reply) => {
  type SessionRow = { code: string; board_json: string | null; active: number };
  const session = db.prepare("SELECT code, board_json, active FROM classroom_sessions WHERE code = ?").get(request.params.code) as SessionRow | undefined;
  if (!session || !session.active) return reply.code(404).send({ error: "Sala not found or inactive" });
  return { code: session.code, board: session.board_json ? JSON.parse(session.board_json) : null };
});

// Respuesta de alumno (sin auth, rate-limited)
app.post<{ Params: { code: string } }>("/api/sala/:code/response", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
  const { code } = request.params;
  const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND active = 1").get(code);
  if (!session) return reply.code(404).send({ error: "Sala not found" });
  const body = request.body as { type?: string; payload?: unknown; studentLabel?: string };
  if (!body.type || !["emoji", "hand", "status"].includes(body.type)) {
    return reply.code(400).send({ error: "Invalid response type" });
  }
  const id = randomUUID();
  const now = nowIso();
  const payloadJson = JSON.stringify(body.payload ?? {});
  const label = typeof body.studentLabel === "string" ? body.studentLabel.slice(0, 40) : null;
  db.prepare("INSERT INTO classroom_responses (id, session_code, type, payload, student_label, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, code, body.type, payloadJson, label, now);
  const response = { id, type: body.type, payload: body.payload ?? {}, studentLabel: label, createdAt: now };
  publishClassroomEvent(code, "teacher", { type: "response", response });
  return reply.code(201).send({ ok: true });
});

// SSE alumno: recibe board en tiempo real (sin auth)
app.get<{ Params: { code: string } }>("/api/sala/:code/stream", async (request, reply) => {
  type SessionRow = { code: string; board_json: string | null; active: number };
  const session = db.prepare("SELECT code, board_json, active FROM classroom_sessions WHERE code = ?").get(request.params.code) as SessionRow | undefined;
  if (!session || !session.active) return reply.code(404).send({ error: "Sala not found" });

  const raw = reply.raw;
  raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });

  const board = session.board_json ? JSON.parse(session.board_json) : null;
  raw.write(`data: ${JSON.stringify({ type: "connected", board })}\n\n`);

  let lastEventId = getLastClassroomEventId(request.params.code, "students");
  const send: SendFn = (eventId, data) => {
    if (raw.destroyed || eventId <= lastEventId) return;
    lastEventId = eventId;
    raw.write(salaSse(eventId, data));
  };
  if (!studentBus.has(request.params.code)) studentBus.set(request.params.code, new Set());
  studentBus.get(request.params.code)!.add(send);

  const poll = setInterval(() => streamStoredClassroomEvents(request.params.code, "students", lastEventId, send), 1200);
  const ping = setInterval(() => { if (!raw.destroyed) raw.write(":ping\n\n"); }, 25000);
  const cleanup = () => { clearInterval(poll); clearInterval(ping); studentBus.get(request.params.code)?.delete(send); };
  request.raw.on("close", cleanup);
  request.raw.on("error", cleanup);
  await new Promise<void>((resolve) => request.raw.on("close", resolve));
});

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });
