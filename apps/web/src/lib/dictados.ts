// Motor puro de los dictados: conversiones de números a sus representaciones.
// Sin dependencias de React/DOM — verificable con check:dictados.

export type NumeroForma = "cifra" | "letra" | "romano" | "ordinal" | "base10";

const UNIDADES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menor100(n: number): string {
  if (n < 30) return UNIDADES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function menor1000(n: number): string {
  if (n === 100) return "cien";
  if (n < 100) return menor100(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  return `${CENTENAS[c]}${r ? ` ${menor100(r)}` : ""}`;
}

// Apócope de "uno" antes de "mil": veintiuno→veintiún, treinta y uno→treinta y un
function apocope(text: string): string {
  return text.replace(/veintiuno$/, "veintiún").replace(/\buno$/, "un");
}

/** Número en letra (español), 0–999 999. */
export function numeroEnLetra(n: number): string {
  if (n === 0) return "cero";
  if (n < 0) return `menos ${numeroEnLetra(-n)}`;
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${apocope(menor1000(miles))} mil`);
  if (resto > 0) partes.push(menor1000(resto));
  return partes.join(" ").trim();
}

const ROMANOS: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
];

/** Número romano (1–3999). Fuera de rango devuelve "—". */
export function numeroRomano(n: number): string {
  if (n < 1 || n > 3999) return "—";
  let value = n;
  let out = "";
  for (const [amount, symbol] of ROMANOS) {
    while (value >= amount) { out += symbol; value -= amount; }
  }
  return out;
}

const ORDINALES = [
  "", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo",
  "octavo", "noveno", "décimo", "undécimo", "duodécimo", "decimotercero",
  "decimocuarto", "decimoquinto", "decimosexto", "decimoséptimo", "decimoctavo",
  "decimonoveno", "vigésimo"
];

/** Ordinal en palabra (1–20); fuera de rango, notación "N.º". */
export function numeroOrdinal(n: number): string {
  if (n >= 1 && n <= 20) return ORDINALES[n];
  return `${n}.º`;
}

/** Descomposición posicional para la representación en base 10. */
export function descomposicionBase10(n: number) {
  return {
    millares: Math.floor(n / 1000),
    centenas: Math.floor((n % 1000) / 100),
    decenas: Math.floor((n % 100) / 10),
    unidades: n % 10
  };
}

/** Etiqueta legible de cada forma. */
export const FORMA_ETIQUETA: Record<NumeroForma, string> = {
  cifra: "en cifra",
  letra: "en letra",
  romano: "en números romanos",
  ordinal: "ordinal",
  base10: "en base 10"
};

/** Representación textual (para cifra/letra/romano/ordinal; base10 se dibuja). */
export function representar(n: number, forma: NumeroForma): string {
  switch (forma) {
    case "cifra": return String(n);
    case "letra": return numeroEnLetra(n);
    case "romano": return numeroRomano(n);
    case "ordinal": return numeroOrdinal(n);
    case "base10": return String(n);
  }
}

/** Formas válidas para un número dado (romano solo 1–3999, etc.). */
export function formasValidas(n: number, formas: NumeroForma[]): NumeroForma[] {
  return formas.filter((forma) => {
    if (forma === "romano") return n >= 1 && n <= 3999;
    if (forma === "base10") return n >= 0 && n <= 9999;
    return true;
  });
}

/** Genera el siguiente reto: número aleatorio en [min,max] y forma compatible. */
export function siguienteReto(
  min: number, max: number, formas: NumeroForma[], random = Math.random
): { current: number; form: NumeroForma } {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const n = lo + Math.floor(random() * (hi - lo + 1));
  const posibles = formasValidas(n, formas);
  const pool = posibles.length > 0 ? posibles : (["cifra"] as NumeroForma[]);
  const form = pool[Math.floor(random() * pool.length)];
  return { current: n, form };
}
