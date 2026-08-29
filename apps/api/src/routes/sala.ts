// Sala de clase: sesiones en vivo docente↔alumnos con SSE.
// Bus de eventos en memoria (proceso único Node.js) + poll de respaldo sobre SQLite.
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { boardDocumentSchema } from "@edumind-board/shared";
import { db, nowIso } from "../db.js";
import { requireTeacher } from "../auth/session.js";
import { classroomEventRetentionHours } from "../env.js";
import { hasBlockedEmbeds } from "./boards.js";

type ClassroomAudience = "students" | "teacher";
type SendFn = (eventId: number, data: object) => void;
const studentBus = new Map<string, Set<SendFn>>();
const teacherBus = new Map<string, Set<SendFn>>();

type ClassroomEventRow = {
  id: number;
  event_json: string;
};

type ClassroomResponseRow = {
  id: string;
  type: string;
  payload: string;
  student_label: string | null;
  created_at: string;
};

function serializeClassroomResponse(row: ClassroomResponseRow) {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    studentLabel: row.student_label,
    createdAt: row.created_at
  };
}

function salaSse(eventId: number, data: object) {
  return `id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;
}

function pruneOldClassroomEvents() {
  const cutoff = new Date(Date.now() - classroomEventRetentionHours * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM classroom_events WHERE created_at < ?").run(cutoff);
}

function getLastClassroomEventId(code: string, audience: ClassroomAudience) {
  const row = db
    .prepare("SELECT COALESCE(MAX(id), 0) as id FROM classroom_events WHERE session_code = ? AND audience = ?")
    .get(code, audience) as { id: number };
  return Number(row.id ?? 0);
}

function publishClassroomEvent(code: string, audience: ClassroomAudience, data: object) {
  const info = db
    .prepare("INSERT INTO classroom_events (session_code, audience, event_json, created_at) VALUES (?, ?, ?, ?)")
    .run(code, audience, JSON.stringify(data), nowIso());
  if (Number(info.lastInsertRowid) % 250 === 0) pruneOldClassroomEvents();

  const listeners = audience === "students" ? studentBus.get(code) : teacherBus.get(code);
  if (!listeners?.size) return;
  for (const send of [...listeners]) {
    try { send(Number(info.lastInsertRowid), data); } catch { listeners.delete(send); }
  }
}

function fetchClassroomEvents(code: string, audience: ClassroomAudience, afterId: number) {
  return db
    .prepare(
      `SELECT id, event_json
       FROM classroom_events
       WHERE session_code = ? AND audience = ? AND id > ?
       ORDER BY id ASC
       LIMIT 100`
    )
    .all(code, audience, afterId) as ClassroomEventRow[];
}

function streamStoredClassroomEvents(code: string, audience: ClassroomAudience, afterId: number, send: SendFn) {
  const rows = fetchClassroomEvents(code, audience, afterId);
  for (const row of rows) {
    send(row.id, JSON.parse(row.event_json) as object);
  }
}

function generateSalaCode(): string {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const existing = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND active = 1").get(code);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique sala code");
}

export async function salaRoutes(app: FastifyInstance) {
  // Crear sala (docente)
  app.post("/api/sala", async (request, reply) => {
    const teacherId = requireTeacher(request);
    // Cierra sesiones activas previas de este docente
    db.prepare("UPDATE classroom_sessions SET active = 0 WHERE teacher_id = ? AND active = 1").run(teacherId);
    const code = generateSalaCode();
    const now = nowIso();
    db.prepare(
      "INSERT INTO classroom_sessions (code, teacher_id, board_json, active, created_at, updated_at) VALUES (?, ?, NULL, 1, ?, ?)"
    ).run(code, teacherId, now, now);
    return reply.code(201).send({ code, url: `/aula/${code}` });
  });

  // Enviar board a los alumnos (docente)
  // El board se valida con el schema compartido antes de retransmitirse:
  // los alumnos nunca reciben un documento malformado ni embeds fuera de la allowlist.
  app.put<{ Params: { code: string } }>("/api/sala/:code/board", async (request, reply) => {
    const teacherId = requireTeacher(request);
    const { code } = request.params;
    const body = request.body as { board?: unknown };
    const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
    if (!session) return reply.code(404).send({ error: "Sala not found" });
    const board = boardDocumentSchema.parse(body.board);
    if (hasBlockedEmbeds(board)) {
      return reply.code(422).send({ error: "Board contains iframe URLs outside the allowed embed list" });
    }
    db.prepare("UPDATE classroom_sessions SET board_json = ?, updated_at = ? WHERE code = ?").run(JSON.stringify(board), nowIso(), code);
    publishClassroomEvent(code, "students", { type: "board", board });
    return { ok: true };
  });

  // Listar respuestas recientes (docente)
  app.get<{ Params: { code: string } }>("/api/sala/:code/responses", async (request, reply) => {
    const teacherId = requireTeacher(request);
    const { code } = request.params;
    const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
    if (!session) return reply.code(404).send({ error: "Sala not found" });
    const rows = db.prepare(
      "SELECT id, type, payload, student_label, created_at FROM classroom_responses WHERE session_code = ? ORDER BY created_at DESC LIMIT 50"
    ).all(code) as ClassroomResponseRow[];
    return { responses: rows.map(serializeClassroomResponse) };
  });

  // Limpiar respuestas de la sala (docente)
  app.delete<{ Params: { code: string } }>("/api/sala/:code/responses", async (request, reply) => {
    const teacherId = requireTeacher(request);
    const { code } = request.params;
    const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
    if (!session) return reply.code(404).send({ error: "Sala not found" });
    db.prepare("DELETE FROM classroom_responses WHERE session_code = ?").run(code);
    publishClassroomEvent(code, "teacher", { type: "responses:cleared" });
    return { ok: true, code };
  });

  // Cerrar sala (docente)
  app.delete<{ Params: { code: string } }>("/api/sala/:code", async (request, reply) => {
    const teacherId = requireTeacher(request);
    const { code } = request.params;
    db.prepare("UPDATE classroom_sessions SET active = 0 WHERE code = ? AND teacher_id = ?").run(code, teacherId);
    publishClassroomEvent(code, "students", { type: "ended" });
    studentBus.delete(code);
    teacherBus.delete(code);
    return { ok: true, code };
  });

  // SSE docente: recibe respuestas de alumnos en tiempo real
  app.get<{ Params: { code: string } }>("/api/sala/:code/teacher-stream", async (request, reply) => {
    const teacherId = requireTeacher(request);
    const { code } = request.params;
    const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND teacher_id = ? AND active = 1").get(code, teacherId);
    if (!session) return reply.code(404).send({ error: "Sala not found" });

    const raw = reply.raw;
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });

    const existing = db.prepare(
      "SELECT id, type, payload, student_label, created_at FROM classroom_responses WHERE session_code = ? ORDER BY created_at DESC LIMIT 20"
    ).all(code) as ClassroomResponseRow[];
    raw.write(`data: ${JSON.stringify({ type: "connected", responses: existing.map(serializeClassroomResponse) })}\n\n`);

    let lastEventId = getLastClassroomEventId(code, "teacher");
    const send: SendFn = (eventId, data) => {
      if (raw.destroyed || eventId <= lastEventId) return;
      lastEventId = eventId;
      raw.write(salaSse(eventId, data));
    };
    if (!teacherBus.has(code)) teacherBus.set(code, new Set());
    teacherBus.get(code)!.add(send);

    const poll = setInterval(() => streamStoredClassroomEvents(code, "teacher", lastEventId, send), 1200);
    const ping = setInterval(() => { if (!raw.destroyed) raw.write(":ping\n\n"); }, 25000);
    const cleanup = () => { clearInterval(poll); clearInterval(ping); teacherBus.get(code)?.delete(send); };
    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
    await new Promise<void>((resolve) => request.raw.on("close", resolve));
  });

  // Info sesión para alumno (sin auth)
  app.get<{ Params: { code: string } }>("/api/sala/:code", async (request, reply) => {
    type SessionRow = { code: string; board_json: string | null; active: number };
    const session = db.prepare("SELECT code, board_json, active FROM classroom_sessions WHERE code = ?").get(request.params.code) as SessionRow | undefined;
    if (!session || !session.active) return reply.code(404).send({ error: "Sala not found or inactive" });
    return { code: session.code, board: session.board_json ? JSON.parse(session.board_json) : null };
  });

  // Respuesta de alumno (sin auth, rate-limited)
  app.post<{ Params: { code: string } }>("/api/sala/:code/response", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { code } = request.params;
    const session = db.prepare("SELECT code FROM classroom_sessions WHERE code = ? AND active = 1").get(code);
    if (!session) return reply.code(404).send({ error: "Sala not found" });
    const body = request.body as { type?: string; payload?: unknown; studentLabel?: string };
    if (!body.type || !["emoji", "hand", "status"].includes(body.type)) {
      return reply.code(400).send({ error: "Invalid response type" });
    }
    const id = randomUUID();
    const now = nowIso();
    const payloadJson = JSON.stringify(body.payload ?? {});
    const label = typeof body.studentLabel === "string" ? body.studentLabel.slice(0, 40) : null;
    db.prepare("INSERT INTO classroom_responses (id, session_code, type, payload, student_label, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, code, body.type, payloadJson, label, now);
    const response = { id, type: body.type, payload: body.payload ?? {}, studentLabel: label, createdAt: now };
    publishClassroomEvent(code, "teacher", { type: "response", response });
    return reply.code(201).send({ ok: true });
  });

  // SSE alumno: recibe board en tiempo real (sin auth)
  app.get<{ Params: { code: string } }>("/api/sala/:code/stream", async (request, reply) => {
    type SessionRow = { code: string; board_json: string | null; active: number };
    const session = db.prepare("SELECT code, board_json, active FROM classroom_sessions WHERE code = ?").get(request.params.code) as SessionRow | undefined;
    if (!session || !session.active) return reply.code(404).send({ error: "Sala not found" });

    const raw = reply.raw;
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });

    const board = session.board_json ? JSON.parse(session.board_json) : null;
    raw.write(`data: ${JSON.stringify({ type: "connected", board })}\n\n`);

    let lastEventId = getLastClassroomEventId(request.params.code, "students");
    const send: SendFn = (eventId, data) => {
      if (raw.destroyed || eventId <= lastEventId) return;
      lastEventId = eventId;
      raw.write(salaSse(eventId, data));
    };
    if (!studentBus.has(request.params.code)) studentBus.set(request.params.code, new Set());
    studentBus.get(request.params.code)!.add(send);

    const poll = setInterval(() => streamStoredClassroomEvents(request.params.code, "students", lastEventId, send), 1200);
    const ping = setInterval(() => { if (!raw.destroyed) raw.write(":ping\n\n"); }, 25000);
    const cleanup = () => { clearInterval(poll); clearInterval(ping); studentBus.get(request.params.code)?.delete(send); };
    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
    await new Promise<void>((resolve) => request.raw.on("close", resolve));
  });
}
