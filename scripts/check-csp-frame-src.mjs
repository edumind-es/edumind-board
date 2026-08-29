#!/usr/bin/env node
/**
 * Comprueba que el `frame-src` del CSP de nginx cubre los dominios que el
 * tablero permite empotrar.
 *
 * Por qué existe: la lista de dominios embebibles estaba DUPLICADA. Una copia
 * en `packages/shared/src/schemas.ts` (la que valida el esquema) y otra dentro
 * del `Content-Security-Policy` de `/etc/nginx/.../board-security-headers.inc`.
 * Añadir un dominio al código no bastaba: el esquema lo aceptaba, el elemento
 * se creaba, y el navegador dejaba el marco en blanco sin decir por qué. Es el
 * mismo patrón que ya rompió las subidas con cuatro límites distintos.
 *
 * La fuente de verdad es el código. Esto solo avisa cuando /etc se ha quedado
 * atrás, y dice cómo arreglarlo.
 *
 * Si no se puede leer la configuración (CI, portátil de alguien), no falla.
 */
import { readFileSync } from "node:fs";

import { allowedCloudHosts, allowedEmbedHosts } from "@edumind-board/shared";

const CONF = process.env.BOARD_NGINX_HEADERS
    ?? "/etc/nginx/sites-available/board-security-headers.inc";

let texto;
try {
    texto = readFileSync(CONF, "utf8");
} catch {
    console.log(`No se puede leer ${CONF}: me salto la comprobación del frame-src.`);
    process.exit(0);
}

const directiva = /frame-src\s+([^;"]+)/.exec(texto);
if (!directiva) {
    console.error(`ERROR: ${CONF} no declara frame-src dentro del Content-Security-Policy.`);
    console.error("Sin esa directiva rige default-src 'self' y NINGÚN recurso externo se vería.");
    process.exit(1);
}

const permitidos = directiva[1].trim().split(/\s+/);

/** ¿Cubre la directiva este host, tal cual o por comodín de dominio padre? */
function cubierto(host) {
    return permitidos.some((entrada) => {
        const valor = entrada.replace(/^https:\/\//, "");
        if (valor === host) return true;
        // `https://*.edumind.es` cubre `board.edumind.es`, pero NO `edumind.es`.
        if (valor.startsWith("*.")) return host.endsWith(valor.slice(1));
        return false;
    });
}

const faltan = [...allowedEmbedHosts, ...allowedCloudHosts].filter((host) => !cubierto(host));

if (faltan.length > 0) {
    console.error(
        `ERROR: el CSP de nginx no permite empotrar ${faltan.length} dominio(s) que el ` +
            `tablero sí acepta:\n\n` +
            faltan.map((host) => `      ${host}`).join("\n") +
            `\n\n  El esquema los admitiría y el navegador dejaría el marco en blanco,\n` +
            `  sin ningún error visible para el docente.\n\n` +
            `  Arréglalo con:\n` +
            `      sudo python3 /var/www/.edumind_ops/board_csp_frame_src.py\n`
    );
    process.exit(1);
}

console.log(`frame-src OK: el CSP cubre los ${allowedEmbedHosts.length + allowedCloudHosts.length} dominios embebibles.`);
