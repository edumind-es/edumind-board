// Rutas de autenticación: config, sesión, health y flujo OIDC completo.
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { appBaseUrl, authClientId, authClientSecret, authEnabled, authScopes, sessionCookieName, webBaseUrl } from "../env.js";
import {
  authSessionFromRequest,
  buildCookie,
  clearCookie,
  parseCookies,
  publicUser,
  sanitizeNext,
  signSession,
  webRedirect
} from "../auth/session.js";
import {
  codeChallenge,
  fetchOidcJwks,
  fetchOidcMetadata,
  persistAuthUser,
  redirectUri,
  userFromClaims,
  verifyIdToken
} from "../auth/oidc.js";

export async function authRoutes(app: FastifyInstance) {
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
}
