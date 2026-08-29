/**
 * Lectura y comparacion del esquema de SQLite.
 *
 * Lo usan dos consumidores distintos y por eso vive aparte:
 *  - la prueba, que construye una base nueva desde las migraciones y la
 *    compara con la instantanea guardada (detecta cambios sin declarar);
 *  - check-esquema.mjs, que compara la base VIVA con esa misma instantanea
 *    (detecta que produccion se ha quedado atras).
 */

/** Esquema de una base, en una forma estable y comparable. */
export function extraerEsquema(db) {
    const tablas = db
        .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .all()
        .map((f) => f.name);

    const salida = { version: db.pragma("user_version", { simple: true }), tablas: {} };

    for (const tabla of tablas) {
        const columnas = {};
        for (const c of db.pragma(`table_info(${tabla})`)) {
            columnas[c.name] = {
                tipo: c.type,
                obligatoria: Boolean(c.notnull),
                pordefecto: c.dflt_value ?? null,
                clave: Boolean(c.pk)
            };
        }
        const indices = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            .all(tabla)
            .map((f) => f.name);
        salida.tablas[tabla] = { columnas, indices };
    }
    return salida;
}

/** Diferencias en lenguaje llano. Vacio = coinciden. */
export function comparar(esperado, real) {
    const fallos = [];
    if (esperado.version !== real.version) {
        fallos.push(`version del esquema: se esperaba ${esperado.version} y hay ${real.version}`);
    }

    const tablasEsperadas = Object.keys(esperado.tablas);
    const tablasReales = Object.keys(real.tablas);

    for (const t of tablasEsperadas) {
        if (!tablasReales.includes(t)) {
            fallos.push(`falta la tabla "${t}"`);
            continue;
        }
        const ce = esperado.tablas[t].columnas;
        const cr = real.tablas[t].columnas;
        for (const col of Object.keys(ce)) {
            if (!(col in cr)) {
                fallos.push(`"${t}": falta la columna "${col}"`);
                continue;
            }
            const a = JSON.stringify(ce[col]);
            const b = JSON.stringify(cr[col]);
            if (a !== b) fallos.push(`"${t}"."${col}" difiere: se esperaba ${a} y hay ${b}`);
        }
        for (const col of Object.keys(cr)) {
            if (!(col in ce)) fallos.push(`"${t}": columna "${col}" de mas (no declarada)`);
        }
        for (const idx of esperado.tablas[t].indices) {
            if (!real.tablas[t].indices.includes(idx)) fallos.push(`"${t}": falta el indice "${idx}"`);
        }
    }
    for (const t of tablasReales) {
        if (!tablasEsperadas.includes(t)) fallos.push(`tabla "${t}" de mas (no declarada)`);
    }
    return fallos;
}
