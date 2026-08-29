// Integración OIDC con Authentik: metadata, JWKS, verificación de id_token
// y persistencia del usuario autenticado.
import { createHash, createPublicKey, verify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import { appBaseUrl, authClientId, authClientSecret, authEnabled, authIssuer } from "../env.js";
import { db, nowIso } from "../db.js";
import { decodeBase64UrlJson, type ClaimsAuthUser } from "./session.js";

let oidcMetadataCache: { expiresAt: number; metadata: Record<string, string> } | null = null;
let oidcJwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

export function ensureOidcConfigured() {
  if (!authEnabled || !authIssuer || !authClientId || !authClientSecret) {
    const error = new Error("Board SSO is not configured");
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
}

export async function fetchOidcMetadata() {
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

export async function fetchOidcJwks(metadata: Record<string, string>) {
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

export function redirectUri() {
  return `${appBaseUrl}/api/auth/oidc/callback`;
}

export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function verifyIdToken(idToken: string, metadata: Record<string, string>, expectedNonce: string) {
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

export function userFromClaims(claims: Record<string, unknown>): ClaimsAuthUser {
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

export function persistAuthUser(user: ClaimsAuthUser) {
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
