// Sesión propia de Board: cookie HttpOnly firmada con HMAC.
// La única autenticación válida es esta cookie (OIDC via Authentik).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { secureCookies, sessionCookieName, sessionSecret, webBaseUrl } from "../env.js";

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
};

export type ClaimsAuthUser = AuthUser & {
  groups: string[];
};

export type AuthSession = AuthUser & {
  idToken?: string;
};

export function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

export function parseCookies(request: FastifyRequest) {
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

export function buildCookie(name: string, value: string, maxAgeSeconds?: number) {
  return `${name}=${encodeURIComponent(value)}; ${cookieAttributes(maxAgeSeconds)}`;
}

export function clearCookie(name: string) {
  return buildCookie(name, "", 0);
}

export function publicUser(session: AuthSession): AuthUser {
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    role: session.role
  };
}

export function signSession(session: AuthSession) {
  const payload = base64Url(JSON.stringify({
    ...session,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 8
  }));
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(value: string | undefined): AuthSession | null {
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

export function authSessionFromRequest(request: FastifyRequest): AuthSession | null {
  return verifySession(parseCookies(request).get(sessionCookieName));
}

export function authUserFromRequest(request: FastifyRequest): AuthUser | null {
  const session = authSessionFromRequest(request);
  return session ? publicUser(session) : null;
}

export function requireTeacher(request: FastifyRequest) {
  const user = authUserFromRequest(request);
  if (!user?.id) {
    const error = new Error("Authentication required");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  return String(user.id);
}

export function sanitizeNext(nextValue: unknown) {
  const fallback = "/";
  if (typeof nextValue !== "string" || !nextValue.trim()) return fallback;
  const candidate = nextValue.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/api/")) return fallback;
  return candidate;
}

export function webRedirect(nextValue: unknown) {
  return `${webBaseUrl}${sanitizeNext(nextValue)}`;
}
