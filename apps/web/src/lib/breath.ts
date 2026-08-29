// Breath EDUmind dentro del tablero.
//
// Hasta ahora Breath solo llegaba al tablero como iframe con `embed=1`, y en
// ese modo la app esconde sus controles: quedaba la respiración cuadrada de
// cuatro segundos y nada más. Una herramienta que sirve para regular a un grupo
// (o a un alumno concreto) perdía casi todo su valor.
//
// Aquí viven las estrategias predefinidas y el contrato de parámetros de URL
// que Breath entiende. Es un contrato: si cambia, cambia en las dos apps.
//   embed=1     modo compacto (sin cabecera ni columna lateral)
//   panel=1     mostrar los controles aun estando empotrado
//   patron=ID   patrón con respaldo: resonancia | caja | cuatro-siete-ocho |
//               suspiro. Manda sobre lados/segundos: son ciclos asimétricos.
//   lados=N     lados del polígono (3..8) = fases del ciclo
//   segundos=S  duración de cada fase (1..10)
//   preset=P    calm | focus | recover (ajusta también los apoyos sensoriales)
//   rondas=N    la sesión se detiene sola al completarlas
//   auto=1      empezar en marcha
export const BREATH_BASE_URL = "https://breath.edumind.es/";

export type EstrategiaBreath = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Cuándo la usaría un docente: es lo que de verdad hace falta saber. */
  cuando: string;
} & (
  /**
   * Un patrón con respaldo en la literatura, de los que Breath trae de serie
   * (`patrones.ts`). Son ciclos asimétricos —4-7-8, suspiro fisiológico— que
   * NO caben en un polígono de fases iguales, así que se piden por id.
   */
  | { patron: string }
  /** Una figura regular: tantos lados como fases, todas de la misma duración. */
  | { lados: number; segundos: number; preset?: "calm" | "focus" | "recover" }
);

export const ESTRATEGIAS_BREATH: EstrategiaBreath[] = [
  {
    id: "resonancia",
    nombre: "Resonancia",
    descripcion: "Inspirar y soltar, 5,5 s cada uno: unas 5,5 respiraciones por minuto.",
    cuando: "La más respaldada para bajar activación. Vuelta a la calma de cualquier edad.",
    patron: "resonancia"
  },
  {
    id: "caja",
    nombre: "Cuadrada 4-4-4-4",
    descripcion: "Cuatro tiempos iguales con retención. El clásico de foco y autocontrol.",
    cuando: "Antes de una tarea que exige concentrarse: examen, lectura, dictado.",
    patron: "caja"
  },
  {
    id: "cuatro-siete-ocho",
    nombre: "4-7-8",
    descripcion: "Exhalación mucho más larga que la inspiración.",
    cuando: "Cierre de jornada y regulación individual. Pide algo de práctica.",
    patron: "cuatro-siete-ocho"
  },
  {
    id: "suspiro",
    nombre: "Suspiro fisiológico",
    descripcion: "Doble inspiración y exhalación larga (Balban et al., 2023).",
    cuando: "Bajada rápida tras un disgusto o un conflicto. Dos o tres ciclos bastan.",
    patron: "suspiro"
  },
  {
    id: "triangular",
    nombre: "Triangular 3,5 s",
    descripcion: "Tres fases cortas, con pictogramas. La figura más fácil de seguir.",
    cuando: "Infantil y primeros cursos, o si el grupo va muy acelerado.",
    lados: 3,
    segundos: 3.5,
    preset: "calm"
  },
  {
    id: "recuperar",
    nombre: "Recuperar el pulso",
    descripcion: "Seis fases rápidas con vibración: acompaña la bajada tras esfuerzo.",
    cuando: "Después de correr o de un juego intenso, en Educación Física.",
    lados: 6,
    segundos: 2.5,
    preset: "recover"
  }
];

/** ¿Esta estrategia es un patrón de Breath o una figura regular? */
export function esPatron(
  estrategia: EstrategiaBreath
): estrategia is EstrategiaBreath & { patron: string } {
  return "patron" in estrategia;
}

export function getEstrategiaBreath(id: string) {
  return ESTRATEGIAS_BREATH.find((estrategia) => estrategia.id === id);
}

export type ModoBreath =
  /** Estrategia fija, sin controles: el grupo sigue la figura y ya está. */
  | "guiada"
  /** Estrategia de partida, pero con los controles a mano para ajustar en vivo. */
  | "ajustable"
  /** La app entera, tal cual, con todos sus apoyos y su reto. */
  | "completa";

/**
 * URL de Breath para una estrategia y un modo.
 *
 * `rondas` hace que la sesión se detenga sola al completarlas: en una
 * transición de aula eso vale más que dejarla corriendo indefinidamente.
 */
export function urlBreath(
  estrategia: EstrategiaBreath | null,
  modo: ModoBreath,
  autoplay = false,
  rondas?: number
): string {
  const url = new URL(BREATH_BASE_URL);
  if (modo !== "completa") {
    url.searchParams.set("embed", "1");
    if (modo === "ajustable") url.searchParams.set("panel", "1");
  }
  if (estrategia) {
    if (esPatron(estrategia)) {
      url.searchParams.set("patron", estrategia.patron);
    } else {
      url.searchParams.set("lados", String(estrategia.lados));
      url.searchParams.set("segundos", String(estrategia.segundos));
      if (estrategia.preset) url.searchParams.set("preset", estrategia.preset);
    }
  }
  if (rondas && rondas > 0) url.searchParams.set("rondas", String(rondas));
  if (autoplay) url.searchParams.set("auto", "1");
  return url.toString();
}

/** ¿Este iframe del tablero es Breath? (para ofrecer cambiar de estrategia). */
export function esIframeBreath(url: string): boolean {
  try {
    return new URL(url).hostname === "breath.edumind.es";
  } catch {
    return false;
  }
}

const TITULOS: Record<ModoBreath, string> = {
  guiada: "Respiración",
  ajustable: "Respiración (ajustable)",
  completa: "Breath EDUmind"
};

export function tituloBreath(estrategia: EstrategiaBreath | null, modo: ModoBreath): string {
  if (modo === "completa" || !estrategia) return TITULOS[modo];
  return `${TITULOS[modo]} · ${estrategia.nombre}`;
}
