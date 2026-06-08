import { useEffect, useRef, useState } from "react";
import { Loader, RefreshCw, Users, X } from "lucide-react";
import type { BoardDocument } from "@edumind-board/shared";
import { apiBaseUrl } from "../lib/api";
import { useBoardStore } from "../lib/store";

type SalaResponse = {
  id: string;
  type: string;
  payload: { emoji?: string; label?: string };
  studentLabel: string | null;
  createdAt: string;
};

function responseIcon(r: SalaResponse): string {
  if (r.type === "hand") return "✋";
  return r.payload?.emoji ?? "●";
}

function responseLabel(r: SalaResponse): string {
  if (r.type === "hand") return "Mano levantada";
  return r.payload?.label ?? r.payload?.emoji ?? "—";
}

function relativeTime(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "ahora";
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}min`;
}

type Props = {
  code: string;
  board: BoardDocument | null;
  projectorToken?: string | null;
  onClose: () => void;
};

export function SalaPanel({ code, board, projectorToken, onClose }: Props) {
  const [responses, setResponses] = useState<SalaResponse[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const updateElement = useBoardStore((s) => s.updateElement);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aulaUrl = `${window.location.origin}/aula/${code}`;

  // SSE docente: respuestas de alumnos en tiempo real
  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/api/sala/${code}/teacher-stream`, {
      withCredentials: true
    });

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          responses?: SalaResponse[];
          response?: SalaResponse;
        };
        if (data.type === "connected") {
          setResponses(data.responses ?? []);
        }
        if (data.type === "response" && data.response) {
          setResponses((prev) => [data.response!, ...prev.slice(0, 49)]);
        }
        if (data.type === "responses:cleared") {
          setResponses([]);
        }
      } catch { /* ignorar */ }
    };

    return () => es.close();
  }, [code]);

  // Auto-sync: cuando el board cambia, enviar a los alumnos (debounce 1.5s)
  useEffect(() => {
    if (!board) return;
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      void syncBoard(board);
    }, 1500);
    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  async function syncBoard(currentBoard: BoardDocument) {
    setSyncing(true);
    setSyncError(null);
    try {
      await fetch(`${apiBaseUrl}/api/sala/${code}/board`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ board: currentBoard })
      }).then((response) => {
        if (!response.ok) throw new Error(`Sala sync failed with ${response.status}`);
      });
      setSyncedAt(new Date());
    } catch {
      setSyncError("No se pudo sincronizar la sala.");
    } finally {
      setSyncing(false);
    }
  }

  async function clearResponses() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sala/${code}/responses`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) throw new Error(`Clear responses failed with ${response.status}`);
      setResponses([]);
    } catch {
      setResponses([]);
    }
  }

  const connectedCount = responses.filter(
    (r) => Date.now() - new Date(r.createdAt).getTime() < 60000
  ).length;

  return (
    <div className="sala-panel">
      <div className="sala-panel-header">
        <div className="sala-header-left">
          <Users size={16} />
          <span>Sala activa</span>
          {connectedCount > 0 && (
            <span className="sala-badge">{connectedCount}</span>
          )}
        </div>
        <button type="button" className="icon-only" title="Cerrar sala" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Código grande */}
      <div className="sala-code-block">
        <div className="sala-code">{code}</div>
        <a className="sala-url" href={aulaUrl} target="_blank" rel="noreferrer">
          {aulaUrl}
        </a>
        <button
          type="button"
          className="sala-copy-btn"
          onClick={() => navigator.clipboard.writeText(aulaUrl)}
          title="Copiar enlace"
        >
          Copiar enlace
        </button>
      </div>

      {/* Estado de sincronización */}
      <div className="sala-sync-status">
        {syncing ? (
          <span className="sala-syncing"><Loader size={12} /> Sincronizando…</span>
        ) : syncError ? (
          <span className="sala-sync-error">{syncError}</span>
        ) : syncedAt ? (
          <span className="sala-synced">
            <RefreshCw size={12} /> Board enviado a {new Date(syncedAt).toLocaleTimeString("es")}
          </span>
        ) : (
          <span className="sala-synced-none">Editando: se sincroniza automáticamente</span>
        )}
        <button type="button" className="sala-sync-btn" onClick={() => board && syncBoard(board)}>
          Sincronizar ahora
        </button>
      </div>

      {/* Respuestas de alumnos */}
      <div className="sala-responses-header">
        <span>Respuestas ({responses.length})</span>
        {responses.length > 0 && (
          <button type="button" onClick={() => void clearResponses()} className="sala-clear">Limpiar</button>
        )}
      </div>

      <div className="sala-responses-list">
        {responses.length === 0 ? (
          <p className="sala-empty">Sin respuestas aún. Los alumnos ven el board en <strong>/aula/{code}</strong></p>
        ) : (
          responses.map((r) => (
            <div key={r.id} className={`sala-response sala-response-${r.type}`}>
              <span className="sala-response-icon">{responseIcon(r)}</span>
              <span className="sala-response-info">
                <strong>{r.studentLabel || "Alumno"}</strong>
                <small>{responseLabel(r)}</small>
              </span>
              <span className="sala-response-time">{relativeTime(r.createdAt)}</span>
            </div>
          ))
        )}
      </div>

      {/* Enlace a vista proyector (si el board está compartido) */}
      <div className="sala-proyector-hint">
        {projectorToken ? (
          <small>
            Vista proyector sin UI: <a href={`${window.location.origin}/proyector/${projectorToken}`} target="_blank" rel="noreferrer">
              /proyector/{projectorToken.slice(0, 8)}...
            </a>
          </small>
        ) : (
          <small>Publica y comparte el board para activar la vista proyector.</small>
        )}
      </div>
    </div>
  );
}
