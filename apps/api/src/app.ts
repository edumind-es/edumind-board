// Factory de la aplicación Fastify. Separada del arranque (server.ts)
// para poder instanciarla en tests con fastify.inject().
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { nowIso } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { boardRoutes } from "./routes/boards.js";
import { musicaRoutes } from "./routes/musica.js";
import { salaRoutes } from "./routes/sala.js";
import { resourceRoutes } from "./routes/resources.js";

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 4 * 1024 * 1024,  // 4MB: un board con un fichero base64 de 1.5MB necesita margen
    // Al cerrar el servidor, corta también las conexiones SSE abiertas (share/sala)
    // para que el apagado ordenado no se quede colgado esperándolas.
    forceCloseConnections: true
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const handledError = error as Error & { statusCode?: number };
    const statusCode =
      handledError.statusCode && handledError.statusCode >= 400 ? handledError.statusCode : 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? "Internal server error" : handledError.message
    });
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173"],
    credentials: true
  });

  await app.register(helmet, {
    contentSecurityPolicy: false
  });

  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute"
  });

  app.get("/health", async () => ({
    ok: true,
    service: "EDUmind Board API",
    timestamp: nowIso()
  }));

  await app.register(authRoutes);
  await app.register(boardRoutes);
  await app.register(salaRoutes);
  await app.register(musicaRoutes);
  await app.register(resourceRoutes);

  return app;
}
