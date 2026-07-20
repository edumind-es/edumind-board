import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = await mkdtemp(path.join(tmpdir(), "edumind-base10-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertClose(actual, expected, message) {
  assert(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

function idFactory() {
  let count = 0;
  return () => `00000000-0000-4000-8000-${String(count += 1).padStart(12, "0")}`;
}

try {
  const tsc = path.join(rootDir, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, [
    "apps/web/src/manipulatives/base10.ts",
    "--target", "ES2022",
    "--module", "NodeNext",
    "--moduleResolution", "NodeNext",
    "--outDir", outDir,
    "--rootDir", "apps/web/src",
    "--skipLibCheck",
    "--strict"
  ], { cwd: rootDir, encoding: "utf8" });

  assert(result.status === 0, result.stderr || result.stdout || "base10.ts no compila");

  const base10 = await import(pathToFileURL(path.join(outDir, "manipulatives", "base10.js")).href);
  const {
    baseTenPieceMetrics,
    baseTenPiecesValue,
    createBaseTenPieces,
    exchangeTenNearbyPieces,
    normalizeBaseTenCounts,
    splitOneBaseTenPiece
  } = base10;

  const unit = 14;
  assertClose(baseTenPieceMetrics("unit", unit).width * 10, baseTenPieceMetrics("rod", unit).width, "10 unidades equivalen a 1 decena en anchura");
  assertClose(baseTenPieceMetrics("rod", unit).width, baseTenPieceMetrics("flat", unit).width, "1 decena ocupa la anchura de 1 centena");
  assertClose(baseTenPieceMetrics("rod", unit).height * 10, baseTenPieceMetrics("flat", unit).height, "10 decenas equivalen a 1 centena en altura");

  const ids = idFactory();
  const tenUnits = createBaseTenPieces({
    unitCount: 10,
    rodCount: 0,
    flatCount: 0,
    cubeCount: 0,
    mode: "free",
    pieces: [],
    style: "3d",
    showValue: true,
    showPlaceLabels: true
  }, 640, unit, 80, ids);
  assert(baseTenPiecesValue(tenUnits) === 10, "10 unidades deben valer 10");

  const exchanged = exchangeTenNearbyPieces(tenUnits, "unit", unit, ids);
  assert(exchanged.length === 1, "10 unidades cercanas deben convertirse en 1 pieza");
  assert(exchanged[0].kind === "rod", "10 unidades deben canjear a 1 decena");
  assert(baseTenPiecesValue(exchanged) === 10, "el canje 10U -> 1D conserva el valor");

  const split = splitOneBaseTenPiece(exchanged, "rod", unit, ids);
  assert(split.length === 10, "1 decena debe descomponerse en 10 unidades");
  assert(split.every((piece) => piece.kind === "unit"), "1D -> 10U solo genera unidades");
  assert(baseTenPiecesValue(split) === 10, "la descomposicion conserva el valor");

  const normalized = normalizeBaseTenCounts([
    ...split,
    { id: ids(), kind: "rod", x: 0, y: 0 },
    { id: ids(), kind: "flat", x: 0, y: 0 }
  ]);
  assert(normalized.unitCount === 0, "normalizar agrupa 10 unidades");
  assert(normalized.rodCount === 2, "normalizar conserva decenas existentes");
  assert(normalized.flatCount === 1, "normalizar conserva centenas existentes");

  console.log("Base 10 checks OK");
} finally {
  await rm(outDir, { recursive: true, force: true });
}
