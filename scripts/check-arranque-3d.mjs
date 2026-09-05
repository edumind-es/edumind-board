#!/usr/bin/env node
/**
 * Comprueba que el motor 3D NO entra en el arranque de la web.
 *
 * Por qué existe: `vendor-3d` (unos 910 kB, 240 comprimidos) es el chunk más
 * grande con diferencia y está troceado aparte A PROPÓSITO — solo lo piden
 * Mates3D y el mapa mental, que se cargan en diferido. La carga inicial real
 * son ~255 kB comprimidos justamente porque el 3D se queda fuera.
 *
 * Al subir a Vite 8 ese reparto se rompió y NINGUNA comprobación se enteró:
 * pasaban el typecheck, las 264 pruebas y los nueve check:*. El chunk 3D
 * aparecía como `modulepreload` en el index.html, así que se descargaba
 * siempre y doblaba el arranque. Solo se veía leyendo el HTML generado.
 *
 * Se vigilan los dos fallos posibles, porque son opuestos y ambos silenciosos:
 *
 *   1. Que vendor-3d esté en el camino inicial (lo que pasó con Vite 8).
 *   2. Que vendor-3d no exista, que significaría que el grupo ha dejado de
 *      capturar y three ha ido a parar dentro de `vendor`, que sí carga
 *      siempre. El arranque se dobla igual, pero sin nada raro que mirar.
 *
 * Se ejecuta sobre lo recién compilado, no sobre `dist` (que es un enlace a la
 * versión que se está sirviendo). El despliegue le pasa el directorio nuevo.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "apps/web/dist");

let html;
try {
    html = readFileSync(resolve(dir, "index.html"), "utf8");
} catch {
    console.error(`No encuentro ${dir}/index.html. Pásame el directorio compilado.`);
    process.exit(1);
}

// El camino inicial es lo que el navegador pide sin que nadie navegue: el
// script de entrada y todo lo que el propio HTML precarga.
const inicial = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);

const nombre = (ruta) => ruta.split("/").pop();
const esTresD = (ruta) => nombre(ruta).startsWith("vendor-3d-");

const enArranque = inicial.filter(esTresD);
if (enArranque.length > 0) {
    console.error(
        `\n  El motor 3D ha entrado en el arranque: ${enArranque.map(nombre).join(", ")}\n\n` +
            `  Ese chunk pesa unos 240 kB comprimidos y solo hacen falta en\n` +
            `  Mates3D y el mapa mental, que cargan en diferido. Si está en el\n` +
            `  index.html, se descarga en TODAS las visitas.\n\n` +
            `  Suele ser el troceado de apps/web/vite.config.ts: algo que carga\n` +
            `  siempre (el store, el núcleo de React) ha acabado del lado del 3D,\n` +
            `  o un grupo se ha llevado las dependencias de lo que captura\n` +
            `  (includeDependenciesRecursively).\n`
    );
    process.exit(1);
}

const existe = readdirSync(resolve(dir, "assets")).some((f) => f.startsWith("vendor-3d-") && f.endsWith(".js"));
if (!existe) {
    console.error(
        `\n  No hay ningún chunk vendor-3d en ${dir}/assets.\n\n` +
            `  El grupo del troceado ha dejado de capturar, así que three y\n` +
            `  compañía han ido a parar a un chunk que sí carga siempre. El\n` +
            `  arranque se dobla igual, solo que sin nada raro a la vista.\n\n` +
            `  Revisa el grupo vendor-3d de apps/web/vite.config.ts.\n`
    );
    process.exit(1);
}

console.log(`Arranque OK: el 3D se queda fuera (${inicial.length} recursos iniciales).`);
