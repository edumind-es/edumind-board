import type { Database } from "better-sqlite3";

/**
 * Migraciones del esquema.
 *
 * Por que existe: hasta ahora el esquema se creaba con `CREATE TABLE IF NOT
 * EXISTS` y nada mas. Eso funciona para una base vacia, pero sobre una base
 * que ya existe **cambiar una tabla no hace nada, en silencio**: se anade una
 * columna al codigo, el arranque no da error, y la columna no esta.
 *
 * Reglas:
 *  - Una migracion **nunca** se edita despues de haberse aplicado en
 *    produccion. Los cambios van en una migracion nueva.
 *  - Las versiones son consecutivas desde 1, sin huecos.
 *  - Cada migracion se aplica entera o no se aplica: va en una transaccion
 *    junto con el sello de `user_version`.
 *  - Si una migracion necesita reconstruir una tabla (SQLite no sabe quitar
 *    una columna en versiones antiguas), hay que desactivar `foreign_keys`
 *    **fuera** de la transaccion; anotarlo en la propia migracion.
 */
export interface Migracion {
    readonly version: number;
    readonly nombre: string;
    readonly sql: string;
}

export const MIGRACIONES: readonly Migracion[] = [
    {
        version: 1,
        nombre: "esquema-inicial",
        // Copia literal del esquema que ya estaba en db.ts. Es idempotente
        // (todo es IF NOT EXISTS), asi que sellar como version 1 una base que
        // ya lo tiene todo es seguro.
        sql: `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    oidc_subject TEXT NOT NULL UNIQUE,
    email TEXT,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    groups_json TEXT NOT NULL DEFAULT '[]',
    auth_provider TEXT NOT NULL DEFAULT 'authentik',
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_version_id TEXT
  );

  CREATE TABLE IF NOT EXISTS board_versions (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(board_id, version_number)
  );

  CREATE TABLE IF NOT EXISTS share_links (
    token TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    version_id TEXT REFERENCES board_versions(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS classroom_sessions (
    code TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    board_json TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classroom_responses (
    id TEXT PRIMARY KEY,
    session_code TEXT NOT NULL REFERENCES classroom_sessions(code) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    student_label TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classroom_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code TEXT NOT NULL,
    audience TEXT NOT NULL CHECK (audience IN ('students', 'teacher')),
    event_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS arasaac_search_cache (
    query TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_classroom_responses_code ON classroom_responses(session_code, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_classroom_events_stream ON classroom_events(session_code, audience, id);
  CREATE INDEX IF NOT EXISTS idx_classroom_events_created ON classroom_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_oidc_subject ON users(oidc_subject);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
  CREATE INDEX IF NOT EXISTS idx_share_links_board ON share_links(board_id);
  CREATE INDEX IF NOT EXISTS idx_classroom_sessions_teacher ON classroom_sessions(teacher_id);
  CREATE INDEX IF NOT EXISTS idx_uploads_owner ON uploads(owner_id);`
    },
    {
        version: 2,
        nombre: "retirar-uploads",
        // EDUmind Board deja de guardar archivos de nadie: los documentos del
        // docente viven en SU navegador (IndexedDB, `local:<id>`) y no viajan
        // al servidor. Sin ruta que la escriba, esta tabla solo seria un
        // deposito de material ajeno esperando a que alguien lo pidiera.
        //
        // Se comprobo antes de escribirla que ningun tablero (ni borrador ni
        // version publicada) referenciaba una URL /api/uploads/.
        //
        // Los ficheros que hubiera en disco NO los borra esta migracion: eso
        // es cosa de una persona, no de un arranque del servicio.
        sql: `
  DROP INDEX IF EXISTS idx_uploads_owner;
  DROP TABLE IF EXISTS uploads;`
    }
];

/** Comprueba que la lista esta bien formada antes de tocar nada. */
function validarLista(): void {
    MIGRACIONES.forEach((m, i) => {
        if (m.version !== i + 1) {
            throw new Error(
                `Migraciones mal numeradas: se esperaba la version ${i + 1} y hay ${m.version} ("${m.nombre}")`
            );
        }
    });
}

/**
 * Aplica las migraciones pendientes y devuelve la version resultante.
 * Es idempotente: llamarla dos veces no hace nada la segunda.
 */
export function aplicarMigraciones(db: Database): number {
    validarLista();

    const actual = db.pragma("user_version", { simple: true }) as number;
    const pendientes = MIGRACIONES.filter((m) => m.version > actual);
    if (pendientes.length === 0) return actual;

    for (const migracion of pendientes) {
        const aplicar = db.transaction(() => {
            db.exec(migracion.sql);
            // user_version vive en la cabecera del fichero y es transaccional:
            // si la migracion falla, el sello tampoco queda puesto.
            db.pragma(`user_version = ${migracion.version}`);
        });
        aplicar();
    }

    return pendientes[pendientes.length - 1]!.version;
}

/** Version que el codigo espera encontrar en la base. */
export function versionEsperada(): number {
    return MIGRACIONES.length === 0 ? 0 : MIGRACIONES[MIGRACIONES.length - 1]!.version;
}
