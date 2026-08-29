#!/usr/bin/env node
/**
 * Cura la música de aula desde el catálogo de Incompetech (Kevin MacLeod).
 *
 * Por qué existe: el panel de música dependía de servicios de streaming
 * ajenos, que sin sesión iniciada no reproducen o se cortan a los 30
 * segundos. Una función de aula así no sirve. Además, incrustar un
 * reproductor de un tercero
 * en una app que usan menores manda datos de navegación a un tercero.
 *
 * La música que produce este script:
 *   - Es CC-BY 4.0, verificado en incompetech.com/music/royalty-free/faq.html.
 *     Se puede alojar, servir y redistribuir citando autor y licencia.
 *   - La sirve el propio servidor: ni un dato del alumnado sale fuera.
 *   - Suena entera, sin iniciar sesión en ningún sitio.
 *   - Al estar en local, la PWA puede cachearla y funcionar sin internet.
 *
 * Es reproducible a propósito: la selección es un criterio escrito, no una
 * lista elegida a mano que nadie sabe de dónde salió.
 *
 *   node scripts/curar-musica.mjs            # descarga y escribe el catálogo
 *   node scripts/curar-musica.mjs --listar   # sólo enseña qué elegiría
 */
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const CATALOGO_REMOTO = "https://incompetech.com/music/royalty-free/pieces.json";
const BASE_MP3 = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/";
const LICENCIA = { nombre: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
const AUTOR = { nombre: "Kevin MacLeod", url: "https://incompetech.com/" };

const RAIZ = path.resolve(import.meta.dirname, "..");
const DESTINO_AUDIO = process.env.EDUMIND_MUSICA_ROOT ?? path.join(RAIZ, "data/musica");
// Junto a los mp3: el catálogo sin sus ficheros no vale para nada.
const DESTINO_CATALOGO = path.join(DESTINO_AUDIO, "catalogo.json");
const POR_MODO = 4;

// Ambientes que no valen para trabajar: nada de acción, tensión ni oscuridad
// en un aula de primaria mientras se hace una tarea.
const VETADOS = [
    "Action", "Driving", "Intense", "Dark", "Eerie", "Unnerving",
    "Suspenseful", "Epic", "Somber", "Mysterious", "Mystical",
    "Humorous", "Aggressive"
];

// Cada modo del slider, con el ambiente y el pulso que le pegan.
const MODOS = [
    { id: "individual", feels: ["Calming"],               bpm: [0, 90],    razon: "Concentración profunda: pulso bajo y sin sobresaltos." },
    { id: "autonomo",   feels: ["Relaxed"],               bpm: [75, 110],  razon: "Estudio sostenido: pulso constante que no cansa." },
    { id: "grupal",     feels: ["Grooving"],              bpm: [85, 115],  razon: "Colaborar: con ritmo, pero sin competir con las voces." },
    { id: "expositivo", feels: ["Calming"],               bpm: [0, 75],    razon: "Escuchar y atender: lo más quieto del catálogo." },
    { id: "abierto",    feels: ["Uplifting", "Bright"],   bpm: [95, 135],  razon: "Creatividad: luminoso y con energía." },
    { id: "flexible",   feels: ["Relaxed", "Bright"],     bpm: [80, 115],  razon: "Todoterreno: sirve para casi cualquier tarea." }
];

const limpio = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const aSegundos = (s) => {
    const [h, m, x] = (s ?? "0:0:0").split(":").map(Number);
    return h * 3600 + m * 60 + x;
};
// "Canon in D for Two Harps", "Canon In D For 8 Bit Synths" y "Devonshire
// Waltz Allegretto"/"Moderato" son variantes de la misma pieza. Con dos
// palabras basta para agruparlas sin fundir cosas que no lo son.
const familia = (titulo) =>
    limpio(titulo).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).slice(0, 2).join(" ");

function seleccionar(piezas) {
    const usadas = new Set();
    const familias = new Set();
    return MODOS.map((modo) => {
        // Se eligen de una en una: si se filtrase todo de golpe, dos variantes
        // de la misma pieza entrarian juntas en el mismo modo (pasaba con los
        // tres "Canon in D" y los dos "Devonshire Waltz").
        const elegidas = [];
        const sirve = (t) => {
            const feel = t.feel ?? "";
            const seg = aSegundos(t.length);
            return (
                !/vocal|choir|voice/i.test(t.instruments ?? "") &&   // sin voz: distrae
                seg >= 150 && seg <= 420 &&                          // ni un corte, ni eterna
                !VETADOS.some((f) => feel.includes(f)) &&
                modo.feels.some((f) => feel.includes(f)) &&
                Number(t.bpm) >= modo.bpm[0] && Number(t.bpm) <= modo.bpm[1] &&
                !usadas.has(t.filename) && !familias.has(familia(t.title))
            );
        };
        for (const t of piezas) {
            if (elegidas.length >= POR_MODO) break;
            if (!sirve(t)) continue;
            elegidas.push(t);
            usadas.add(t.filename);
            familias.add(familia(t.title));
        }
        return { modo, elegidas };
    });
}

const piezas = await (await fetch(CATALOGO_REMOTO)).json();
const seleccion = seleccionar(piezas);

if (process.argv.includes("--listar")) {
    for (const { modo, elegidas } of seleccion) {
        console.log(`\n${modo.id} — ${modo.razon}`);
        for (const t of elegidas) {
            console.log(`   ${limpio(t.title).padEnd(32)} ${t.length}  ${String(t.bpm).padStart(3)}bpm`);
        }
    }
    process.exit(0);
}

await mkdir(DESTINO_AUDIO, { recursive: true });
const catalogo = { licencia: LICENCIA, autor: AUTOR, generado: new Date().toISOString(), modos: [] };

for (const { modo, elegidas } of seleccion) {
    const pistas = [];
    for (const t of elegidas) {
        const nombre = limpio(t.filename);
        const id = nombre.replace(/\.mp3$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const destino = path.join(DESTINO_AUDIO, `${id}.mp3`);
        const url = BASE_MP3 + encodeURIComponent(nombre);

        const respuesta = await fetch(url);
        if (!respuesta.ok) {
            console.error(`  omitida "${limpio(t.title)}": ${respuesta.status}`);
            continue;
        }
        await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(destino));
        pistas.push({
            id,
            titulo: limpio(t.title),
            duracion: aSegundos(t.length),
            instrumentos: limpio(t.instruments),
            fichero: `${id}.mp3`,
            // La atribución viaja con la pista: es la condición de la licencia,
            // no un adorno. La interfaz la muestra.
            atribucion: `${limpio(t.title)} — ${AUTOR.nombre} (${LICENCIA.nombre})`
        });
        console.log(`  ✓ ${limpio(t.title)}`);
    }
    catalogo.modos.push({ id: modo.id, razon: modo.razon, pistas });
}

await writeFile(DESTINO_CATALOGO, `${JSON.stringify(catalogo, null, 2)}\n`);
const total = catalogo.modos.reduce((n, m) => n + m.pistas.length, 0);
console.log(`\n${total} pistas en ${DESTINO_AUDIO}`);
console.log(`Catálogo en ${DESTINO_CATALOGO}`);
