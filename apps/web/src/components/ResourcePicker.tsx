import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Plus, Search, X } from "lucide-react";
import { listResources, type EduResource } from "../lib/api";

type ResourcePickerProps = {
  onClose: () => void;
  onAdd: (resource: EduResource) => void;
};

export function ResourcePicker({ onClose, onAdd }: ResourcePickerProps) {
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState<EduResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      listResources(query)
        .then((payload) => {
          if (!cancelled) setResources(payload.resources);
        })
        .catch(() => {
          if (!cancelled) setError("No se pudo cargar el catálogo de recursos.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const resource of resources) seen.set(resource.category, (seen.get(resource.category) ?? 0) + 1);
    return Array.from(seen.entries()).slice(0, 8);
  }, [resources]);

  return (
    <div className="resource-picker" role="dialog" aria-label="Recursos EDUmind">
      <div className="resource-picker-header">
        <div>
          <strong>Recursos EDUmind</strong>
          <span>{resources.length} recurso{resources.length === 1 ? "" : "s"} disponible{resources.length === 1 ? "" : "s"}</span>
        </div>
        <button type="button" className="icon-only" title="Cerrar" onClick={onClose}>
          <X size={17} />
        </button>
      </div>

      <label className="resource-search">
        <Search size={16} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por tema, mundo o proyecto" />
      </label>

      {categories.length > 0 && (
        <div className="resource-categories">
          {categories.map(([category, count]) => (
            <button key={category} type="button" onClick={() => setQuery(category)}>
              {category} <span>{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="resource-list">
        {loading && <p className="inspector-hint">Cargando recursos...</p>}
        {error && <p className="warning">{error}</p>}
        {!loading && !error && resources.length === 0 && (
          <p className="inspector-hint">No hay recursos que coincidan con la búsqueda.</p>
        )}
        {!loading && !error && resources.map((resource) => (
          <article key={resource.id} className="resource-row">
            <FileText size={18} />
            <div>
              <strong>{resource.title}</strong>
              <span>{resource.category} · {resource.kind.toUpperCase()}</span>
              {resource.description && <small>{resource.description}</small>}
            </div>
            <button type="button" className="icon-only" title="Añadir al board" onClick={() => onAdd(resource)}>
              <Plus size={16} />
            </button>
            <a className="resource-open" href={resource.url} target="_blank" rel="noreferrer" title="Abrir recurso">
              <ExternalLink size={15} />
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
