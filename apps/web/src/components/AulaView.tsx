import { useEffect, useRef, useState } from "react";
import type { BoardDocument } from "@edumind-board/shared";
import { apiBaseUrl } from "../lib/api";
import { BoardCanvas } from "./BoardCanvas";

type ResponseType = "emoji" | "hand";

type ResponsePayload =
  | { emoji: string; label: string }
  | Record<string, never>;

const STATUS_OPTIONS: Array<{ emoji: string; label: string; color: string }> = [
  { emoji: "✓", label: "Entendido", color: "#2f9f72" },
  { emoji: "?", label: "Confundido", color: "#e0a72e" },
  { emoji: "✋", label: "Ayuda", color: "#3a7fc1" },
  { emoji: "😊", label: "Bien", color: "#2a7a6d" }
];

export function AulaView({ code }: { code: string }) {
  const [board, setBoard] = useState<BoardDocument | null>(null);
  const [status, setStatus] = useState<"entering" | "live" | "ended" | "notfound">("entering");
  const [studentLabel, setStudentLabel] = useState(
    () => sessionStorage.getItem(`aula-label-${code}`) ?? ""
  );
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function enterAula() {
    sessionStorage.setItem(`aula-label-${code}`, studentLabel);
    setStatus("live");
  }

  // Conectar al SSE de la sala cuando el alumno entra
  useEffect(() => {
    if (status !== "live") return;

    const es = new EventSource(`${apiBaseUrl}/api/sala/${code}/stream`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          board?: BoardDocument;
        };
        if ((data.type === "connected" || data.type === "board") && data.board) {
          setBoard(data.board);
        }
        if (data.type === "connected" && !data.board) {
          // Sala activa pero sin board aún
        }
        if (data.type === "ended") {
          setStatus("ended");
          es.close();
        }
      } catch { /* ignorar */ }
    };

    es.onerror = () => {
      // EventSource reintenta automáticamente
    };

    // Verificar que la sala existe
    fetch(`${apiBaseUrl}/api/sala/${code}`)
      .then((r) => { if (!r.ok) setStatus("notfound"); })
      .catch(() => setStatus("notfound"));

    return () => es.close();
  }, [status, code]);

  async function sendResponse(type: ResponseType, payload: ResponsePayload) {
    if (cooldownRef.current) return; // Anti-spam: 3s entre respuestas
    setLastResponse(type === "hand" ? "✋" : (payload as { emoji: string }).emoji);
    cooldownRef.current = setTimeout(() => {
      cooldownRef.current = null;
      setLastResponse(null);
    }, 3000);

    await fetch(`${apiBaseUrl}/api/sala/${code}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        payload,
        studentLabel: studentLabel || undefined
      })
    }).catch(() => { /* ignorar errores de red silenciosamente */ });
  }

  // ── Pantalla de entrada ────────────────────────────────────────────────────
  if (status === "entering") {
    return (
      <div className="aula-enter">
        <div className="aula-enter-card">
          <div className="aula-code-big">{code}</div>
          <h1>Sala de clase</h1>
          <p>Tu docente ha abierto esta sala. Puedes unirte sin cuenta.</p>
          <input
            type="text"
            placeholder="Tu nombre (opcional)"
            value={studentLabel}
            maxLength={40}
            onChange={(e) => setStudentLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") enterAula(); }}
            autoFocus
          />
          <button type="button" className="primary" onClick={enterAula}>
            Entrar a la sala
          </button>
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="aula-enter">
        <div className="aula-enter-card">
          <div className="aula-code-big">⚠</div>
          <h1>Sala no encontrada</h1>
          <p>El código <strong>{code}</strong> no corresponde a ninguna sala activa.</p>
          <p>Pide al docente que te dé el código correcto.</p>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="aula-enter">
        <div className="aula-enter-card">
          <div className="aula-code-big">✓</div>
          <h1>Sesión finalizada</h1>
          <p>El docente ha cerrado la sala. ¡Hasta la próxima!</p>
        </div>
      </div>
    );
  }

  // ── Vista principal del alumno ─────────────────────────────────────────────
  return (
    <div className="aula-shell">
      {/* guestMode: alumnos sin cuenta EDUmind acceden a apps hub via guestUrl */}
      {board ? (
        <BoardCanvas board={board} readonly presentation liveControls guestMode />
      ) : (
        <div className="aula-waiting">
          <div className="aula-code-big">{code}</div>
          <p>Esperando al docente…</p>
          <small>La pantalla se actualizará automáticamente</small>
        </div>
      )}

      {/* Barra de respuestas en la parte inferior */}
      <div className="aula-bar">
        {studentLabel && (
          <span className="aula-label">{studentLabel}</span>
        )}
        <div className="aula-responses">
          {STATUS_OPTIONS.map(({ emoji, label, color }) => (
            <button
              key={emoji}
              type="button"
              className={`aula-btn ${lastResponse === emoji ? "aula-btn-sent" : ""}`}
              style={{ "--aula-color": color } as React.CSSProperties}
              title={label}
              onClick={() => sendResponse("emoji", { emoji, label })}
            >
              <span className="aula-emoji">{emoji}</span>
              <span className="aula-btn-label">{label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`aula-btn aula-btn-hand ${lastResponse === "✋" ? "aula-btn-sent" : ""}`}
            title="Levantar la mano"
            onClick={() => sendResponse("hand", {})}
          >
            <span className="aula-emoji">✋</span>
            <span className="aula-btn-label">Mano</span>
          </button>
        </div>
        {lastResponse && (
          <span className="aula-sent-indicator">Enviado {lastResponse}</span>
        )}
      </div>
    </div>
  );
}
