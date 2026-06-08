// EDUmind Board — autenticación
// Llama al propio backend de board (/api/auth/me), que gestiona
// el flujo OIDC completo contra Authentik. No depende de ninguna
// otra app EDUmind.

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "");

export type AuthUser = {
  id: string | number;
  username: string;
  email: string;
  role: string;
};

export type AuthState =
  | { status: "checking" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" };

// Comprueba si el usuario tiene sesión activa en board.
// La cookie HttpOnly la gestiona el propio backend de board (OIDC con Authentik).
// Falla silenciosamente a modo anónimo si la API no responde.
export async function checkAuth(): Promise<AuthState> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
      credentials: "include",
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { status: "anonymous" };
    const payload = (await res.json()) as { user: AuthUser };
    return { status: "authenticated", user: payload.user };
  } catch {
    return { status: "anonymous" };
  }
}

// Redirige al flujo OIDC propio de board (→ Authentik → vuelve aquí)
export function getLoginUrl(): string {
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  return `${apiBaseUrl}/api/auth/oidc/start?next=${next}`;
}

// Cierra sesión en board
export function getLogoutUrl(): string {
  return `${apiBaseUrl}/api/auth/logout?next=${encodeURIComponent("/")}`;
}

const BANNER_DISMISSED_KEY = "edumind-board.auth-banner-dismissed";

export function isBannerDismissed(): boolean {
  return sessionStorage.getItem(BANNER_DISMISSED_KEY) === "1";
}

export function dismissBanner(): void {
  sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
}
