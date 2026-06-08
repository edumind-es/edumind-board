import { useEffect, useState } from "react";
import type { BoardDocument } from "@edumind-board/shared";
import { apiBaseUrl } from "../lib/api";
import { BoardCanvas } from "./BoardCanvas";

// Vista proyector — full-screen readonly, sin ninguna UI.
// Usa el mismo SSE que ShareView para recibir actualizaciones del docente.
// Acceso: /proyector/:token

export function ProjectorView({ token }: { token: string }) {
  const [board, setBoard] = useState<BoardDocument | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/api/share/${token}/stream`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type: string; board?: BoardDocument };
        if ((data.type === "connected" || data.type === "update") && data.board) {
          setBoard(data.board);
          setStatus("live");
        }
        if (data.type === "revoked") {
          setStatus("error");
          es.close();
        }
      } catch { /* ignorar eventos malformados */ }
    };

    es.onerror = () => { setStatus("error"); };

    return () => es.close();
  }, [token]);

  if (status === "error") {
    return (
      <div className="proyector-msg">
        <p>Este enlace no está disponible o ha sido revocado.</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="proyector-msg">
        <p>Conectando con el docente…</p>
      </div>
    );
  }

  return <BoardCanvas board={board} readonly presentation liveControls />;
}
