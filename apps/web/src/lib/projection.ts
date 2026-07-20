// Modo proyección "noche".
//
// Voltea toda la app a la variante nocturna del Sistema Lámina
// ([data-lm-theme="noche"]): papel/tinta invertidos en cálido, para proyectar
// en un aula a oscuras sin deslumbrar. Como el shell consume los tokens --lm-*,
// basta con poner el atributo en <html> y toda la interfaz conmuta de golpe.
//
// Es una preferencia del DISPOSITIVO/pantalla (una PDI concreta), no del board,
// así que se guarda en localStorage y NO viaja en el documento del tablero.
const KEY = "edumind-board.projection-noche";

export function isNocheEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function applyNoche(enabled: boolean): void {
  const el = document.documentElement;
  if (enabled) {
    el.setAttribute("data-lm-theme", "noche");
  } else {
    el.removeAttribute("data-lm-theme");
  }
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    /* almacenamiento no disponible: el modo aplica solo en esta sesión */
  }
}

// Aplica la preferencia guardada en el arranque, antes del primer render,
// para que no haya un parpadeo claro→oscuro al cargar en modo noche.
export function initProjectionTheme(): void {
  if (isNocheEnabled()) {
    document.documentElement.setAttribute("data-lm-theme", "noche");
  }
}
