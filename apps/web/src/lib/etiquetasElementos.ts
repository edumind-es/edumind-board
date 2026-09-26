// Nombres en pantalla de los tipos de elemento del tablero y una descripción
// corta de cada elemento. Los usan el Inspector y la lista accesible del
// lienzo (los elementos viven en un <canvas> y el lector de pantalla no los
// ve; esta descripción es su alternativa textual).
import type { BoardElement } from "@edumind-board/shared";

export const etiquetaTipo: Record<BoardElement["type"], string> = {
  note: "Nota", text: "Texto", image: "Imagen", file: "Archivo",
  iframe: "Web", musica: "Música", timer: "Temporizador", semaphore: "Semáforo",
  clock: "Reloj", dice: "Dado", spinner: "Ruleta",
  guidelines: "Pauta escritura", math: "Matemáticas", base10: "Base 10", mates3d: "Mates 3D", mindmap: "Mapa mental", dictadoNum: "Dictado numérico",
  fraction: "Fracciones", algorithm: "Algoritmo", logic: "Lógica matemática",
  grid: "Cuadrícula", table: "Tabla",
  comment: "Comentario",
  connector: "Conector",
  flow: "Diagrama de flujo",
  pictos: "Pictogramas ARASAAC",
  drawing: "Lienzo libre", noise: "Ruido", qr: "Código QR", hub: "App EDUmind"
};

const MAX_VISTA_PREVIA = 60;

/** «Nota: Recordad traer el chándal» — tipo más un fragmento de su contenido, si lo tiene. */
export function describirElemento(el: BoardElement): string {
  const tipo = etiquetaTipo[el.type] ?? el.type;
  const data = el.data as Record<string, unknown>;
  const texto = [data.text, data.title, data.name, data.alt, data.label, data.appId]
    .find((valor): valor is string => typeof valor === "string" && valor.trim().length > 0);
  if (!texto) return tipo;
  const limpio = texto.replace(/\s+/g, " ").trim();
  const recortado = limpio.length > MAX_VISTA_PREVIA ? `${limpio.slice(0, MAX_VISTA_PREVIA)}…` : limpio;
  return `${tipo}: ${recortado}`;
}
