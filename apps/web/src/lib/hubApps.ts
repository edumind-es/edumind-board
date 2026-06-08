// Definición de las apps EDUmind integrables como widget hub.
// Añadir aquí cuando una nueva app del ecosistema soporte el Board Plugin Protocol.

export type HubApp = {
  id: string;
  name: string;
  emoji: string;
  url: string;
  // URL para acceso anónimo (sin cuenta EDUmind). Si no existe, se usa url.
  // Las apps que soporten acceso guest deben exponer este endpoint.
  guestUrl?: string;
  color: string;
  bgColor: string;
  description: string;
  // Si true, la app soporta el Board Plugin Protocol (postMessage bidireccional)
  pluginSupport: boolean;
};

export const HUB_APPS: HubApp[] = [
  {
    id: "motion",
    name: "Motion",
    emoji: "🎬",
    url: "https://motion.edumind.es/",
    guestUrl: "https://motion.edumind.es/?guest=1",
    color: "#2a7a6d",
    bgColor: "#d4edda",
    description: "Stop motion educativo: captura, onion skin y exportación",
    pluginSupport: true
  },
  {
    id: "pasos",
    name: "Pasos",
    emoji: "📋",
    url: "https://pasos.edumind.es/",
    guestUrl: "https://pasos.edumind.es/?guest=1",
    color: "#3a7fc1",
    bgColor: "#cce5ff",
    description: "Gestión visual de proyectos, tareas y evidencias de aula",
    pluginSupport: true
  },
  {
    id: "quiz",
    name: "Quiz",
    emoji: "❓",
    url: "https://quiz.edumind.es/",
    guestUrl: "https://quiz.edumind.es/?guest=1",
    color: "#c45d3e",
    bgColor: "#ffd6cc",
    description: "Preguntas interactivas en tiempo real",
    pluginSupport: true
  },
  {
    id: "robotics",
    name: "Robótica",
    emoji: "🤖",
    url: "https://robotics.edumind.es/",
    guestUrl: "https://robotics.edumind.es/?guest=1",
    color: "#7c3aed",
    bgColor: "#f3e5f5",
    description: "Retos y programación con robots",
    pluginSupport: true
  },
  {
    id: "miapp",
    name: "miapp",
    emoji: "📱",
    url: "https://miapp.edumind.es/",
    color: "#059669",
    bgColor: "#d4edda",
    description: "App principal EDUmind — alumnos y docente",
    pluginSupport: false
  },
  {
    id: "breath",
    name: "Breath",
    emoji: "🌬️",
    url: "https://breath.edumind.es/",
    guestUrl: "https://breath.edumind.es/?guest=1",
    color: "#6366f1",
    bgColor: "#ede9fe",
    description: "Respiración guiada y mindfulness",
    pluginSupport: false
  }
];

export function getHubApp(id: string): HubApp | undefined {
  return HUB_APPS.find((a) => a.id === id);
}

// ── Board Plugin Protocol ────────────────────────────────────────────────────
// Mensajes que las apps EDUmind pueden enviar al board via window.parent.postMessage()

export type PluginMessage =
  | { type: "board:semaphore"; state: "red" | "yellow" | "green" }
  | { type: "board:timer:start" }
  | { type: "board:timer:stop" }
  | { type: "board:timer:reset" }
  | { type: "board:auth:login"; next?: string }
  | { type: "board:note:add"; text: string; color?: string }
  | { type: "board:embed:metrics"; appId: string; height?: number; width?: number }
  | { type: "board:ready"; appId: string; status?: string; boardId?: string | null }
  | { type: "board:state:request" };

// Respuestas que el board envía a la app embebida
export type BoardResponse =
  | { type: "board:state"; board: unknown }
  | { type: "board:auth"; authenticated: boolean; loginUrl: string | null; user: unknown | null }
  | { type: "board:ack"; action: string };

// Orígenes de confianza para el Board Plugin Protocol.
// Usa URL parsing para evitar falsos positivos con subdominios malformados.
export function isTrustedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    // Localhost en desarrollo (cualquier protocolo)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    // Solo HTTPS en producción — jamás HTTP para *.edumind.es
    if (url.protocol !== "https:") return false;
    // Dominio raíz o subdominio exacto de edumind.es
    return url.hostname === "edumind.es" || url.hostname.endsWith(".edumind.es");
  } catch {
    return false;
  }
}
