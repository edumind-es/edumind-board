// Rutas de boards: CRUD, publicación con versionado, borrado y enlaces compartidos.
import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  boardDocumentSchema,
  createBoardSchema,
  createShareSchema,
  isAllowedEmbedUrl,
  publishBoardSchema
} from "@edumind-board/shared";
import { db, nowIso } from "../db.js";
import { requireTeacher } from "../auth/session.js";

function shareToken() {
  return randomBytes(32).toString("base64url");
}

export function hasBlockedEmbeds(board: { elements: Array<{ type: string; data: unknown }> }) {
  return board.elements.some((element) => {
    if (element.type !== "iframe") return false;
    const data = element.data as { url?: unknown };
    return typeof data.url !== "string" || !isAllowedEmbedUrl(data.url);
  });
}

export async function boardRoutes(app: FastifyInstance) {
  app.get("/api/boards", async (request) => {
    const ownerId = requireTeacher(request);
    const rows = db
      .prepare(
        `SELECT id, title, created_at as createdAt, updated_at as updatedAt, published_version_id as publishedVersionId
         FROM boards WHERE owner_id = ? ORDER BY updated_at DESC`
      )
      .all(ownerId);
    return { boards: rows };
  });

  app.post("/api/boards", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const input = createBoardSchema.parse(request.body ?? {});
    const timestamp = nowIso();
    const board = boardDocumentSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      title: input.title,
      theme: "edumind",
      viewport: { x: 0, y: 0, zoom: 1 },
      elements: [],
      updatedAt: timestamp
    });

    db.prepare(
      `INSERT INTO boards (id, owner_id, title, draft_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(board.id, ownerId, board.title, JSON.stringify(board), timestamp, timestamp);

    return reply.code(201).send({ board });
  });

  app.get<{ Params: { id: string } }>("/api/boards/:id", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const row = db
      .prepare("SELECT draft_json FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId) as { draft_json: string } | undefined;

    if (!row) {
      return reply.code(404).send({ error: "Board not found" });
    }

    return { board: JSON.parse(row.draft_json) };
  });

  // Guardado del borrador (sincronización local↔nube). A diferencia de POST
  // (que genera un id nuevo) y de /publish (que crea una versión), esto hace un
  // upsert del borrador conservando el id del cliente, sin versionar.
  // Conflicto: si el servidor ya tiene una versión más NUEVA (otro dispositivo
  // guardó después), no se pisa: se responde 409 con la copia del servidor para
  // que el cliente reconcilie (resolución por updatedAt).
  app.put<{ Params: { id: string } }>("/api/boards/:id", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const body = (request.body ?? {}) as { board?: unknown };
    const board = boardDocumentSchema.parse(body.board ?? request.body);
    if (board.id !== request.params.id) {
      return reply.code(400).send({ error: "Board id mismatch" });
    }

    const existing = db
      .prepare("SELECT draft_json as draftJson, updated_at as updatedAt FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId) as { draftJson: string; updatedAt: string } | undefined;

    if (existing && Date.parse(existing.updatedAt) > Date.parse(board.updatedAt)) {
      return reply.code(409).send({ conflict: true, board: JSON.parse(existing.draftJson) });
    }

    const json = JSON.stringify(board);
    if (existing) {
      db.prepare("UPDATE boards SET title = ?, draft_json = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
        .run(board.title, json, board.updatedAt, board.id, ownerId);
    } else {
      db.prepare(
        `INSERT INTO boards (id, owner_id, title, draft_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(board.id, ownerId, board.title, json, nowIso(), board.updatedAt);
    }

    return { saved: true, boardId: board.id, updatedAt: board.updatedAt };
  });

  app.put<{ Params: { id: string } }>("/api/boards/:id/publish", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const input = publishBoardSchema.parse(request.body);
    if (input.board.id !== request.params.id) {
      return reply.code(400).send({ error: "Board id mismatch" });
    }

    if (hasBlockedEmbeds(input.board)) {
      return reply.code(422).send({ error: "Board contains iframe URLs outside the allowed embed list" });
    }

    const existing = db
      .prepare("SELECT id FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId);

    const versionRow = db
      .prepare("SELECT COALESCE(MAX(version_number), 0) + 1 as nextVersion FROM board_versions WHERE board_id = ?")
      .get(input.board.id) as { nextVersion: number };

    const versionId = randomUUID();
    const timestamp = nowIso();
    const snapshotJson = JSON.stringify({ ...input.board, updatedAt: timestamp });

    const transaction = db.transaction(() => {
      if (!existing) {
        db.prepare(
          `INSERT INTO boards (id, owner_id, title, draft_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(input.board.id, ownerId, input.board.title, snapshotJson, timestamp, timestamp);
      }

      db.prepare(
        `INSERT INTO board_versions (id, board_id, version_number, snapshot_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(versionId, input.board.id, versionRow.nextVersion, snapshotJson, timestamp);

      db.prepare(
        `UPDATE boards
         SET title = ?, draft_json = ?, updated_at = ?, published_version_id = ?
         WHERE id = ? AND owner_id = ?`
      ).run(input.board.title, snapshotJson, timestamp, versionId, input.board.id, ownerId);

      db.prepare(
        `UPDATE share_links
         SET version_id = ?
         WHERE board_id = ? AND active = 1`
      ).run(versionId, input.board.id);
    });

    transaction();

    return {
      published: true,
      boardId: input.board.id,
      versionId,
      versionNumber: versionRow.nextVersion,
      updatedAt: timestamp
    };
  });

  // Borra el board del servidor con sus versiones y enlaces (cascada por FK).
  // La copia local del navegador no se ve afectada.
  app.delete<{ Params: { id: string } }>("/api/boards/:id", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const result = db
      .prepare("DELETE FROM boards WHERE id = ? AND owner_id = ?")
      .run(request.params.id, ownerId);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Board not found" });
    }

    return { deleted: true, boardId: request.params.id };
  });

  // Historial de versiones publicadas (metadatos, sin snapshots)
  app.get<{ Params: { id: string } }>("/api/boards/:id/versions", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const board = db
      .prepare("SELECT published_version_id as publishedVersionId FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId) as { publishedVersionId: string | null } | undefined;

    if (!board) {
      return reply.code(404).send({ error: "Board not found" });
    }

    const rows = db
      .prepare(
        `SELECT id, version_number as versionNumber, created_at as createdAt
         FROM board_versions
         WHERE board_id = ?
         ORDER BY version_number DESC
         LIMIT 50`
      )
      .all(request.params.id) as Array<{ id: string; versionNumber: number; createdAt: string }>;

    return {
      versions: rows.map((row) => ({
        ...row,
        isPublished: row.id === board.publishedVersionId
      }))
    };
  });

  // Snapshot completo de una versión concreta (para previsualizar/restaurar)
  app.get<{ Params: { id: string; versionId: string } }>("/api/boards/:id/versions/:versionId", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const board = db
      .prepare("SELECT id FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId);

    if (!board) {
      return reply.code(404).send({ error: "Board not found" });
    }

    const row = db
      .prepare(
        `SELECT snapshot_json as snapshotJson, version_number as versionNumber, created_at as createdAt
         FROM board_versions
         WHERE id = ? AND board_id = ?`
      )
      .get(request.params.versionId, request.params.id) as
        { snapshotJson: string; versionNumber: number; createdAt: string } | undefined;

    if (!row) {
      return reply.code(404).send({ error: "Version not found" });
    }

    return {
      version: {
        id: request.params.versionId,
        versionNumber: row.versionNumber,
        createdAt: row.createdAt,
        board: JSON.parse(row.snapshotJson)
      }
    };
  });

  app.post<{ Params: { id: string } }>("/api/boards/:id/share", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const input = createShareSchema.parse(request.body ?? {});
    const row = db
      .prepare("SELECT published_version_id as versionId FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId) as { versionId: string | null } | undefined;

    if (!row) {
      return reply.code(404).send({ error: "Board not found" });
    }

    if (!row.versionId) {
      return reply.code(409).send({ error: "Publish the board before creating a share link" });
    }

    const token = shareToken();
    db.prepare(
      `INSERT INTO share_links (token, board_id, version_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(token, request.params.id, row.versionId, input.expiresAt ?? null, nowIso());

    return reply.code(201).send({
      token,
      url: `/share/${token}`,
      expiresAt: input.expiresAt ?? null
    });
  });

  app.get<{ Params: { id: string } }>("/api/boards/:id/shares", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const board = db
      .prepare("SELECT id FROM boards WHERE id = ? AND owner_id = ?")
      .get(request.params.id, ownerId);

    if (!board) {
      return reply.code(404).send({ error: "Board not found" });
    }

    const rows = db
      .prepare(
        `SELECT token,
                active = 1 as active,
                expires_at as expiresAt,
                created_at as createdAt,
                revoked_at as revokedAt
         FROM share_links
         WHERE board_id = ?
         ORDER BY created_at DESC`
      )
      .all(request.params.id) as Array<{
        token: string;
        active: number;
        expiresAt: string | null;
        createdAt: string;
        revokedAt: string | null;
      }>;

    return { shares: rows.map((row) => ({ ...row, active: Boolean(row.active) })) };
  });

  app.delete<{ Params: { token: string } }>("/api/share/:token", async (request, reply) => {
    const ownerId = requireTeacher(request);
    const timestamp = nowIso();
    const result = db
      .prepare(
        `UPDATE share_links
         SET active = 0, revoked_at = ?
         WHERE token = ?
           AND board_id IN (SELECT id FROM boards WHERE owner_id = ?)`
      )
      .run(timestamp, request.params.token, ownerId);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Share link not found" });
    }

    return { revoked: true, token: request.params.token };
  });

  app.get<{ Params: { token: string } }>("/api/share/:token", async (request, reply) => {
    const row = db
      .prepare(
        `SELECT sl.expires_at as expiresAt, bv.snapshot_json as snapshotJson
         FROM share_links sl
         JOIN board_versions bv ON bv.id = sl.version_id
         WHERE sl.token = ? AND sl.active = 1`
      )
      .get(request.params.token) as { expiresAt: string | null; snapshotJson: string } | undefined;

    if (!row) {
      return reply.code(404).send({ error: "Share link not found" });
    }

    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      return reply.code(410).send({ error: "Share link expired" });
    }

    reply.header("Cache-Control", "public, max-age=10, stale-while-revalidate=20");
    return { board: JSON.parse(row.snapshotJson) };
  });

  // SSE: el alumno recibe actualizaciones en tiempo real cuando el docente publica.
  // Nota Nginx: añadir `proxy_buffering off;` en la location /api/share/ para que fluya.
  app.get<{ Params: { token: string } }>("/api/share/:token/stream", async (request, reply) => {
    type ShareRow = { active: number; expiresAt: string | null; versionId: string | null; snapshotJson: string | null };

    const initial = db
      .prepare(
        `SELECT sl.active, sl.expires_at as expiresAt, sl.version_id as versionId, bv.snapshot_json as snapshotJson
         FROM share_links sl
         LEFT JOIN board_versions bv ON bv.id = sl.version_id
         WHERE sl.token = ?`
      )
      .get(request.params.token) as ShareRow | undefined;

    if (!initial || !initial.active) {
      return reply.code(404).send({ error: "Share link not found" });
    }

    if (initial.expiresAt && new Date(initial.expiresAt).getTime() < Date.now()) {
      return reply.code(410).send({ error: "Share link expired" });
    }

    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    function send(data: object) {
      if (!raw.destroyed) raw.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Estado inicial al conectar — evita un HTTP round-trip separado
    if (initial.snapshotJson) {
      send({ type: "connected", board: JSON.parse(initial.snapshotJson) });
    } else {
      send({ type: "connected" });
    }

    let lastVersionId = initial.versionId;

    // Polling ligero de la DB (2s) — emite solo cuando el docente publica
    const pollInterval = setInterval(() => {
      if (raw.destroyed) return;
      type PollRow = { active: number; versionId: string | null; snapshotJson: string | null };
      const current = db
        .prepare(
          `SELECT sl.active, sl.version_id as versionId, bv.snapshot_json as snapshotJson
           FROM share_links sl
           LEFT JOIN board_versions bv ON bv.id = sl.version_id
           WHERE sl.token = ?`
        )
        .get(request.params.token) as PollRow | undefined;

      if (!current || !current.active) {
        send({ type: "revoked" });
        clearInterval(pollInterval);
        clearInterval(keepAlive);
        raw.end();
        return;
      }

      if (current.versionId !== lastVersionId && current.snapshotJson) {
        lastVersionId = current.versionId;
        send({ type: "update", board: JSON.parse(current.snapshotJson) });
      }
    }, 2000);

    // Ping cada 25s para mantener viva la conexión a través de proxies
    const keepAlive = setInterval(() => {
      if (!raw.destroyed) raw.write(":ping\n\n");
    }, 25000);

    function cleanup() {
      clearInterval(pollInterval);
      clearInterval(keepAlive);
    }

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);

    await new Promise<void>((resolve) => request.raw.on("close", resolve));
  });
}
