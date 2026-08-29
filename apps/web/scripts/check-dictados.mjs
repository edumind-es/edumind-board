// Verifica las conversiones del dictado numérico (letra, romano, ordinal, base10).
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = await mkdtemp(path.join(tmpdir(), "edumind-dictados-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const tsc = path.join(rootDir, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, [
    "apps/web/src/lib/dictados.ts",
    "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    "--outDir", outDir, "--rootDir", "apps/web/src", "--skipLibCheck", "--strict"
  ], { cwd: rootDir, encoding: "utf8" });
  assert(result.status === 0, result.stderr || result.stdout || "dictados.ts no compila");

  const d = await import(pathToFileURL(path.join(outDir, "lib", "dictados.js")).href);
  const { numeroEnLetra, numeroRomano, numeroOrdinal, descomposicionBase10, formasValidas, siguienteReto } = d;

  // Letra
  const letra = {
    0: "cero", 15: "quince", 21: "veintiuno", 24: "veinticuatro", 30: "treinta",
    31: "treinta y uno", 100: "cien", 101: "ciento uno", 234: "doscientos treinta y cuatro",
    1000: "mil", 2000: "dos mil", 21000: "veintiún mil", 1234: "mil doscientos treinta y cuatro"
  };
  for (const [n, esperado] of Object.entries(letra)) {
    const got = numeroEnLetra(Number(n));
    assert(got === esperado, `numeroEnLetra(${n}) = "${got}", esperado "${esperado}"`);
  }

  // Romano
  const romano = { 1: "I", 4: "IV", 9: "IX", 14: "XIV", 40: "XL", 90: "XC", 234: "CCXXXIV", 2024: "MMXXIV", 3999: "MMMCMXCIX" };
  for (const [n, esperado] of Object.entries(romano)) {
    assert(numeroRomano(Number(n)) === esperado, `numeroRomano(${n}) incorrecto`);
  }
  assert(numeroRomano(4000) === "—", "romano fuera de rango debe ser —");

  // Ordinal
  assert(numeroOrdinal(1) === "primero", "ordinal 1");
  assert(numeroOrdinal(10) === "décimo", "ordinal 10");
  assert(numeroOrdinal(20) === "vigésimo", "ordinal 20");
  assert(numeroOrdinal(21) === "21.º", "ordinal 21 debe usar notación");

  // Base 10
  const dec = descomposicionBase10(234);
  assert(dec.centenas === 2 && dec.decenas === 3 && dec.unidades === 4 && dec.millares === 0, "descomposición 234 incorrecta");

  // Formas válidas: romano solo 1..3999
  assert(!formasValidas(5000, ["romano", "cifra"]).includes("romano"), "romano no válido para 5000");
  assert(formasValidas(50, ["romano", "letra"]).length === 2, "50 admite romano y letra");

  // siguienteReto: número en rango y forma dentro de las habilitadas
  let seed = 0.5;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280 / 233280; return seed; };
  for (let i = 0; i < 50; i++) {
    const reto = siguienteReto(1, 100, ["cifra", "letra", "romano"], rnd);
    assert(reto.current >= 1 && reto.current <= 100, `reto fuera de rango: ${reto.current}`);
    assert(["cifra", "letra", "romano"].includes(reto.form), `forma inesperada: ${reto.form}`);
  }

  console.log("Dictados checks OK");
} finally {
  await rm(outDir, { recursive: true, force: true });
}
