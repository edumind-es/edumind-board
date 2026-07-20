import { openDB } from "idb";
import { boardDocumentSchema, type BoardDocument } from "@edumind-board/shared";

export type BoardSummary = {
  id: string;
  title: string;
  theme: BoardDocument["theme"];
  updatedAt: string;
  elementCount: number;
};

const dbPromise = openDB("edumind-board", 1, {
  upgrade(db) {
    db.createObjectStore("boards", { keyPath: "id" });
    db.createObjectStore("meta");
  }
});

// Valida contra el schema compartido lo que sale de IndexedDB: un board
// corrupto (bug antiguo, migración) no debe crashear el canvas. El schema
// rellena defaults, así que boards de versiones previas siguen cargando.
function parseStoredBoard(raw: unknown): BoardDocument | undefined {
  const result = boardDocumentSchema.safeParse(raw);
  if (result.success) return result.data;
  console.warn("Board local descartado por schema inválido", result.error.issues.slice(0, 3));
  return undefined;
}

export async function saveBoardLocal(board: BoardDocument) {
  const db = await dbPromise;
  await db.put("boards", board);
  await db.put("meta", board.id, "lastBoardId");
}

// Guarda el board SIN tocar cuál es el último abierto. Lo usa la sincronización,
// que escribe muchos tableros al reconciliar y no debe cambiar la sesión activa
// del docente (a diferencia de saveBoardLocal, que sí fija "lastBoardId").
export async function upsertBoardLocal(board: BoardDocument) {
  const db = await dbPromise;
  await db.put("boards", board);
}

export async function loadBoardLocal(id: string) {
  const db = await dbPromise;
  return parseStoredBoard(await db.get("boards", id));
}

export async function loadLastBoardLocal() {
  const db = await dbPromise;
  const lastBoardId = (await db.get("meta", "lastBoardId")) as string | undefined;
  if (!lastBoardId) return undefined;
  return loadBoardLocal(lastBoardId);
}

export async function listBoardsLocal(): Promise<BoardSummary[]> {
  const db = await dbPromise;
  const boards = (await db.getAll("boards")) as unknown[];
  return boards
    .map(parseStoredBoard)
    .filter((board): board is BoardDocument => Boolean(board))
    .map((board) => ({
      id: board.id,
      title: board.title,
      theme: board.theme,
      updatedAt: board.updatedAt,
      elementCount: board.elements.length
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteBoardLocal(id: string) {
  const db = await dbPromise;
  await db.delete("boards", id);
  const lastBoardId = (await db.get("meta", "lastBoardId")) as string | undefined;
  if (lastBoardId === id) {
    const boards = ((await db.getAll("boards")) as unknown[])
      .map(parseStoredBoard)
      .filter((board): board is BoardDocument => Boolean(board));
    const next = boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (next) {
      await db.put("meta", next.id, "lastBoardId");
    } else {
      await db.delete("meta", "lastBoardId");
    }
  }
}

export async function rememberLastBoard(id: string) {
  const db = await dbPromise;
  await db.put("meta", id, "lastBoardId");
}
