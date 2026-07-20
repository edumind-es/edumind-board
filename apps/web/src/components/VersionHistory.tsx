// Historial de versiones publicadas del board activo.
// Permite restaurar cualquier snapshot como borrador local actual.
import { useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import type { BoardDocument } from "@edumind-board/shared";
import { getBoardVersion, listBoardVersions, type BoardVersionSummary } from "../lib/api";
import { confirmDialog, toast } from "./ui/feedback";

type Props = {
  boardId: string;
  onRestore: (board: BoardDocument) => void;
  onClose: () => void;
};

export function VersionHistory({ boardId, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<BoardVersionSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBoardVersions(boardId)
      .then((result) => { if (!cancelled) setVersions(result.versions); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [boardId]);

  async function restore(version: BoardVersionSummary) {
    const accepted = await confirmDialog({
      title: `Restaurar versión ${version.versionNumber}`,
      message: "El borrador actual se sustituirá por esta versión publicada. Podrás volver a publicar cuando quieras.",
      confirmLabel: "Restaurar"
    });
    if (!accepted) return;
    setBusyId(version.id);
    try {
      const result = await getBoardVersion(boardId, version.id);
      onRestore({ ...result.version.board, updatedAt: new Date().toISOString() });
      toast(`Versión ${version.versionNumber} restaurada como borrador`, "success");
      onClose();
    } catch (err) {
      console.error(err);
      toast("No se pudo cargar esa versión.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="version-history" role="dialog" aria-label="Historial de versiones">
      <header>
        <History size={17} aria-hidden="true" />
        <strong>Historial de versiones</strong>
        <button type="button" className="icon-only" aria-label="Cerrar historial" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      {error && <p className="version-empty">No se pudo cargar el historial. ¿Has publicado este board alguna vez?</p>}
      {!error && versions === null && <p className="version-empty">Cargando…</p>}
      {!error && versions?.length === 0 && (
        <p className="version-empty">Todavía no hay versiones. Cada vez que publiques se guardará una.</p>
      )}

      {versions && versions.length > 0 && (
        <ul>
          {versions.map((version) => (
            <li key={version.id}>
              <div className="version-meta">
                <span className="version-number">v{version.versionNumber}</span>
                <span className="version-date">
                  {new Date(version.createdAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                {version.isPublished && <span className="version-live">En vivo</span>}
              </div>
              <button type="button" disabled={busyId !== null}
                onClick={() => restore(version)}
                aria-label={`Restaurar versión ${version.versionNumber}`}>
                <RotateCcw size={14} />
                {busyId === version.id ? "Cargando…" : "Restaurar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
