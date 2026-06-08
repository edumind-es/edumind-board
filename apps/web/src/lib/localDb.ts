import { openDB } from "idb";
import type { BoardDocument } from "@edumind-board/shared";

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

export async function saveBoardLocal(board: BoardDocument) {
  const db = await dbPromise;
  await db.put("boards", board);
  await db.put("meta", board.id, "lastBoardId");
}

export async function loadBoardLocal(id: string) {
  const db = await dbPromise;
  return (await db.get("boards", id)) as BoardDocument | undefined;
}

export async function loadLastBoardLocal() {
  const db = await dbPromise;
  const lastBoardId = (await db.get("meta", "lastBoardId")) as string | undefined;
  if (!lastBoardId) return undefined;
  return loadBoardLocal(lastBoardId);
}

export async function listBoardsLocal(): Promise<BoardSummary[]> {
  const db = await dbPromise;
  const boards = (await db.getAll("boards")) as BoardDocument[];
  return boards
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
    const boards = (await db.getAll("boards")) as BoardDocument[];
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
