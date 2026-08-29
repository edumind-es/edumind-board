// Recursos educativos: catálogo EDUmind (web + fallback local), pictogramas
// ARASAAC con caché SQLite y proxy seguro de contenido embebido.
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { isAllowedEmbedUrl } from "@edumind-board/shared";
import { db, nowIso } from "../db.js";
import {
  appBaseUrl,
  arasaacCacheTtlHours,
  resourcesCatalogUrl,
  resourcesFrameAncestors,
  resourcesRoot,
  secureCookies
} from "../env.js";

export type ResourceItem = {
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

// ── Caché en memoria del catálogo remoto ────────────────────────────────────
// Evita re-scrapear la web de EDUmind en cada petición (antes: 1 fetch por
// /api/resources y por cada /api/resource-embed). Si el scraping falla se
// sirve la última copia aunque haya caducado.
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
let catalogCache: { fetchedAt: number; resources: ResourceItem[] } | null = null;

async function fetchCatalogResources(): Promise<ResourceItem[]> {
  const response = await fetch(resourcesCatalogUrl, {
    headers: { "accept": "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(10000)
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

export async function discoverCatalogResources(): Promise<ResourceItem[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache.resources;
  }
  try {
    const resources = await fetchCatalogResources();
    catalogCache = { fetchedAt: now, resources };
    return resources;
  } catch (error) {
    // Copia caducada mejor que fallo total
    if (catalogCache) return catalogCache.resources;
    throw error;
  }
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

export async function resourceRoutes(app: FastifyInstance) {
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
      .header("Content-Security-Policy", `frame-ancestors ${resourcesFrameAncestors}`)
      .header("Cache-Control", isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=604800");

    return reply.send(createReadStream(absolute));
  });
}
