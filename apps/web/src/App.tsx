import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { newId } from "./lib/ids";
import { Circle, Copy, Library, LogIn, LogOut, Minus, RotateCcw, Save, Send, ShieldOff, User, Users, X, ZoomIn } from "lucide-react";
import { boardDocumentSchema } from "@edumind-board/shared";
import { AuthBanner } from "./components/AuthBanner";
import { AulaView } from "./components/AulaView";
import { BoardCanvas } from "./components/BoardCanvas";
import { BoardLibrary } from "./components/BoardLibrary";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Inspector } from "./components/Inspector";
import { GlobalInkToolbar } from "./components/GlobalInkToolbar";
import { ProjectorView } from "./components/ProjectorView";
import { ResourcePicker } from "./components/ResourcePicker";
import { SalaPanel } from "./components/SalaPanel";
import { ShareView } from "./components/ShareView";
import { Toolbar } from "./components/Toolbar";
import { apiBaseUrl } from "./lib/api";
import { createShare, listShares, publishBoard, revokeShare } from "./lib/api";
import { trackEvent, pruneOldEvents } from "./lib/analytics";
import { isTrustedOrigin, type PluginMessage } from "./lib/hubApps";
import { checkAuth, getLoginUrl, getLogoutUrl, type AuthState } from "./lib/auth";
import { createEmptyBoard, createFileElement, createIframePreset } from "./lib/boardFactory";
import { applyTemplate } from "./lib/templates";
import {
  deleteBoardLocal,
  listBoardsLocal,
  loadBoardLocal,
  loadLastBoardLocal,
  rememberLastBoard,
  saveBoardLocal,
  type BoardSummary
} from "./lib/localDb";
import { useBoardStore } from "./lib/store";
import type { BoardTemplate } from "./lib/templates";

function statusText(state: string) {
  if (state === "dirty") return "Guardado local pendiente";
  if (state === "publishing") return "Publicando…";
  if (state === "published") return "Publicado";
  if (state === "error") return "Error al publicar";
  return "Guardado local";
}

