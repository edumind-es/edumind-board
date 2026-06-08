import { useState } from "react";
import { Copy, FileDown, FileUp, Plus, Search, Trash2 } from "lucide-react";
import type { BoardSummary } from "../lib/localDb";
import { BOARD_TEMPLATES, type BoardTemplate } from "../lib/templates";

type BoardLibraryProps = {
  boards: BoardSummary[];
  activeBoardId: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: () => void;
  onTemplate: (template: BoardTemplate) => void;
};

type Tab = "boards" | "templates";

const CATEGORIES: Record<BoardTemplate["category"], string> = {
  aula: "Aula",
  matematicas: "Matemáticas",
  escritura: "Escritura",
  calma: "Calma",
  proyecto: "Proyecto",
  general: "General"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function BoardLibrary({
  boards,
  activeBoardId,
  onOpen,
  onCreate,
  onDuplicate,
  onDelete,
  onExport,
  onImport,
  onTemplate
}: BoardLibraryProps) {
  const [tab, setTab] = useState<Tab>("boards");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BoardTemplate["category"] | "all">("all");

  const filteredBoards = boards.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTemplates = BOARD_TEMPLATES.filter(
    (t) => categoryFilter === "all" || t.category === categoryFilter
  );

  return (
    <aside className="board-library">
      {/* Tabs */}
      <div className="library-tabs">
        <button
          type="button"
          className={tab === "boards" ? "tab-active" : ""}
          onClick={() => setTab("boards")}
        >
          Mis boards
        </button>
        <button
          type="button"
          className={tab === "templates" ? "tab-active" : ""}
          onClick={() => setTab("templates")}
        >
          Plantillas
        </button>
      </div>

      {tab === "boards" && (
        <>
          <div className="library-actions">
            <button type="button" className="primary" onClick={onCreate}>
              <Plus size={16} />
              Nuevo
            </button>
            <button type="button" onClick={onImport} title="Importar JSON">
              <FileUp size={16} />
            </button>
            <button type="button" onClick={onExport} title="Exportar board activo">
              <FileDown size={16} />
            </button>
          </div>

          {boards.length > 4 && (
            <div className="library-search">
              <Search size={14} />
              <input
                type="search"
                placeholder="Buscar board…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className="board-list">
            {filteredBoards.length === 0 && (
              <p>{search ? "Sin resultados." : "No hay boards locales todavía."}</p>
            )}
            {filteredBoards.map((summary) => (
              <div
                key={summary.id}
                className={`board-row ${summary.id === activeBoardId ? "is-active" : ""}`}
                onClick={() => onOpen(summary.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onOpen(summary.id);
                }}
                role="button"
                tabIndex={0}
              >
                <span>
                  <strong>{summary.title}</strong>
                  <small>
                    {summary.elementCount} elem. · {formatDate(summary.updatedAt)}
                  </small>
                </span>
                <div className="board-row-actions">
                  <button
                    type="button"
                    className="icon-only"
                    title="Duplicar board"
                    onClick={(e) => { e.stopPropagation(); onDuplicate(summary.id); }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-only icon-danger"
                    title="Eliminar board local"
                    onClick={(e) => { e.stopPropagation(); onDelete(summary.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "templates" && (
        <>
          {/* Filtro por categoría */}
          <div className="template-filters">
            <button
              type="button"
              className={categoryFilter === "all" ? "filter-active" : ""}
              onClick={() => setCategoryFilter("all")}
            >
              Todas
            </button>
            {(Object.keys(CATEGORIES) as BoardTemplate["category"][]).map((cat) => (
              <button
                key={cat}
                type="button"
                className={categoryFilter === cat ? "filter-active" : ""}
                onClick={() => setCategoryFilter(cat)}
              >
                {CATEGORIES[cat]}
              </button>
            ))}
          </div>

          <div className="template-list">
            {filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="template-card"
                onClick={() => onTemplate(tpl)}
                title={tpl.description}
              >
                <span className="template-emoji">{tpl.emoji}</span>
                <span className="template-info">
                  <strong>{tpl.name}</strong>
                  <small>{tpl.description}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
