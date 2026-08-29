#!/usr/bin/env node
/**
 * Comprueba que el límite de nginx cubre lo que la aplicación necesita enviar.
 *
 * Ya no hay subida de archivos —los documentos viven en el navegador del
 * docente—, pero el JSON de un tablero muy trabajado sigue viajando en el
 * cuerpo de una petición, y quedarse corto se manifiesta como un 413 opaco al
 * publicar. Nadie puede descubrirlo mirando el código de la aplicación, porque
 * la cifra que manda está en /etc.
 *
 * Si no se puede leer la configuración de nginx (CI, portátil de alguien),
 * no falla: avisa y sigue.
 */
import { readFileSync } from "node:fs";

import { MAX_CUERPO_PETICION_BYTES, NGINX_MAX_BODY_MB } from "@edumind-board/shared";

const CONF = process.env.BOARD_NGINX_CONF ?? "/etc/nginx/sites-available/board.edumind.es.conf";

let texto;
try {
    texto = readFileSync(CONF, "utf8");
} catch {
    console.log(`No se puede leer ${CONF}: me salto la comprobación del límite de subida.`);
    process.exit(0);
}

const encontrado = /client_max_body_size\s+(\d+)([kKmMgG]?)\s*;/.exec(texto);
if (!encontrado) {
    console.error(`ERROR: ${CONF} no declara client_max_body_size.`);
    console.error(`Sin esa directiva nginx usa 1m por defecto y las subidas fallarán.`);
    process.exit(1);
}

const factor = { "": 1, k: 1024, K: 1024, m: 1024 ** 2, M: 1024 ** 2, g: 1024 ** 3, G: 1024 ** 3 };
const bytesNginx = Number(encontrado[1]) * factor[encontrado[2]];

if (bytesNginx < MAX_CUERPO_PETICION_BYTES) {
    console.error(
        `ERROR: nginx corta en ${encontrado[1]}${encontrado[2]} y la aplicación necesita ` +
            `${NGINX_MAX_BODY_MB}m.\n\n` +
            `  Un tablero grande sería rechazado antes de llegar al servidor y el\n` +
            `  docente sólo vería un error genérico al publicar.\n\n` +
            `  Arréglalo con:\n` +
            `      sudo python3 /var/www/.edumind_ops/board_limite_subida.py\n`
    );
    process.exit(1);
}

console.log(`Límite del cuerpo OK: nginx ${encontrado[1]}${encontrado[2]} cubre los ${NGINX_MAX_BODY_MB}m necesarios.`);
