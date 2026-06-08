import { useEffect, useState } from "react";
import type { BoardDocument } from "@edumind-board/shared";
import { apiBaseUrl } from "../lib/api";
import { BoardCanvas } from "./BoardCanvas";

type ConnectionState = "connecting" | "live" | "error" | "revoked";

export function ShareView({ token }: { token: string }) {
  const [board, setBoard] = useState<BoardDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/api/share/${token}/stream`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          board?: BoardDocument;
        };

        if (data.type === "connected" || data.type === "update") {
          if (data.board) setBoard(data.board);
          setConnState("live");
          setError(null);
        } else if (data.type === "revoked") {
          setError("Este enlace ha sido revocado por el docente.");
          setConnState("revoked");
          es.close();
        }
      } catch {
        // evento malformado — ignorar
      }
    };

    es.onerror = () => {
      // EventSource reintenta automáticamente; mostramos estado de reconexión
      if (connState !== "revoked") setConnState("error");
    };

    es.addEventListener("open", () => {
      setConnState("live");
    });

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error) {
    return (
      <main className="empty-state">
        <h1>EDUmind Board</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="empty-state">
        <h1>EDUmind Board</h1>
        <p>{connState === "connecting" ? "Conectando con el board…" : "Reconectando…"}</p>
      </main>
    );
  }

  return (
    <>
      <BoardCanvas board={board} readonly presentation />
      {connState === "error" && (
        <div className="share-reconnecting" role="status">
          Reconectando…
        </div>
      )}
    </>
  );
}
