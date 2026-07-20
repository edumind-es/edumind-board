// EDUmind Board — cliente API
// La autenticación se realiza exclusivamente via cookie HttpOnly (gestionada por el backend).
// No se envían headers de identificación manuales: las cookies van automáticamente con
// credentials: "include".

import type { BoardDocument } from "@edumind-board/shared";

export type EduResource = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  kind: "html" | "pdf";
  updatedAt: string;
};

export type ArasaacPictogram = {
  id: number;
  label: string;
  url: string;
};

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "");

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function publishBoard(board: BoardDocument) {
  return apiFetch<{ published: true; versionId: string; versionNumber: number; updatedAt: string }>(
    `/api/boards/${board.id}/publish`,
    { method: "PUT", body: JSON.stringify({ board }) }
  );
}

// ── Sincronización de tableros local ↔ nube (requiere sesión) ──────────────

export type RemoteBoardSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  publishedVersionId: string | null;
};

// Metadatos de los tableros del usuario en el servidor (para reconciliar).
export async function listRemoteBoards() {
  return apiFetch<{ boards: RemoteBoardSummary[] }>("/api/boards");
}

// Documento completo de un tablero del servidor.
export async function fetchRemoteBoard(id: string) {
  return apiFetch<{ board: BoardDocument }>(`/api/boards/${id}`);
}

// Resultado del push: "saved" si el servidor aceptó, "conflict" si el servidor
// tenía una versión más nueva (se devuelve su copia para reconciliar).
export type PushResult =
  | { status: "saved"; updatedAt: string }
  | { status: "conflict"; board: BoardDocument };

// Guarda el borrador en el servidor (upsert). No usa apiFetch porque el 409 de
// conflicto no es un error: trae la copia del servidor.
export async function pushRemoteBoard(board: BoardDocument): Promise<PushResult> {
  const response = await fetch(`${apiBaseUrl}/api/boards/${board.id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board })
  });

  if (response.status === 409) {
    const payload = (await response.json()) as { board: BoardDocument };
    return { status: "conflict", board: payload.board };
  }
  if (!response.ok) {
    throw new Error((await response.text()) || `Push falló con ${response.status}`);
  }
  const payload = (await response.json()) as { updatedAt: string };
  return { status: "saved", updatedAt: payload.updatedAt };
}

// Borra el tablero del servidor. El 404 (no existía en la nube) se trata como
// éxito silencioso: el objetivo —que no esté en el servidor— se cumple igual.
export async function deleteRemoteBoard(id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/boards/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok && response.status !== 404) {
    throw new Error((await response.text()) || `Borrado remoto falló con ${response.status}`);
  }
}

export async function createShare(boardId: string) {
  return apiFetch<{ token: string; url: string; expiresAt: string | null }>(
    `/api/boards/${boardId}/share`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function listShares(boardId: string) {
  return apiFetch<{
    shares: Array<{ token: string; active: boolean; expiresAt: string | null; createdAt: string; revokedAt: string | null }>;
  }>(`/api/boards/${boardId}/shares`);
}

export async function revokeShare(token: string) {
  return apiFetch<{ revoked: true; token: string }>(`/api/share/${token}`, { method: "DELETE" });
}

export async function loadSharedBoard(token: string) {
  const response = await fetch(`${apiBaseUrl}/api/share/${token}`);
  if (!response.ok) throw new Error(`No se pudo cargar el board compartido (${response.status})`);
  return (await response.json()) as { board: BoardDocument };
}

export async function listResources(query = "") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  params.set("limit", "80");
  return apiFetch<{ resources: EduResource[] }>(`/api/resources?${params.toString()}`);
}

export type BoardVersionSummary = {
  id: string;
  versionNumber: number;
  createdAt: string;
  isPublished: boolean;
};

export async function listBoardVersions(boardId: string) {
  return apiFetch<{ versions: BoardVersionSummary[] }>(`/api/boards/${boardId}/versions`);
}

export async function getBoardVersion(boardId: string, versionId: string) {
  return apiFetch<{ version: { id: string; versionNumber: number; createdAt: string; board: BoardDocument } }>(
    `/api/boards/${boardId}/versions/${versionId}`
  );
}

// Sube un archivo al servidor (docente autenticado). El board guarda solo la
// URL, no el base64: las versiones publicadas dejan de duplicar el archivo.
export async function uploadAsset(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return apiFetch<{ id: string; url: string; name: string; mimeType: string; sizeBytes: number }>(
    "/api/uploads",
    { method: "POST", body: JSON.stringify({ name: file.name, mimeType: file.type, dataBase64 }) }
  );
}

export async function searchArasaac(query: string) {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("limit", "12");
  return apiFetch<{ results: ArasaacPictogram[]; cached: boolean; stale: boolean }>(
    `/api/arasaac/search?${params.toString()}`
  );
}
