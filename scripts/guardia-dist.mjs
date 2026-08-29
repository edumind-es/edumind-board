#!/usr/bin/env node
/**
 * Impide compilar encima de la release que se esta sirviendo.
 *
 * Tras versionar los compilados, `dist` de cada paquete es un ENLACE
 * SIMBOLICO a `releases/<version>`. Un `npm run build` a mano resuelve el
 * enlace y escribe dentro de la release viva: con --emptyOutDir la vacia
 * primero, asi que durante unos segundos se sirve un directorio a medias, y
 * el marcador .commit desaparece.
 *
 * Estaba escrito en CLAUDE.md y aun asi paso. Una regla que depende de que
 * alguien la recuerde no es una regla.
 *
 * El despliegue no se ve afectado: compila con --outDir a la release nueva,
 * nunca a `dist`.
 */
import { lstatSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(process.cwd(), "dist");

let info;
try {
    info = lstatSync(dist);
} catch {
    process.exit(0); // no existe todavia: compilacion limpia
}

// Salida explicita para quien SOLO necesita los .d.ts y sabe que no destruye
// nada: `tsc -p` escribe encima fichero a fichero, no vacia el directorio
// como hace vite con --emptyOutDir. La usan los check:* que compilan shared
// para poder comprobar tipos. No usarla para compilar la web.
if (process.env.GUARDIA_DIST_OMITIR === "1") {
    process.exit(0);
}

if (info.isSymbolicLink()) {
    const paquete = process.env.npm_package_name ?? process.cwd();
    console.error(
        `\n  No se puede compilar ${paquete} aqui.\n\n` +
            `  ${dist} es un enlace simbolico a la version que se esta\n` +
            `  sirviendo ahora mismo. Compilar encima la vacia y deja el sitio\n` +
            `  a medias mientras dura.\n\n` +
            `  Usa  ./desplegar.sh  desde la raiz del repo: compila en una\n` +
            `  version nueva y mueve el enlace de golpe.\n\n` +
            `  Si de verdad quieres compilar suelto, apunta a otro sitio:\n` +
            `      npx vite build --outDir /tmp/lo-que-sea\n`
    );
    process.exit(1);
}
