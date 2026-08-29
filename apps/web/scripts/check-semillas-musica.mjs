#!/usr/bin/env node
/**
 * Comprueba que las playlists sembradas siguen existiendo.
 *
 * Por qué: son enlaces a un servicio de terceros y se pudren. Un set de
 * SoundCloud puede borrarse o volverse privado sin avisar. Si eso pasa, el
 * docente pulsa «Poner en el tablero» delante de la clase y no suena nada.
 *
 * Se salta la comprobación si no hay red (portátil sin internet, CI aislado):
 * avisa y sigue. Sólo falla cuando puede afirmar que un enlace está roto.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const fuente = readFileSync(resolve(AQUI, "../src/lib/music.ts"), "utf8");

const modos = [...fuente.matchAll(
    /\{ id: "([a-z]+)".*?soundcloudUrl: "([^"]+)"/g
)].map(([, id, soundcloudUrl]) => ({ id, soundcloudUrl }));

if (modos.length === 0) {
    console.error("ERROR: no he encontrado ningún modo con semillas en music.ts");
    process.exit(1);
}

async function comprueba(url) {
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
        return r.ok ? "ok" : "roto";
    } catch {
        return "sin-red";
    }
}

const rotos = [];
let sinRed = 0;

for (const modo of modos) {
    const estado = await comprueba(
        `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(modo.soundcloudUrl)}`
    );
    if (estado === "roto") rotos.push(`${modo.id} → SoundCloud`);
    if (estado === "sin-red") sinRed += 1;
}

if (sinRed > 0 && rotos.length === 0) {
    console.log(`Sin red para ${sinRed} comprobación(es): me salto las semillas de música.`);
    process.exit(0);
}

if (rotos.length > 0) {
    console.error("Playlists sembradas que ya no existen:\n");
    for (const r of rotos) console.error(`  - ${r}`);
    console.error(
        "\nBusca una sustituta y cámbiala en apps/web/src/lib/music.ts.\n" +
            "Si se deja así, el docente pulsa «Poner en el tablero» y no suena nada.\n"
    );
    process.exit(1);
}

console.log(`Semillas de música OK: ${modos.length} modos en SoundCloud.`);
