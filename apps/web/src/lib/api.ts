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

export async function searchArasaac(query: string) {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("limit", "12");
  return apiFetch<{ results: ArasaacPictogram[]; cached: boolean; stale: boolean }>(
    `/api/arasaac/search?${params.toString()}`
  );
}
