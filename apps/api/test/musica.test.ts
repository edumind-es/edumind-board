/**
 * Ruta de música: sirve el catálogo y los ficheros de audio.
 *
 * Lo que se cubre es lo que rompe la función en clase: que la pista suene
 * entera, que se pueda arrastrar la barra (rangos) y que nadie pueda pedir
 * un fichero que no sea música.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<ReturnType<typeof import("../src/app.js").buildApp>>;
let dir: string;

const CATALOGO = {
    licencia: { nombre: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    autor: { nombre: "Kevin MacLeod", url: "https://incompetech.com/" },
    modos: [
        {
            id: "individual",
            razon: "Concentración profunda",
            pistas: [
                {
                    id: "pista-uno",
                    titulo: "Pista Uno",
                    duracion: 200,
                    instrumentos: "Piano",
                    fichero: "pista-uno.mp3",
                    atribucion: "Pista Uno — Kevin MacLeod (CC BY 4.0)"
                }
            ]
        }
    ]
};

const AUDIO = Buffer.from("ID3contenido-de-prueba-de-audio", "utf8");

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "musica-"));
    await writeFile(path.join(dir, "catalogo.json"), JSON.stringify(CATALOGO));
    await writeFile(path.join(dir, "pista-uno.mp3"), AUDIO);

    process.env.EDUMIND_MUSICA_ROOT = dir;
    process.env.EDUMIND_MUSICA_CATALOGO = path.join(dir, "catalogo.json");
    process.env.SESSION_SECRET = "s".repeat(48);
    process.env.APP_BASE_URL = "http://localhost:5173";
    process.env.AUTHENTIK_ENABLED = "false";
    process.env.DATABASE_PATH = path.join(dir, "prueba.sqlite");

    const { buildApp } = await import("../src/app.js");
    app = await buildApp({ logger: false });
});

afterAll(async () => {
    await app?.close();
    await rm(dir, { recursive: true, force: true });
});

describe("catálogo de música", () => {
    it("lo sirve con la licencia y la atribución de cada pista", async () => {
        const r = await app.inject({ method: "GET", url: "/api/musica/catalogo" });
        expect(r.statusCode).toBe(200);
        const cuerpo = r.json();
        expect(cuerpo.licencia.nombre).toBe("CC BY 4.0");
        // Sin atribución no podríamos usar esta música: tiene que viajar con ella.
        expect(cuerpo.modos[0].pistas[0].atribucion).toContain("Kevin MacLeod");
    });
});

describe("pistas", () => {
    it("sirve el audio entero, no un trozo", async () => {
        const r = await app.inject({ method: "GET", url: "/api/musica/pista/pista-uno" });
        expect(r.statusCode).toBe(200);
        expect(r.headers["content-type"]).toBe("audio/mpeg");
        expect(Number(r.headers["content-length"])).toBe(AUDIO.length);
    });

    it("anuncia que admite rangos, o Safari no reproduce", async () => {
        const r = await app.inject({ method: "GET", url: "/api/musica/pista/pista-uno" });
        expect(r.headers["accept-ranges"]).toBe("bytes");
    });

    it("devuelve el trozo pedido al arrastrar la barra", async () => {
        const r = await app.inject({
            method: "GET",
            url: "/api/musica/pista/pista-uno",
            headers: { range: "bytes=4-9" }
        });
        expect(r.statusCode).toBe(206);
        expect(r.headers["content-range"]).toBe(`bytes 4-9/${AUDIO.length}`);
        expect(r.rawPayload.length).toBe(6);
    });

    it("rechaza un rango imposible en vez de mentir", async () => {
        const r = await app.inject({
            method: "GET",
            url: "/api/musica/pista/pista-uno",
            headers: { range: `bytes=${AUDIO.length + 10}-` }
        });
        expect(r.statusCode).toBe(416);
    });

    it("una pista que no existe da 404", async () => {
        const r = await app.inject({ method: "GET", url: "/api/musica/pista/no-existe" });
        expect(r.statusCode).toBe(404);
    });

    it("no se puede pedir un fichero de fuera del catálogo", async () => {
        // El id se busca en el catálogo, así que una ruta inventada nunca
        // llega al disco. Se comprueba igual: seria servir cualquier fichero.
        for (const intento of ["../../../etc/passwd", "..%2F..%2Fetc%2Fpasswd", "%2e%2e%2fpasswd"]) {
            const r = await app.inject({ method: "GET", url: `/api/musica/pista/${intento}` });
            expect([400, 404]).toContain(r.statusCode);
        }
    });
});
