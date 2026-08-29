#!/usr/bin/env node
/**
 * Compara la base de datos VIVA con la instantanea de esquema.json.
 *
 * Es el complemento de la prueba: aquella comprueba que las migraciones
 * producen el esquema declarado; esta comprueba que la base que hay en el
 * servidor de verdad se corresponde con el. Sirve para cazar el caso feo:
 * el codigo declara una columna, la base no la tiene, y nadie se entera
 * hasta que una consulta falla en clase.
 *
 * Uso:  node scripts/check-esquema.mjs [ruta-a-la-base]
 *       DATABASE_PATH=/var/... node scripts/check-esquema.mjs
 */
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { comparar, extraerEsquema } from "./esquema-lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ruta = resolve(
    process.argv[2] ?? process.env.DATABASE_PATH ?? resolve(AQUI, "../../../data/edumind-board.sqlite")
);

if (!existsSync(ruta)) {
    console.log(`No hay base de datos en ${ruta}: nada que comprobar.`);
    process.exit(0);
}

const esperado = JSON.parse(readFileSync(resolve(AQUI, "../esquema.json"), "utf8"));
const db = new Database(ruta, { readonly: true });
const real = extraerEsquema(db);
db.close();

const fallos = comparar(esperado, real);
if (fallos.length === 0) {
    console.log(`Esquema OK (version ${real.version}) en ${ruta}`);
    process.exit(0);
}

console.error(`La base de ${ruta} no se corresponde con esquema.json:\n`);
for (const f of fallos) console.error(`  - ${f}`);
console.error(
    "\nSi el codigo declara algo que la base no tiene, falta una migracion.\n" +
        "Si la base va por delante, es que alguien la toco a mano."
);
process.exit(1);
