// Los cinco niveles de voz de aula (más el silencio), de biblioteca a patio.
//
// La escala es la misma que usa el alumnado de viva voz: no hablamos de
// decibelios ni de porcentajes, hablamos de "voz baja" o "voz de patio".

export type NivelVoz = {
  nivel: number;
  nombre: string;
  ejemplo: string;
  color: string;
  /** Porcentaje de volumen a partir del cual empieza este nivel. */
  desde: number;
};

export const NIVELES_VOZ: NivelVoz[] = [
  { nivel: 0, nombre: "Silencio",   ejemplo: "Biblioteca",  color: "#2f9f72", desde: 0 },
  { nivel: 1, nombre: "Susurro",    ejemplo: "Al oído",     color: "#5aab55", desde: 10 },
  { nivel: 2, nombre: "Voz baja",   ejemplo: "En pareja",   color: "#93b23c", desde: 24 },
  { nivel: 3, nombre: "Voz normal", ejemplo: "En grupo",    color: "#e0a72e", desde: 40 },
  { nivel: 4, nombre: "Voz alta",   ejemplo: "A la clase",  color: "#e2792f", desde: 58 },
  { nivel: 5, nombre: "Patio",      ejemplo: "A gritos",    color: "#d94b3d", desde: 78 }
];

export const NIVEL_MAXIMO = 5;

/**
 * Nivel que corresponde a un volumen, con histéresis: para bajar de escalón
 * hace falta alejarse del borde, si no el indicador parpadea entre dos niveles
 * con cualquier respiración.
 */
export function nivelDesdeVolumen(pct: number, nivelPrevio = 0): number {
  let nivel = 0;
  for (const n of NIVELES_VOZ) if (pct >= n.desde) nivel = n.nivel;
  if (nivel < nivelPrevio && pct >= NIVELES_VOZ[nivelPrevio]!.desde - 4) return nivelPrevio;
  return nivel;
}
