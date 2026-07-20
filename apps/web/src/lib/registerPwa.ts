// Registro del service worker y política de actualización de la PWA.
//
// Problema que resuelve: sin comprobaciones activas, un service worker solo
// se revisa al navegar, así que la app cacheada podía quedarse "anclada" entre
// sesiones sin recibir versiones nuevas.
//
// Política:
// - Comprobación periódica (cada hora) + al volver a la pestaña o recuperar red.
// - Cuando hay versión nueva: aviso no intrusivo con botón "Actualizar".
// - Auto-aplicación al ocultar la pestaña: la siguiente sesión arranca fresca
//   sin interrumpir una clase en curso.
import { registerSW } from "virtual:pwa-register";
import { toast } from "../components/ui/feedback";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

// En una PDI siempre encendida la pestaña nunca se oculta ni se cierra, así que
// la vía "aplicar al ocultar" no dispara y la app puede quedar anclada a una
// versión vieja. Complemento: si hay una versión pendiente y el aula lleva un
// rato sin interacción (vacía / entre clases), se aplica sola. Umbral generoso
// para no recargar en una pausa breve dentro de una clase.
const IDLE_APPLY_MS = 8 * 60 * 1000;   // 8 min sin interacción
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // se comprueba cada minuto

export function setupPwaUpdates() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  let updatePending = false;

  const applyUpdate = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // Los SW solo se revisan al navegar por defecto: forzamos comprobaciones
      window.setInterval(() => {
        registration.update().catch(() => { /* offline: se reintenta luego */ });
      }, UPDATE_CHECK_INTERVAL_MS);

      // Comprobar también al recuperar el foco de la pestaña o la conexión
      const checkForUpdates = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", checkForUpdates);
      window.addEventListener("online", checkForUpdates);
    },
    onNeedRefresh() {
      updatePending = true;
      toast("Hay una versión nueva de EDUmind Board.", "info", {
        duration: null,
        action: {
          label: "Actualizar",
          onClick: () => { void applyUpdate(true); }
        }
      });
    },
    onRegisterError(error) {
      console.warn("No se pudo registrar el service worker", error);
    }
  });

  // Si el docente no pulsa "Actualizar", aplicamos la nueva versión cuando deja
  // la pestaña: al volver (o en la siguiente sesión) ya estará actualizada, sin
  // recargar en mitad de la clase.
  document.addEventListener("visibilitychange", () => {
    if (updatePending && document.visibilityState === "hidden") {
      updatePending = false;
      void applyUpdate(true);
    }
  });

  // Vía para PDI siempre encendida: aplicar por inactividad. Registramos la
  // última interacción y, si hay versión pendiente y el aula lleva IDLE_APPLY_MS
  // sin tocar nada (con la pestaña visible), recargamos con la versión nueva.
  let lastActivity = Date.now();
  const marcarActividad = () => { lastActivity = Date.now(); };
  for (const evento of ["pointerdown", "keydown", "touchstart", "wheel"]) {
    window.addEventListener(evento, marcarActividad, { passive: true });
  }
  window.setInterval(() => {
    if (!updatePending) return;
    if (document.visibilityState !== "visible") return; // la vía "oculta" ya lo cubre
    if (Date.now() - lastActivity < IDLE_APPLY_MS) return;
    updatePending = false;
    void applyUpdate(true);
  }, IDLE_CHECK_INTERVAL_MS);
}
