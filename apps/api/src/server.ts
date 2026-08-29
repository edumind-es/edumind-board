// Punto de entrada del API. La aplicación vive en app.ts (factory) y las
// rutas en src/routes/*; aquí solo se arranca el servidor y se gestiona el
// apagado ordenado (deploys, restart del servicio).
import type { FastifyListenOptions } from "fastify";

import "./config.js";
import { buildApp } from "./app.js";
import { db } from "./db.js";

const app = await buildApp();

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? "127.0.0.1";

// systemd puede entregarnos el socket ya abierto ("activacion por socket").
// Asi el socket sobrevive al reinicio del servicio: mientras arrancamos, el
// kernel encola las peticiones en vez de rechazarlas y nadie ve un 502.
// Node no lo mira por su cuenta; hay que comprobarlo a mano.
//
// OJO: solo funciona si systemd lanza node DIRECTAMENTE. A traves de
// `npm run start` el descriptor si se hereda, pero LISTEN_PID apunta al pid
// de npm y la comprobacion lo rechaza, con razon: no podemos saber que ese
// fd 3 sea nuestro.
const SD_LISTEN_FDS_START = 3;

function socketDeSystemd(): number | null {
  const cuantos = Number(process.env.LISTEN_FDS ?? 0);
  const paraQuien = Number(process.env.LISTEN_PID ?? 0);
  if (!Number.isInteger(cuantos) || cuantos < 1) return null;
  if (paraQuien !== process.pid) return null;
  return SD_LISTEN_FDS_START;
}

const heredado = socketDeSystemd();
if (heredado !== null) {
  // Fastify entrega estas opciones tal cual a net.Server.listen, que si
  // admite `fd`; sus tipos no lo declaran, de ahi el ensanchado explicito.
  await app.listen({ fd: heredado } as FastifyListenOptions & { fd: number });
  app.log.info({ fd: heredado }, "Escuchando en el socket entregado por systemd");
} else {
  await app.listen({ port, host });
  app.log.info({ port, host }, "Escuchando en puerto propio (sin activacion por socket)");
}

// Apagado ordenado: cierra el servidor (y las conexiones SSE por
// forceCloseConnections), hace checkpoint del WAL y cierra la base de datos.
// Un timeout de seguridad fuerza la salida si algo se queda colgado.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} recibido: cerrando EDUmind Board API…`);

  const forceExit = setTimeout(() => {
    app.log.error("Cierre forzado tras exceder el tiempo de espera");
    process.exit(1);
  }, 8000);
  forceExit.unref();

  try {
    await app.close();
    try {
      // Vuelca el WAL al fichero principal antes de cerrar (deja la DB limpia)
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (error) {
      app.log.warn({ error }, "No se pudo hacer checkpoint del WAL");
    }
    db.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, "Error durante el apagado");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
