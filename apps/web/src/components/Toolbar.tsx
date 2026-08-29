import { useState } from "react";
import {
  BookOpen,
  ClipboardList,
  CloudUpload,
  FilePlus2,
  Grid2x2,
  LayoutDashboard,
  Link2,
  Maximize2,
  MousePointer2,
  Music,
  PenLine,
  Square,
  Trash2,
  Wind,
  Youtube
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isAllowedEmbedUrl, shouldLaunchInNewTab } from "@edumind-board/shared";
import { toYouTubeEmbedUrl } from "../lib/music";
import { MusicPanel } from "./MusicPanel";
import { AppsPanel } from "./AppsPanel";
import { BreathPanel } from "./BreathPanel";
import { NubePanel } from "./NubePanel";
import { ACTIVITY_BLUEPRINTS, type ActivityBlueprint } from "../activities/catalog";
import { useBoardStore } from "../lib/store";
import { createHubApp, createMusicaPreset, createIframePreset } from "../lib/boardFactory";
import { CLASSROOM_PROFILES, type ClassroomProfile } from "../profiles/profiles";
import { WIDGET_GROUPS, getWidgetDefinitions, type WidgetGroup } from "../widgets/registry";
import { confirmDialog, toast } from "./ui/feedback";

type IframePreset = { label: string; icon: LucideIcon; url: string; title: string };
type ActivePanel = WidgetGroup | "profile" | "activities" | "music" | "apps" | "breath" | "nube" | null;

const iframePresets: IframePreset[] = [
  { label: "Música",  icon: Music,   url: "", title: "Música" },
  { label: "YouTube", icon: Youtube, url: "https://www.youtube-nocookie.com/embed/", title: "YouTube" }
];