function EditorApp() {
  const board = useBoardStore((state) => state.board);
  const saveState = useBoardStore((state) => state.saveState);
  const shareToken = useBoardStore((state) => state.shareToken);
  const selectedId = useBoardStore((state) => state.selectedId);
  const _historyIndex = useBoardStore((state) => state._historyIndex);
  const _history = useBoardStore((state) => state._history);
  const setBoard = useBoardStore((state) => state.setBoard);
  const setSaveState = useBoardStore((state) => state.setSaveState);
  const setShareToken = useBoardStore((state) => state.setShareToken);
  const updateBoard = useBoardStore((state) => state.updateBoard);
  const setTheme = useBoardStore((state) => state.setTheme);
  const _addElement = useBoardStore((state) => state.addElement);
  const addElementObject = useBoardStore((state) => state.addElementObject);
  // Wrapper que trackea el widget añadido
  const addElement = useCallback((type: Parameters<typeof _addElement>[0]) => {
    _addElement(type);
    void trackEvent({ type: "widget_added", widgetType: type });
  }, [_addElement]);
  const removeSelected = useBoardStore((state) => state.removeSelected);
  const duplicateSelected = useBoardStore((state) => state.duplicateSelected);
  const updateElement = useBoardStore((state) => state.updateElement);
  const undo = useBoardStore((state) => state.undo);
  const redo = useBoardStore((state) => state.redo);

  const [presentation, setPresentation] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeShares, setActiveShares] = useState<Array<{ token: string; active: boolean }>>([]);
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
  const [salaCode, setSalaCode] = useState<string | null>(null);
  const [salaOpen, setSalaOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordFrames, setRecordFrames] = useState<string[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureFnRef = useRef<(() => string | null) | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const shareUrl = useMemo(
    () => (shareToken ? `${window.location.origin}/share/${shareToken}` : null),
    [shareToken]
  );

  const isAuthenticated = authState.status === "authenticated";
  const authUser = authState.status === "authenticated" ? authState.user : null;

  // Comprobación de auth al montar — falla silenciosamente a modo anónimo
  useEffect(() => {
    checkAuth().then(setAuthState);
  }, [authUser, isAuthenticated]);

  const canUndo = _historyIndex > 0;
  const canRedo = _historyIndex < _history.length - 1;

  async function refreshBoardList() {
    setBoards(await listBoardsLocal());
  }

  async function refreshShares(boardId: string) {
    if (!isAuthenticated) return;
    try {
      const result = await listShares(boardId);
      setActiveShares(result.shares.filter((share) => share.active));
    } catch {
      setActiveShares([]);
    }
  }

  const sessionStartRef = useRef(Date.now());
  const syncClientIdRef = useRef(newId());

  useEffect(() => {
    // Analytics: inicio de sesión + limpieza de eventos viejos
    void trackEvent({ type: "session_start" });
    void pruneOldEvents();

    // Cerrar sesión al abandonar la página
    const handleUnload = () => {
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
      void trackEvent({ type: "session_end", sessionDuration: duration });
    };
    window.addEventListener("beforeunload", handleUnload);

    // BroadcastChannel: sincronizar el mismo board entre pestañas
    const channel = new BroadcastChannel("edumind-board-sync");
    channel.onmessage = (event: MessageEvent<{ type: string; boardId: string; sourceId?: string }>) => {
      if (event.data.sourceId === syncClientIdRef.current) return;
      if (event.data.type === "board-saved" && event.data.boardId === useBoardStore.getState().board?.id) {
        loadBoardLocal(event.data.boardId).then((updated) => {
          if (updated) useBoardStore.getState().setBoard(updated);
        });
      }
    };

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emitir BroadcastChannel cuando el board se guarda
  useEffect(() => {
    if (board && saveState === "local") {
      try {
        const ch = new BroadcastChannel("edumind-board-sync");
        ch.postMessage({ type: "board-saved", boardId: board.id, sourceId: syncClientIdRef.current });
        ch.close();
      } catch { /* ignorar si no disponible */ }
    }
  }, [board, saveState]);

  useEffect(() => {
    loadLastBoardLocal().then((localBoard) => {
      const initial = localBoard ?? createEmptyBoard();
      setBoard(initial);
      saveBoardLocal(initial).then(refreshBoardList);
      if (isAuthenticated) refreshShares(initial.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setBoard]);

  useEffect(() => {
    if (!board) return;
    const timeout = window.setTimeout(async () => {
      await saveBoardLocal(board);
      await refreshBoardList();
      if (saveState === "dirty") setSaveState("local");
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [board, saveState, setSaveState]);

  useEffect(() => {
    const persistCurrentBoard = () => {
      const currentBoard = useBoardStore.getState().board;
      if (currentBoard) void saveBoardLocal(currentBoard);
    };
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persistCurrentBoard();
    };

    document.addEventListener("visibilitychange", persistWhenHidden);
    window.addEventListener("pagehide", persistCurrentBoard);

    return () => {
      document.removeEventListener("visibilitychange", persistWhenHidden);
      window.removeEventListener("pagehide", persistCurrentBoard);
    };
  }, []);

  async function openBoard(id: string) {
    const next = await loadBoardLocal(id);
    if (!next) return;
    setBoard(next);
    setShareToken(null);
    await rememberLastBoard(id);
    if (isAuthenticated) await refreshShares(id);
    void trackEvent({ type: "board_opened" });
  }

  // ── Duplicar board desde la biblioteca ────────────────────────────────────
  async function duplicateBoard(id: string) {
    const source = await loadBoardLocal(id);
    if (!source) return;
    const copy = {
      ...source,
      id: newId(),
      title: `Copia de ${source.title}`,
      updatedAt: new Date().toISOString()
    };
    await saveBoardLocal(copy);
    setBoard(copy);
    setShareToken(null);
    await refreshBoardList();
    setLibraryOpen(false);
  }

  // ── Crear board desde plantilla ────────────────────────────────────────────
  async function createFromTemplate(template: BoardTemplate) {
    const next = applyTemplate(template);
    await saveBoardLocal(next);
    setBoard(next);
    setShareToken(null);
    await refreshBoardList();
    setLibraryOpen(false);
    void trackEvent({ type: "template_used", templateId: template.id });
  }

  // ── Sala de clase ─────────────────────────────────────────────────────────
  async function activarSala() {
    if (salaCode) {
      // Sala ya activa → toggle panel
      setSalaOpen((open) => !open);
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/sala`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("No se pudo crear la sala");
      const data = (await res.json()) as { code: string };
      setSalaCode(data.code);
      setSalaOpen(true);
    } catch {
      alert("Para abrir una sala necesitas iniciar sesión con tu cuenta EDUmind.");
    }
  }

  async function cerrarSala() {
    if (!salaCode) return;
    await fetch(`${apiBaseUrl}/api/sala/${salaCode}`, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => {});
    setSalaCode(null);
    setSalaOpen(false);
  }

  // ── Grabación de sesión ───────────────────────────────────────────────────
  const RECORD_INTERVAL_MS = 5000;

  function startRecording() {
    const first = captureFnRef.current?.() ?? null;
    setRecordFrames(first ? [first] : []);
    setRecording(true);
    void trackEvent({ type: "session_start" }); // reutilizamos session_start como evento de grabación
    recordIntervalRef.current = setInterval(() => {
      const frame = captureFnRef.current?.() ?? null;
      if (frame) setRecordFrames((prev) => [...prev, frame]);
    }, RECORD_INTERVAL_MS);
  }

  function stopAndDownloadRecording() {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    setRecording(false);
    setRecordFrames((frames) => {
      if (frames.length > 0) downloadSlideshow(frames, board?.title ?? "Board");
      return [];
    });
  }

  function downloadSlideshow(frames: string[], title: string) {
    const framesJson = JSON.stringify(frames);
    const date = new Date().toLocaleDateString("es");
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>Grabación: ${title.replace(/</g, "&lt;")} · ${date}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#22302f;display:flex;flex-direction:column;height:100vh;font-family:system-ui,sans-serif;color:#fffaf0}
  .viewer{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px}
  img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
  .bar{height:72px;display:flex;align-items:center;justify-content:center;gap:12px;background:#1a2625;padding:0 20px;flex-shrink:0}
  button{background:#2a7a6d;border:none;color:#fff;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px}
  button:hover{background:#3a9a8d}
  .info{font-size:13px;opacity:.7;text-align:center}
</style>
</head>
<body>
<div class="viewer"><img id="f" alt="Frame" /></div>
<div class="bar">
  <button onclick="go(-1)">◀ Anterior</button>
  <div class="info"><span id="n">1</span> / <span id="t">0</span><br><small>${title.replace(/</g, "&lt;")} · ${date}</small></div>
  <button onclick="go(1)">Siguiente ▶</button>
  <button onclick="tp()" id="pb">▶ Play</button>
</div>
<script>
var ff=${framesJson},i=0,tm=null;
document.getElementById('t').textContent=ff.length;
function show(){document.getElementById('f').src=ff[i];document.getElementById('n').textContent=i+1;}
function go(d){i=(i+d+ff.length)%ff.length;show();}
function tp(){if(tm){clearInterval(tm);tm=null;document.getElementById('pb').textContent='▶ Play';}else{tm=setInterval(function(){go(1);},3000);document.getElementById('pb').textContent='⏹ Stop';}}
show();
</script>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grabacion-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Board Plugin Protocol (PostMessage) ───────────────────────────────────
  // Apps EDUmind embebidas en Hub pueden controlar elementos del board

  useEffect(() => {
    function handlePluginMessage(event: MessageEvent) {
      if (!isTrustedOrigin(event.origin)) return;
      const msg = event.data as PluginMessage;
      if (!msg?.type?.startsWith("board:")) return;

      const { board: currentBoard, updateElementData: upData, updateElement: upEl, addElement: addEl } =
        useBoardStore.getState();
      if (!currentBoard) return;

      switch (msg.type) {
        case "board:semaphore": {
          currentBoard.elements
            .filter((e) => e.type === "semaphore")
            .forEach((e) => upData(e.id, { state: msg.state }));
          break;
        }
        case "board:timer:start":
        case "board:timer:stop": {
          const running = msg.type === "board:timer:start";
          currentBoard.elements
            .filter((e) => e.type === "timer")
            .forEach((e) => upData(e.id, { running }));
          break;
        }
        case "board:timer:reset": {
          currentBoard.elements
            .filter((e): e is Extract<typeof e, { type: "timer" }> => e.type === "timer")
            .forEach((e) => upData(e.id, { seconds: e.data.initialSeconds, running: false }));
          break;
        }
        case "board:note:add": {
          addEl("note");
          // El texto se actualiza en el siguiente tick cuando el elemento existe
          setTimeout(() => {
            const newEl = useBoardStore.getState().board?.elements.at(-1);
            if (newEl?.type === "note") {
              upData(newEl.id, { text: msg.text, color: msg.color ?? "#fff9c4" });
            }
          }, 50);
          break;
        }
        case "board:auth:login": {
          const sourceWindow = event.source;
          const loginUrl = getLoginUrl();
          sourceWindow?.postMessage(
            { type: "board:auth", authenticated: isAuthenticated, loginUrl, user: authUser },
            { targetOrigin: event.origin }
          );
          if (!isAuthenticated) {
            window.location.href = loginUrl;
          }
          break;
        }
        case "board:ready": {
          const sourceWindow = event.source;
          if (!sourceWindow) break;
          const iframe = Array.from(document.querySelectorAll<HTMLIFrameElement>(".iframe-overlays iframe"))
            .find((frame) => frame.contentWindow === sourceWindow);
          if (!iframe) break;
          iframe.dataset.ready = "true";
          iframe.dataset.readyAt = new Date().toISOString();
          sourceWindow.postMessage(
            { type: "board:auth", authenticated: isAuthenticated, loginUrl: isAuthenticated ? null : getLoginUrl(), user: authUser },
            { targetOrigin: event.origin }
          );
          break;
        }
        case "board:state:request": {
          // Responder al iframe con el estado actual del board
          (event.source as WindowProxy)?.postMessage(
            { type: "board:state", board: currentBoard },
            { targetOrigin: event.origin }
          );
          break;
        }
        case "board:embed:metrics": {
          const sourceWindow = event.source;
          if (!sourceWindow) break;
          const iframe = Array.from(document.querySelectorAll<HTMLIFrameElement>(".iframe-overlays iframe"))
            .find((frame) => frame.contentWindow === sourceWindow);
          const elementId = iframe?.dataset.boardElementId;
          if (!elementId) break;
          const target = currentBoard.elements.find((element) => element.id === elementId && element.type === "hub");
          if (!target) break;

          const nextHeight = typeof msg.height === "number"
            ? Math.max(560, Math.min(1400, Math.round(msg.height)))
            : target.height;
          const nextWidth = typeof msg.width === "number"
            ? Math.max(920, Math.min(1800, Math.round(msg.width)))
            : target.width;

          if (Math.abs(nextHeight - target.height) > 24 || Math.abs(nextWidth - target.width) > 24) {
            upEl(target.id, { height: nextHeight, width: nextWidth });
          }
          break;
        }
      }
    }

    window.addEventListener("message", handlePluginMessage);
    return () => window.removeEventListener("message", handlePluginMessage);
  }, []);

  // ── Atajos de teclado ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // No actuar cuando el foco está en un input, textarea o select
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === "z") { e.preventDefault(); undo(); return; }
    if (ctrl && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); redo(); return; }
    if (ctrl && e.key === "d") { e.preventDefault(); duplicateSelected(); return; }

    if (e.key === "Delete" || e.key === "Backspace") { removeSelected(); return; }
    if (e.key === "Escape") {
      setPresentation(false);
      useBoardStore.getState().setSelectedId(null);
      return;
    }
    if (e.key === "f" || e.key === "F") { setPresentation(true); return; }

    // Añadir widgets con tecla (solo si no hay elemento seleccionado)
    if (!selectedId) {
      if (e.key === "n") { addElement("note"); return; }
      if (e.key === "t") { addElement("text"); return; }
    }

    // Bloquear/desbloquear elemento seleccionado
    if ((e.key === "l" || e.key === "L") && selectedId && board) {
      const el = board.elements.find((el) => el.id === selectedId);
      if (el) updateElement(el.id, { locked: !el.locked });
    }
  }, [board, selectedId, undo, redo, duplicateSelected, removeSelected, addElement, updateElement]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function createBoard() {
    const next = createEmptyBoard();
    next.title = `Board ${new Date().toLocaleDateString("es")}`;
    await saveBoardLocal(next);
    setBoard(next);
    setShareToken(null);
    await refreshBoardList();
    setLibraryOpen(false);
  }

  async function deleteBoard(id: string) {
    if (!confirm("¿Eliminar este board local? Esta acción no revoca enlaces ya publicados.")) return;
    await deleteBoardLocal(id);
    if (board?.id === id) {
      const fallback = await loadLastBoardLocal();
      const next = fallback ?? createEmptyBoard();
      await saveBoardLocal(next);
      setBoard(next);
      setShareToken(null);
    }
    await refreshBoardList();
  }

  function exportBoard() {
    if (!board) return;
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${board.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "edumind-board"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBoard(file: File) {
    try {
      const raw = await file.text();
      const parsed = boardDocumentSchema.parse(JSON.parse(raw));
      const imported = { ...parsed, updatedAt: new Date().toISOString() };
      await saveBoardLocal(imported);
      setBoard(imported);
      setShareToken(null);
      await refreshBoardList();
    } catch (error) {
      console.error(error);
      alert("No se pudo importar el board. Revisa que sea un JSON válido de EDUmind Board.");
    }
  }

  async function importAsset(file: File) {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      alert("Formato no soportado. Usa PDF, JPEG o PNG.");
      return;
    }

    const maxBytes = 1.5 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("Archivo demasiado grande. Usa archivos de hasta 1.5 MB.");
      return;
    }

    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    useBoardStore.getState().addElementObject(
      createFileElement({
        url,
        name: file.name,
        mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png"
      })
    );
  }

  async function onPublish() {
    if (!board) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      setSaveState("publishing");
      await saveBoardLocal(board);
      await publishBoard(board);
      await refreshShares(board.id);
      setSaveState("published");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }

  async function onShare() {
    if (!board) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      setSaveState("publishing");
      await publishBoard(board);
      const share = await createShare(board.id);
      setShareToken(share.token);
      await refreshShares(board.id);
      setSaveState("published");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }

  async function onRevokeShare(token: string) {
    if (!confirm("¿Revocar este enlace compartido?")) return;
    try {
      await revokeShare(token);
      if (shareToken === token) setShareToken(null);
      if (board) await refreshShares(board.id);
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }

  function setZoom(nextZoom: number) {
    if (!board) return;
    updateBoard({
      viewport: { ...board.viewport, zoom: Math.min(4, Math.max(0.15, nextZoom)) }
    });
  }

  function resetView() {
    updateBoard({ viewport: { x: 0, y: 0, zoom: 1 } });
  }

  if (!board) {
    return (
      <main className="empty-state">
        <h1>EDUmind Board</h1>
        <p>Preparando el espacio de trabajo…</p>
      </main>
    );
  }

  if (presentation) {
    return (
      <>
        <BoardCanvas readonly presentation liveControls />
        <button className="exit-presentation" type="button" onClick={() => setPresentation(false)}>
          <X size={20} />
          Salir
        </button>
      </>
    );
  }

  return (
    <div className={`app-shell theme-${board.theme}`}>
      <header className="topbar">
        <div className="brand">
          <strong>EDUmind Board</strong>
          <span>{statusText(saveState)}</span>
        </div>
        <button type="button" className="icon-only" title="Biblioteca" onClick={() => setLibraryOpen((open) => !open)}>
          <Library size={18} />
        </button>
        <input
          className="title-input"
          value={board.title}
          onChange={(event) => updateBoard({ title: event.target.value })}
          aria-label="Título del board"
        />
        <select value={board.theme} onChange={(event) => setTheme(event.target.value as typeof board.theme)}>
          <option value="edumind">EDUmind</option>
          <option value="eink">E-Ink · Papel</option>
          <option value="ocean">Ocean</option>
          <option value="forest">Forest</option>
        </select>
        <div className="zoom-controls" aria-label="Zoom">
          <button type="button" title="Deshacer (Ctrl+Z)" disabled={!canUndo}
            onClick={undo} className={canUndo ? "" : "disabled"}>
            ↩
          </button>
          <button type="button" title="Rehacer (Ctrl+Y)" disabled={!canRedo}
            onClick={redo} className={canRedo ? "" : "disabled"}>
            ↪
          </button>
          <button type="button" title="Alejar" onClick={() => setZoom(board.viewport.zoom - 0.1)}>
            <Minus size={16} />
          </button>
          <span>{Math.round(board.viewport.zoom * 100)}%</span>
          <button type="button" title="Acercar" onClick={() => setZoom(board.viewport.zoom + 0.1)}>
            <ZoomIn size={16} />
          </button>
          <button type="button" title="Recentrar vista" onClick={resetView}>
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Botón de auth: usuario logueado o enlace de login */}
        {authState.status !== "checking" && (
          isAuthenticated ? (
            <div className="auth-pill" title={authUser?.email}>
              <User size={14} />
              <span>{authUser?.username ?? authUser?.email}</span>
              <a className="auth-pill-logout" href={getLogoutUrl()} title="Cerrar sesión">
                <LogOut size={14} />
              </a>
            </div>
          ) : (
            <a className="auth-pill auth-pill-anon" href={getLoginUrl()} title="Iniciar sesión con EDUmind">
              <LogIn size={14} />
              <span>Entrar</span>
            </a>
          )
        )}

        <button
          type="button"
          onClick={onPublish}
          title={isAuthenticated ? "Publicar board" : "Inicia sesión para publicar"}
        >
          <Save size={18} />
          Publicar
        </button>
        {/* Botón de grabación de sesión */}
        <button
          type="button"
          className={`rec-btn-topbar ${recording ? "rec-btn-active" : ""}`}
          onClick={recording ? stopAndDownloadRecording : startRecording}
          title={recording ? `Detener grabación (${recordFrames.length} frames)` : "Grabar sesión"}
        >
          <Circle size={16} fill={recording ? "#d94b3d" : "transparent"} />
          {recording ? `${recordFrames.length}` : "Grabar"}
        </button>
        <button
          type="button"
          className={`sala-btn-topbar ${salaCode ? "sala-btn-active" : ""}`}
          onClick={activarSala}
          title={salaCode ? `Sala ${salaCode} activa` : "Abrir sala de clase"}
        >
          <Users size={18} />
          {salaCode ? salaCode : "Sala"}
        </button>
        <button
          type="button"
          className="primary"
          onClick={onShare}
          title={isAuthenticated ? "Compartir board" : "Inicia sesión para compartir"}
        >
          <Send size={18} />
          Compartir
        </button>
      </header>

      {/* Panel de sala activa */}
      {salaCode && salaOpen && (
        <SalaPanel
          code={salaCode}
          board={board}
          projectorToken={activeShares[0]?.token ?? shareToken}
          onClose={() => {
            if (confirm("¿Cerrar la sala? Los alumnos perderán la conexión.")) {
              cerrarSala();
            } else {
              setSalaOpen(false);
            }
          }}
        />
      )}

      {libraryOpen && (
        <BoardLibrary
          boards={boards}
          activeBoardId={board.id}
          onOpen={(id) => { openBoard(id); setLibraryOpen(false); }}
          onCreate={createBoard}
          onDuplicate={duplicateBoard}
          onDelete={deleteBoard}
          onExport={exportBoard}
          onImport={() => fileInputRef.current?.click()}
          onTemplate={createFromTemplate}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importBoard(file);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={assetInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importAsset(file);
          event.currentTarget.value = "";
        }}
      />

      <Toolbar
        onPresent={() => setPresentation(true)}
        onImportAsset={() => assetInputRef.current?.click()}
        onOpenResources={() => {
          setResourcePickerOpen((open) => !open);
          setLibraryOpen(false);
        }}
      />

      {resourcePickerOpen && (
        <ResourcePicker
          onClose={() => setResourcePickerOpen(false)}
          onAdd={(resource) => {
            const element = createIframePreset(resource.url, resource.title);
            addElementObject({
              ...element,
              width: resource.kind === "pdf" ? 720 : 860,
              height: resource.kind === "pdf" ? 640 : 560
            });
            setResourcePickerOpen(false);
            void trackEvent({ type: "widget_added", widgetType: "iframe" });
          }}
        />
      )}

      <ErrorBoundary fallback={<div className="widget-error">Error en el canvas. Recarga la página.</div>}>
        <BoardCanvas captureRef={captureFnRef} />
      </ErrorBoundary>

      <Inspector />
      <GlobalInkToolbar />

      {/* Banner de modo anónimo — solo cuando no está logueado */}
      {authState.status === "anonymous" && <AuthBanner />}

      {shareUrl && (
        <div className="share-toast">
          <span>{shareUrl}</span>
          <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>
            <Copy size={18} />
            Copiar
          </button>
        </div>
      )}

      {activeShares.length > 0 && (
        <div className="share-list">
          {activeShares.slice(0, 3).map((share) => (
            <div key={share.token}>
              <span>{`${window.location.origin}/share/${share.token}`}</span>
              <button type="button" title="Revocar enlace" onClick={() => onRevokeShare(share.token)}>
                <ShieldOff size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  const path = window.location.pathname;

  const proyectorMatch = path.match(/^\/proyector\/([^/]+)$/);
  if (proyectorMatch) return <ProjectorView token={proyectorMatch[1]} />;

  const aulaMatch = path.match(/^\/aula\/([^/]+)$/);
  if (aulaMatch) return <AulaView code={aulaMatch[1]} />;

  const shareMatch = path.match(/^\/share\/([^/]+)$/);
  if (shareMatch) return <ShareView token={shareMatch[1]} />;

  return <EditorApp />;
}
