// Sincronización de tableros local ↔ nube.
//
// Filosofía local-first: IndexedDB es la fuente de verdad de trabajo y la app
// funciona 100% sin cuenta ni red. Cuando hay sesión EDUmind, la nube es un
// espejo opcional de los tableros del docente. Toda la reconciliación se
// resuelve por `updatedAt` (last-write-wins), sin bloquear la edición.
import type { BoardDocument } from "@edumind-board/shared";
import { listBoardsLocal, loadBoardLocal, upsertBoardLocal } from "./localDb";
import { fetchRemoteBoard, listRemoteBoards, pushRemoteBoard } from "./api";

export type SyncOutcome = { pushed: number; pulled: number; conflicts: number };
export type CloudPush = "saved" | "conflict" | "offline";

// Reconciliación bidireccional (al iniciar sesión o al recuperar la red):
// - tablero solo local        → se sube;
// - tablero solo en la nube    → se baja;
// - en ambos                   → gana el de `updatedAt` más reciente.
// Nunca cambia cuál es el tablero abierto (usa upsertBoardLocal).
export async function reconcileBoards(): Promise<SyncOutcome> {
  const [localList, remote] = await Promise.all([listBoardsLocal(), listRemoteBoards()]);
  const localById = new Map(localList.map((b) => [b.id, b]));
  const remoteById = new Map(remote.boards.map((b) => [b.id, b]));
  const ids = new Set<string>([...localById.keys(), ...remoteById.keys()]);

  let pushed = 0;
  let pulled = 0;
  let conflicts = 0;

  for (const id of ids) {
    const local = localById.get(id);
    const remoteMeta = remoteById.get(id);
    try {
      if (local && !remoteMeta) {
        const doc = await loadBoardLocal(id);
        if (doc) {
          await pushRemoteBoard(doc);
          pushed += 1;
        }
      } else if (!local && remoteMeta) {
        const { board } = await fetchRemoteBoard(id);
        await upsertBoardLocal(board);
        pulled += 1;
      } else if (local && remoteMeta) {
        const localTime = Date.parse(local.updatedAt);
        const remoteTime = Date.parse(remoteMeta.updatedAt);
        if (localTime > remoteTime) {
          const doc = await loadBoardLocal(id);
          if (!doc) continue;
          const result = await pushRemoteBoard(doc);
          if (result.status === "conflict") {
            await upsertBoardLocal(result.board);
            conflicts += 1;
          } else {
            pushed += 1;
          }
        } else if (remoteTime > localTime) {
          const { board } = await fetchRemoteBoard(id);
          await upsertBoardLocal(board);
          pulled += 1;
        }
      }
    } catch (error) {
      // Un fallo puntual (red, un board corrupto) no debe abortar el resto.
      console.warn("Sync: no se pudo reconciliar el tablero", id, error);
    }
  }

  return { pushed, pulled, conflicts };
}

// Sube el tablero activo tras editar. En conflicto (otro dispositivo guardó una
// versión más nueva) NO se pisa la copia en memoria del docente: se informa y,
// como el docente sigue editando, el siguiente guardado tendrá un `updatedAt`
// mayor y ganará. Si no hay red, sigue guardado en local sin ruido.
export async function pushBoard(board: BoardDocument): Promise<CloudPush> {
  try {
    const result = await pushRemoteBoard(board);
    return result.status === "conflict" ? "conflict" : "saved";
  } catch {
    return "offline";
  }
}