export function Toolbar({
  activeProfile,
  onSelectProfile,
  onCreateFromProfile,
  onCreateActivity,
  onPresent,
  onImportAsset,
  onOpenResources
}: {
  activeProfile: ClassroomProfile;
  onSelectProfile: (profile: ClassroomProfile) => void;
  onCreateFromProfile: (profile: ClassroomProfile) => void;
  onCreateActivity: (activity: ActivityBlueprint) => void;
  onPresent: () => void;
  onImportAsset: () => void;
  onOpenResources: () => void;
}) {
  const addElement = useBoardStore((s) => s.addElement);
  const addElementObject = useBoardStore((s) => s.addElementObject);
  const upsertMusica = useBoardStore((s) => s.upsertMusica);
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const inkCount = useBoardStore((s) => s.board?.ink?.length ?? 0);
  const globalInkMode = useBoardStore((s) => s.globalInkMode);
  const setGlobalInkMode = useBoardStore((s) => s.setGlobalInkMode);
  const toggleGlobalInkMode = useBoardStore((s) => s.toggleGlobalInkMode);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const favoriteWidgets = getWidgetDefinitions(activeProfile.favoriteWidgetTypes);

  const activeGroup = typeof activePanel === "object" ? activePanel : null;
  const profilePanelOpen = activePanel === "profile";
  const activitiesPanelOpen = activePanel === "activities";

  function addWebEmbed() {
    const url = window.prompt("URL https:// para embeber en el board", "https://phet.colorado.edu/");
    if (!url) return;
    const normalizedUrl = url.includes("youtube") || url.includes("youtu.be") ? toYouTubeEmbedUrl(url) : url.trim();
    if (!isAllowedEmbedUrl(normalizedUrl)) {
      toast("Ese dominio no está permitido. Usa PhET, YouTube, Vimeo, Canva, SoundCloud, portales educativos oficiales o apps EDUmind.", "error");
      return;
    }
    // Los LMS/portales institucionales (EVA, EducaMadrid…) prohíben el framing:
    // se añaden como tarjeta-lanzador en vez de un iframe que saldría en blanco.
    const launch = shouldLaunchInNewTab(normalizedUrl);
    addElementObject(createIframePreset(normalizedUrl, "Recurso web", launch ? "launcher" : "embed"));
    if (launch) {
      toast("Este sitio no permite verse embebido (por seguridad). Lo he añadido como tarjeta para abrirlo en una pestaña nueva.", "info");
    }
  }

  function addPresetEmbed(preset: IframePreset) {
    if (preset.label === "Música") {
      // Abre el panel de música por modo de trabajo (con playlists curadas).
      setActivePanel((current) => (current === "music" ? null : "music"));
      return;
    }
    if (preset.label === "YouTube") {
      const url = window.prompt("Pega la URL de YouTube", "https://www.youtube.com/watch?v=");
      if (!url) return;
      const embedUrl = toYouTubeEmbedUrl(url);
      if (!isAllowedEmbedUrl(embedUrl) || !embedUrl.includes("/embed/")) {
        toast("No he podido reconocer ese recurso de YouTube. Pega un vídeo o playlist pública.", "error");
        return;
      }
      addElementObject(createIframePreset(embedUrl, "YouTube"));
      return;
    }
    addElementObject(createIframePreset(preset.url, preset.title));
  }

  function activateDesktopSelector() {
    setGlobalInkMode(false);
    setSelectedId(null);
    setActivePanel(null);
  }

  function clearInkCanvas() {
    if (inkCount <= 0) return;
    void confirmDialog({
      title: "Limpiar lienzo",
      message: "¿Limpiar todo el lienzo? Se borrarán dibujos, formas y trazos.",
      confirmLabel: "Limpiar",
      danger: true
    }).then((accepted) => {
      if (accepted) window.dispatchEvent(new CustomEvent("ink:clear"));
    });
  }

  return (
    <>
    <aside className="toolbar" aria-label="Herramientas">
      <div className="toolbar-group-label">Menú</div>
      <button
        type="button"
        title={`Perfil: ${activeProfile.name}`}
        className={profilePanelOpen ? "toolbar-ink-active" : ""}
        onClick={() => setActivePanel((current) => current === "profile" ? null : "profile")}
      >
        <LayoutDashboard size={22} />
        <span>{activeProfile.shortName}</span>
      </button>
      <button
        type="button"
        title="Actividades guiadas"
        className={activitiesPanelOpen ? "toolbar-ink-active" : ""}
        onClick={() => setActivePanel((current) => current === "activities" ? null : "activities")}
      >
        <ClipboardList size={22} />
        <span>Actividades</span>
      </button>
      {WIDGET_GROUPS.filter((group) => group.id !== "apps").map((group) => {
        const Icon = group.icon;
        return (
          <button key={group.id} type="button" title={group.label}
            className={activeGroup?.id === group.id ? "toolbar-ink-active" : ""}
            onClick={() => setActivePanel((current) =>
              typeof current === "object" && current?.id === group.id ? null : group
            )}>
            <Icon size={22} />
            <span>{group.label}</span>
          </button>
        );
      })}

      <div className="toolbar-divider-h" />

      <button type="button" title="PDF o imagen local" onClick={onImportAsset}>
        <FilePlus2 size={22} />
        <span>Archivo</span>
      </button>
      <button type="button" title="Archivo en Drive, OneDrive, Dropbox o Nextcloud"
        className={activePanel === "nube" ? "toolbar-ink-active" : ""}
        onClick={() => setActivePanel((current) => (current === "nube" ? null : "nube"))}>
        <CloudUpload size={22} />
        <span>Nube</span>
      </button>
      <button type="button" title="Embed web" onClick={addWebEmbed}>
        <Link2 size={22} />
        <span>Web</span>
      </button>
      <button type="button" title="Recursos EDUmind" onClick={onOpenResources}>
        <BookOpen size={22} />
        <span>Recursos</span>
      </button>

      <div className="toolbar-divider-h" />

      {/* Apps EDUmind + YouTube.
          Respirar y Apps estaban enterradas (Breath solo dentro del App Hub o
          de una plantilla; el App Hub, dentro de «Manipulativos»). Aquí tienen
          su sitio en el menú principal. */}
      <div className="toolbar-group-label">Apps</div>
      <button type="button" title="Respiración guiada — elige estrategia"
        className={activePanel === "breath" ? "toolbar-ink-active" : ""}
        onClick={() => setActivePanel((current) => (current === "breath" ? null : "breath"))}>
        <Wind size={22} />
        <span>Respirar</span>
      </button>
      <button type="button" title="Apps EDUmind"
        className={activePanel === "apps" ? "toolbar-ink-active" : ""}
        onClick={() => setActivePanel((current) => (current === "apps" ? null : "apps"))}>
        <Grid2x2 size={22} />
        <span>Apps</span>
      </button>
      {iframePresets.map(({ label, icon: Icon, url, title }) => (
        <button key={label} type="button" title={title}
          onClick={() => addPresetEmbed({ label, icon: Icon, url, title })}>
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}

      <div className="toolbar-divider-h" />

      {/* Lienzo global */}
      <button type="button" title="Selector — mover, seleccionar o borrar elementos del escritorio"
        className={!globalInkMode ? "toolbar-ink-active" : ""}
        onClick={activateDesktopSelector}>
        <MousePointer2 size={22} />
        <span>Selector</span>
      </button>
      <button type="button" title="Activar lienzo — dibuja sobre todo el board"
        className={globalInkMode ? "toolbar-ink-active" : ""}
        onClick={toggleGlobalInkMode}>
        <PenLine size={22} />
        <span>Lienzo</span>
      </button>
      <button type="button" title="Limpiar lienzo — borrar todos los trazos y formas"
        disabled={inkCount <= 0}
        onClick={clearInkCanvas}>
        <Trash2 size={22} />
        <span>Limpiar</span>
      </button>

      <div className="toolbar-divider-h" />

      {/* Acciones */}
      <button type="button" title="Deseleccionar" onClick={() => setSelectedId(null)}>
        <Square size={22} />
        <span>Soltar</span>
      </button>
      <button type="button" title="Modo presentación / PDI" onClick={onPresent}>
        <Maximize2 size={22} />
        <span>PDI</span>
      </button>
    </aside>

    {profilePanelOpen && (
      <div className="tool-palette" role="dialog" aria-label="Perfil de aula">
        <section>
          <div className="tool-palette-title">Perfil de aula</div>
          <div className="profile-menu-grid">
            {CLASSROOM_PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={profile.id === activeProfile.id ? "profile-menu-active" : ""}
                title={profile.description}
                onClick={() => onSelectProfile(profile)}
              >
                <span>{profile.emoji}</span>
                <strong>{profile.shortName}</strong>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="tool-palette-title">Favoritos de {activeProfile.shortName}</div>
          <div className="tool-palette-grid">
            {favoriteWidgets.map((tool) => {
              const Icon = tool.icon;
              return (
                <button key={`${activeProfile.id}-${tool.type}`} type="button" title={tool.label}
                  onClick={() => { addElement(tool.type); setActivePanel(null); }}>
                  <Icon size={18} />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="tool-palette-actions">
          <button type="button" className="primary" onClick={() => { onCreateFromProfile(activeProfile); setActivePanel(null); }}>
            Crear board {activeProfile.shortName}
          </button>
        </section>
      </div>
    )}

    {activeGroup && (
      <div className="tool-palette" role="dialog" aria-label={`Herramientas de ${activeGroup.label}`}>
        <section>
          <div className="tool-palette-title">{activeGroup.label}</div>
          <div className="tool-palette-grid">
            {activeGroup.widgets.map((tool) => {
              const Icon = tool.icon;
              return (
                <button key={`${tool.type}-${tool.label}`} type="button" title={tool.label}
                  onClick={() => { addElement(tool.type); setActivePanel(null); }}>
                  <Icon size={18} />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    )}

    {activitiesPanelOpen && (
      <div className="tool-palette activity-tool-palette" role="dialog" aria-label="Actividades guiadas">
        <section>
          <div className="tool-palette-title">Actividades</div>
          <div className="activity-tool-list">
            {ACTIVITY_BLUEPRINTS.map((activity) => (
              <button
                key={activity.id}
                type="button"
                title={activity.objective}
                onClick={() => {
                  onCreateActivity(activity);
                  setActivePanel(null);
                }}
              >
                <strong>{activity.title}</strong>
                <small>{activity.estimatedTimeMinutes} min · {activity.steps.length} pasos</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    )}
    {activePanel === "apps" && (
      <AppsPanel
        onInsert={(appId, modo) => addElementObject(createHubApp(appId, modo))}
        onClose={() => setActivePanel(null)}
      />
    )}
    {activePanel === "breath" && (
      <BreathPanel
        onInsert={(url, titulo) => addElementObject(createIframePreset(url, titulo))}
        onClose={() => setActivePanel(null)}
      />
    )}
    {activePanel === "nube" && (
      <NubePanel
        onInsert={(url, titulo, modo) => addElementObject(createIframePreset(url, titulo, modo))}
        onClose={() => setActivePanel(null)}
      />
    )}
    {activePanel === "music" && (
      <MusicPanel
        onInsert={(url, title, mode) => upsertMusica(createIframePreset(url, title, mode))}
        onInsertNativo={(modeId, title) => upsertMusica(createMusicaPreset(modeId, title))}
        onClose={() => setActivePanel(null)}
      />
    )}
    </>
  );
}
