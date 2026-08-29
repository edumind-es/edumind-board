// Tests de integración del API con fastify.inject() sobre una DB SQLite temporal.
// El entorno se fija ANTES del import dinámico porque env.ts lee process.env al cargar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let cookieFor: (id: string, username?: string) => string;
let tempDir: string;

function validBoard(id: string, title = "Board de prueba") {
  return {
    schemaVersion: 1,
    id,
    title,
    theme: "edumind",
    viewport: { x: 0, y: 0, zoom: 1 },
    elements: [],
    ink: [],
    updatedAt: new Date().toISOString()
  };
}

function boardWithIframe(id: string, url: string) {
  return {
    ...validBoard(id),
    elements: [
      {
        id: randomUUID(),
        type: "iframe",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        rotation: 0,
        zIndex: 0,
        opacity: 1,
        locked: false,
        data: { url, title: "Recurso" }
      }
    ]
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "edumind-board-test-"));
  process.env.DATABASE_PATH = path.join(tempDir, "test.sqlite");
  process.env.SESSION_SECRET = "s".repeat(48);
  process.env.APP_BASE_URL = "http://localhost:5173";
  process.env.AUTHENTIK_ENABLED = "false";

  const { buildApp } = await import("../src/app.js");
  const { signSession } = await import("../src/auth/session.js");
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "edumind_board_session";
  cookieFor = (id, username = "docente-test") =>
    `${cookieName}=${encodeURIComponent(signSession({ id, username, email: null, role: "docente" }))}`;
  app = await buildApp({ logger: false });
});

afterAll(async () => {
  await app.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("salud y autenticación", () => {
  it("GET /health responde ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("GET /api/auth/me sin cookie devuelve 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/auth/me con cookie firmada devuelve el usuario", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieFor("teacher-1") }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe("teacher-1");
  });

  it("una cookie con firma manipulada se rechaza", async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "edumind_board_session";
    const valid = cookieFor("teacher-1").split("=").slice(1).join("=");
    const tampered = decodeURIComponent(valid).replace(/.$/, "x");
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: `${cookieName}=${encodeURIComponent(tampered)}` }
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("boards", () => {
  const owner = "teacher-boards";

  it("requiere autenticación para listar y crear", async () => {
    expect((await app.inject({ method: "GET", url: "/api/boards" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/boards", payload: {} })).statusCode).toBe(401);
  });

  it("crea, lista y recupera un board del propietario", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/boards",
      headers: { cookie: cookieFor(owner) },
      payload: { title: "Mi board" }
    });
    expect(created.statusCode).toBe(201);
    const boardId = created.json().board.id as string;

    const list = await app.inject({ method: "GET", url: "/api/boards", headers: { cookie: cookieFor(owner) } });
    expect(list.json().boards.some((b: { id: string }) => b.id === boardId)).toBe(true);

    const fetched = await app.inject({ method: "GET", url: `/api/boards/${boardId}`, headers: { cookie: cookieFor(owner) } });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().board.title).toBe("Mi board");
  });

  it("otro docente no puede leer un board ajeno", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/boards",
      headers: { cookie: cookieFor(owner) },
      payload: { title: "Privado" }
    });
    const boardId = created.json().board.id as string;
    const res = await app.inject({
      method: "GET",
      url: `/api/boards/${boardId}`,
      headers: { cookie: cookieFor("otro-docente") }
    });
    expect(res.statusCode).toBe(404);
  });

  it("publica con versiones incrementales", async () => {
    const boardId = randomUUID();
    const first = await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId) }
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().versionNumber).toBe(1);

    const second = await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId, "v2") }
    });
    expect(second.json().versionNumber).toBe(2);

    const versions = await app.inject({
      method: "GET",
      url: `/api/boards/${boardId}/versions`,
      headers: { cookie: cookieFor(owner) }
    });
    expect(versions.statusCode).toBe(200);
    expect(versions.json().versions).toHaveLength(2);
    expect(versions.json().versions[0].isPublished).toBe(true);
  });

  it("rechaza publicar iframes fuera de la allowlist", async () => {
    const boardId = randomUUID();
    const res = await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: boardWithIframe(boardId, "https://malicioso.example.com/x") }
    });
    // El schema compartido ya rechaza el host en validación → 400
    expect([400, 422]).toContain(res.statusCode);
  });

  it("borra un board con sus versiones y shares en cascada", async () => {
    const boardId = randomUUID();
    await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId) }
    });
    const share = await app.inject({
      method: "POST",
      url: `/api/boards/${boardId}/share`,
      headers: { cookie: cookieFor(owner) },
      payload: {}
    });
    const token = share.json().token as string;

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/boards/${boardId}`,
      headers: { cookie: cookieFor(owner) }
    });
    expect(deleted.statusCode).toBe(200);

    expect((await app.inject({ method: "GET", url: `/api/boards/${boardId}`, headers: { cookie: cookieFor(owner) } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(404);
  });

  it("no permite borrar boards ajenos", async () => {
    const boardId = randomUUID();
    await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId) }
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/boards/${boardId}`,
      headers: { cookie: cookieFor("otro-docente") }
    });
    expect(res.statusCode).toBe(404);
  });

  it("PUT /api/boards/:id hace upsert del borrador conservando el id", async () => {
    const boardId = randomUUID();
    const board = validBoard(boardId, "Borrador sync");

    const put = await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}`,
      headers: { cookie: cookieFor(owner) },
      payload: { board }
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().saved).toBe(true);

    const fetched = await app.inject({ method: "GET", url: `/api/boards/${boardId}`, headers: { cookie: cookieFor(owner) } });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().board.id).toBe(boardId);
    expect(fetched.json().board.title).toBe("Borrador sync");
  });

  it("PUT devuelve 409 con la copia del servidor si el servidor es más nuevo", async () => {
    const boardId = randomUUID();
    const nuevo = { ...validBoard(boardId, "Versión servidor"), updatedAt: "2026-07-12T12:00:00.000Z" };
    await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: nuevo }
    });

    // Intento de guardar una versión más ANTIGUA → conflicto, no se pisa
    const viejo = { ...validBoard(boardId, "Versión vieja"), updatedAt: "2026-07-12T10:00:00.000Z" };
    const conflicto = await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: viejo }
    });
    expect(conflicto.statusCode).toBe(409);
    expect(conflicto.json().conflict).toBe(true);
    expect(conflicto.json().board.title).toBe("Versión servidor");
  });

  it("PUT rechaza id de body distinto al de la ruta", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/boards/${randomUUID()}`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(randomUUID()) }
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("enlaces compartidos", () => {
  const owner = "teacher-shares";

  it("exige publicar antes de compartir", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/boards",
      headers: { cookie: cookieFor(owner) },
      payload: { title: "Sin publicar" }
    });
    const boardId = created.json().board.id as string;
    const res = await app.inject({
      method: "POST",
      url: `/api/boards/${boardId}/share`,
      headers: { cookie: cookieFor(owner) },
      payload: {}
    });
    expect(res.statusCode).toBe(409);
  });

  it("crea share público y lo revoca", async () => {
    const boardId = randomUUID();
    await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId, "Compartido") }
    });
    const share = await app.inject({
      method: "POST",
      url: `/api/boards/${boardId}/share`,
      headers: { cookie: cookieFor(owner) },
      payload: {}
    });
    expect(share.statusCode).toBe(201);
    const token = share.json().token as string;

    // Lectura pública sin cookie
    const publicRead = await app.inject({ method: "GET", url: `/api/share/${token}` });
    expect(publicRead.statusCode).toBe(200);
    expect(publicRead.json().board.title).toBe("Compartido");

    // Revocación por el propietario
    const revoked = await app.inject({
      method: "DELETE",
      url: `/api/share/${token}`,
      headers: { cookie: cookieFor(owner) }
    });
    expect(revoked.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(404);
  });

  it("un share caducado devuelve 410", async () => {
    const boardId = randomUUID();
    await app.inject({
      method: "PUT",
      url: `/api/boards/${boardId}/publish`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId) }
    });
    const share = await app.inject({
      method: "POST",
      url: `/api/boards/${boardId}/share`,
      headers: { cookie: cookieFor(owner) },
      payload: { expiresAt: new Date(Date.now() - 60_000).toISOString() }
    });
    const token = share.json().token as string;
    expect((await app.inject({ method: "GET", url: `/api/share/${token}` })).statusCode).toBe(410);
  });
});

