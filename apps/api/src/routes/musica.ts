// Música de aula servida por el propio servidor.
//
// Por qué la sirve el servidor y no un embed de un servicio de streaming: esos
// reproductores dependen de la cuenta de quien esté delante, y una función de
// aula que no suena sin iniciar sesión no sirve para nada. Además, incrustar un
// reproductor de un tercero en una app que usan menores manda datos de
// navegación fuera sin que nadie lo haya consentido.
//
// Estas pistas son de Kevin MacLeod, CC BY 4.0: se pueden alojar y servir
// citando autor y licencia. Las cura scripts/curar-musica.mjs.
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";

import { musicaCatalogoPath, musicaRoot } from "../env.js";

type Pista = {
    id: string;
    titulo: string;
    duracion: number;
    instrumentos: string;
    fichero: string;
    atribucion: string;
};
type Catalogo = {
    licencia: { nombre: string; url: string };
    autor: { nombre: string; url: string };
    modos: { id: string; razon: string; pistas: Pista[] }[];
};

let cache: Catalogo | null = null;
let porId: Map<string, Pista> | null = null;

async function cargarCatalogo(): Promise<Catalogo | null> {
    if (cache) return cache;
    try {
        const crudo = await readFile(musicaCatalogoPath, "utf8");
        cache = JSON.parse(crudo) as Catalogo;
        porId = new Map(cache.modos.flatMap((m) => m.pistas.map((p) => [p.id, p] as const)));
        return cache;
    } catch {
        return null;   // sin catálogo, el panel cae al modo enlace
    }
}

export async function musicaRoutes(app: FastifyInstance) {
    app.get("/api/musica/catalogo", async (_request, reply) => {
        const catalogo = await cargarCatalogo();
        if (!catalogo) return reply.code(404).send({ error: "sin catálogo de música" });
        // Cambia sólo cuando se recura: no hace falta pedirlo en cada clase.
        return reply.header("Cache-Control", "public, max-age=3600").send(catalogo);
    });

    app.get<{ Params: { id: string } }>("/api/musica/pista/:id", async (request, reply) => {
        await cargarCatalogo();
        const pista = porId?.get(request.params.id);
        if (!pista) return reply.code(404).send({ error: "pista desconocida" });

        // El id viene del catálogo, no del cliente, pero se comprueba igual:
        // un fallo aquí sería servir cualquier fichero del disco.
        const absoluto = path.resolve(musicaRoot, pista.fichero);
        if (!absoluto.startsWith(path.resolve(musicaRoot) + path.sep)) {
            return reply.code(400).send({ error: "ruta no válida" });
        }
        const info = await stat(absoluto).catch(() => null);
        if (!info?.isFile()) return reply.code(404).send({ error: "fichero no encontrado" });

        reply
            .header("Content-Type", "audio/mpeg")
            .header("Accept-Ranges", "bytes")
            // nosniff lo pone ya nginx para /api/: repetirlo aqui solo
            // duplicaba la cabecera en la respuesta.
            .header("Cache-Control", "public, max-age=604800, immutable");

        // Rango parcial: sin esto no se puede arrastrar la barra de progreso,
        // y Safari se niega a reproducir.
        const rango = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
        if (rango) {
            const desde = rango[1] ? Number(rango[1]) : 0;
            const hasta = rango[2] ? Number(rango[2]) : info.size - 1;
            if (desde >= info.size || hasta >= info.size || desde > hasta) {
                return reply.code(416).header("Content-Range", `bytes */${info.size}`).send();
            }
            return reply
                .code(206)
                .header("Content-Range", `bytes ${desde}-${hasta}/${info.size}`)
                .header("Content-Length", hasta - desde + 1)
                .send(createReadStream(absoluto, { start: desde, end: hasta }));
        }

        return reply.header("Content-Length", info.size).send(createReadStream(absoluto));
    });
}
