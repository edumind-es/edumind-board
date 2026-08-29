import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { aplicarMigraciones } from "./migraciones.js";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/edumind-board.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// El esquema ya no se crea aqui: lo llevan las migraciones, que si saben
// cambiar una tabla que ya existe. Ver migraciones.ts.
aplicarMigraciones(db);

export function nowIso() {
  return new Date().toISOString();
}
