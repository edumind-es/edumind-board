import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/edumind-board.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
`);

export function nowIso() {
  return new Date().toISOString();
}