describe("sala de clase", () => {
  const owner = "teacher-sala";

  async function createSala() {
    const res = await app.inject({ method: "POST", url: "/api/sala", headers: { cookie: cookieFor(owner) } });
    expect(res.statusCode).toBe(201);
    return res.json().code as string;
  }

  it("crear sala requiere autenticación", async () => {
    expect((await app.inject({ method: "POST", url: "/api/sala" })).statusCode).toBe(401);
  });

  it("rechaza enviar un board malformado a los alumnos", async () => {
    const code = await createSala();
    const res = await app.inject({
      method: "PUT",
      url: `/api/sala/${code}/board`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: { cualquier: "cosa" } }
    });
    expect(res.statusCode).toBe(400);
  });

  it("acepta un board válido y lo expone al alumno sin auth", async () => {
    const code = await createSala();
    const boardId = randomUUID();
    const sent = await app.inject({
      method: "PUT",
      url: `/api/sala/${code}/board`,
      headers: { cookie: cookieFor(owner) },
      payload: { board: validBoard(boardId, "Para el aula") }
    });
    expect(sent.statusCode).toBe(200);

    const student = await app.inject({ method: "GET", url: `/api/sala/${code}` });
    expect(student.statusCode).toBe(200);
    expect(student.json().board.title).toBe("Para el aula");
  });

  it("respuestas de alumnos: tipo inválido 400, válido 201", async () => {
    const code = await createSala();
    const bad = await app.inject({
      method: "POST",
      url: `/api/sala/${code}/response`,
      payload: { type: "hack", payload: {} }
    });
    expect(bad.statusCode).toBe(400);

    const good = await app.inject({
      method: "POST",
      url: `/api/sala/${code}/response`,
      payload: { type: "hand", payload: {}, studentLabel: "Alumno 1" }
    });
    expect(good.statusCode).toBe(201);

    const responses = await app.inject({
      method: "GET",
      url: `/api/sala/${code}/responses`,
      headers: { cookie: cookieFor(owner) }
    });
    expect(responses.json().responses).toHaveLength(1);
    expect(responses.json().responses[0].studentLabel).toBe("Alumno 1");
  });

  it("cerrar la sala la desactiva para los alumnos", async () => {
    const code = await createSala();
    await app.inject({ method: "DELETE", url: `/api/sala/${code}`, headers: { cookie: cookieFor(owner) } });
    expect((await app.inject({ method: "GET", url: `/api/sala/${code}` })).statusCode).toBe(404);
  });
});

