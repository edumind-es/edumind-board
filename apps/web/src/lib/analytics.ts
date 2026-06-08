// Analytics local — 100% privado, sin telemetría externa. Almacenado en IndexedDB.
// Solo se usa para que el docente vea qué widgets usa más.

import { openDB } from "idb";
import type { BoardElement } from "@edumind-board/shared";

type EventType =
  | "widget_added"
  | "board_opened"
  | "board_created"
  | "template_used"
  | "sala_started"
  | "session_start"
  | "session_end";

type AnalyticsEvent = {
  type: EventType;
  widgetType?: BoardElement["type"];
  templateId?: string;
  sessionDuration?: number; // segundos
  ts: number;
};

type WidgetStat = { type: BoardElement["type"]; count: number };
type SessionStat = { date: string; duration: number; boardsOpened: number };

const DB_NAME = "edumind-board-analytics";
const STORE = "events";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("ts", "ts");
        store.createIndex("type", "type");
      }
    }
  });
}

export async function trackEvent(event: Omit<AnalyticsEvent, "ts">) {
  try {
    const db = await getDB();
    await db.add(STORE, { ...event, ts: Date.now() });
  } catch {
    // Analytics nunca debe romper la app principal
  }
}

// Resumen de los últimos 30 días
export async function getStats(): Promise<{
  widgetStats: WidgetStat[];
  sessionStats: SessionStat[];
  totalBoards: number;
  totalSessions: number;
  totalTemplates: number;
}> {
  try {
    const db = await getDB();
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events = (await db.getAll(STORE)) as (AnalyticsEvent & { id: number })[];
    const recent = events.filter((e) => e.ts >= since);

    // Widgets más usados
    const widgetCounts = new Map<string, number>();
    for (const e of recent.filter((e) => e.type === "widget_added" && e.widgetType)) {
      const t = e.widgetType!;
      widgetCounts.set(t, (widgetCounts.get(t) ?? 0) + 1);
    }
    const widgetStats: WidgetStat[] = [...widgetCounts.entries()]
      .map(([type, count]) => ({ type: type as BoardElement["type"], count }))
      .sort((a, b) => b.count - a.count);

    // Sesiones por día
    const sessionsByDay = new Map<string, { duration: number; boards: number }>();
    for (const e of recent) {
      const day = new Date(e.ts).toLocaleDateString("es", { day: "2-digit", month: "short" });
      if (!sessionsByDay.has(day)) sessionsByDay.set(day, { duration: 0, boards: 0 });
      if (e.type === "session_end" && e.sessionDuration) {
        sessionsByDay.get(day)!.duration += e.sessionDuration;
      }
      if (e.type === "board_opened") {
        sessionsByDay.get(day)!.boards += 1;
      }
    }
    const sessionStats: SessionStat[] = [...sessionsByDay.entries()]
      .map(([date, { duration, boards }]) => ({ date, duration, boardsOpened: boards }))
      .slice(-14);

    return {
      widgetStats,
      sessionStats,
      totalBoards: recent.filter((e) => e.type === "board_opened").length,
      totalSessions: recent.filter((e) => e.type === "session_start").length,
      totalTemplates: recent.filter((e) => e.type === "template_used").length
    };
  } catch {
    return { widgetStats: [], sessionStats: [], totalBoards: 0, totalSessions: 0, totalTemplates: 0 };
  }
}

// Exportar eventos como CSV para el docente
export async function exportAnalyticsCSV(): Promise<string> {
  try {
    const db = await getDB();
    const events = (await db.getAll(STORE)) as (AnalyticsEvent & { id: number })[];
    const rows = [
      ["Fecha", "Tipo", "Widget", "Plantilla", "Duración (s)"],
      ...events.map((e) => [
        new Date(e.ts).toLocaleString("es"),
        e.type,
        e.widgetType ?? "",
        e.templateId ?? "",
        e.sessionDuration ?? ""
      ])
    ];
    return rows.map((r) => r.join(",")).join("\n");
  } catch {
    return "";
  }
}

// Limpia eventos de más de 90 días
export async function pruneOldEvents() {
  try {
    const db = await getDB();
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const all = (await db.getAll(STORE)) as (AnalyticsEvent & { id: number })[];
    for (const e of all.filter((e) => e.ts < cutoff)) {
      await db.delete(STORE, e.id);
    }
  } catch { /* silencioso */ }
}
