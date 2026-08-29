// Verifica los invariantes del motor de manipulativos 3D (space3d.ts):
// conservación de valor en canjes, reversibilidad, límites del suelo y Euler.
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = await mkdtemp(path.join(tmpdir(), "edumind-space3d-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function idFactory() {
  let count = 0;
  return () => `00000000-0000-4000-8000-${String(count += 1).padStart(12, "0")}`;
}

try {
  const tsc = path.join(rootDir, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, [
    "apps/web/src/manipulatives/space3d.ts",
    "--target", "ES2022",
    "--module", "NodeNext",
    "--moduleResolution", "NodeNext",
    "--outDir", outDir,
    "--rootDir", "apps/web/src",
    "--skipLibCheck",
    "--strict"
  ], { cwd: rootDir, encoding: "utf8" });

  assert(result.status === 0, result.stderr || result.stdout || "space3d.ts no compila");

  // El módulo importa tipos de @edumind-board/shared (solo tipos, sin runtime),
  // pero NodeNext exige que el import se resuelva: creamos un stub vacío.
  const stubDir = path.join(outDir, "node_modules", "@edumind-board", "shared");
  await mkdir(stubDir, { recursive: true });
  await writeFile(path.join(stubDir, "package.json"), JSON.stringify({ name: "@edumind-board/shared", main: "index.js" }));
  await writeFile(path.join(stubDir, "index.js"), "export {};\n");

  const space3d = await import(pathToFileURL(path.join(outDir, "manipulatives", "space3d.js")).href);
  const {
    PIECE_DIMENSIONS,
    PIECE_VALUES,
    solidFacts,
    addPiece,
    arrangePieces,
    countByKind,
    exchangeUp,
    piecesValue,
    satisfiesEuler,
    snapToGrid,
    splitDown,
    FLOOR_HALF_EXTENT
  } = space3d;

  // Valores posicionales
  assert(PIECE_VALUES.unit === 1 && PIECE_VALUES.rod === 10 && PIECE_VALUES.flat === 100 && PIECE_VALUES.cube === 1000,
    "Valores posicionales incorrectos");

  // Proporciones matemáticas reales de las piezas
  assert(PIECE_DIMENSIONS.unit.join() === "1,1,1", "La unidad debe ser 1x1x1");
  assert(PIECE_DIMENSIONS.rod.join() === "10,1,1", "La decena debe ser 10x1x1");
  assert(PIECE_DIMENSIONS.flat.join() === "10,1,10", "La centena debe ser 10x1x10");
  assert(PIECE_DIMENSIONS.cube.join() === "10,10,10", "El millar debe ser 10x10x10");

  // Volumen coherente con el valor (volumen en unidades cúbicas = valor)
  for (const kind of ["unit", "rod", "flat", "cube"]) {
    const [w, h, d] = PIECE_DIMENSIONS[kind];
    assert(w * h * d === PIECE_VALUES[kind], `El volumen de ${kind} no coincide con su valor`);
  }

  // Añadir piezas y contar
  const makeId = idFactory();
  let pieces = [];
  for (let i = 0; i < 12; i++) pieces = addPiece(pieces, "unit", makeId);
  for (let i = 0; i < 3; i++) pieces = addPiece(pieces, "rod", makeId);
  assert(piecesValue(pieces) === 42, `Valor esperado 42, obtenido ${piecesValue(pieces)}`);
  assert(countByKind(pieces).unit === 12 && countByKind(pieces).rod === 3, "Conteo por familias incorrecto");

  // Canje 10U -> 1D conserva el valor
  const exchanged = exchangeUp(pieces, "unit", makeId);
  assert(piecesValue(exchanged) === 42, "El canje 10U->1D no conserva el valor");
  assert(countByKind(exchanged).unit === 2 && countByKind(exchanged).rod === 4, "Canje 10U->1D con conteos incorrectos");

  // Canje sin piezas suficientes no hace nada
  const unchanged = exchangeUp(exchanged, "unit", makeId);
  assert(unchanged === exchanged || piecesValue(unchanged) === 42, "Canje imposible debe ser no-op");

  // Descomposición 1D -> 10U conserva y es reversible en valor
  const split = splitDown(exchanged, "rod", makeId);
  assert(piecesValue(split) === 42, "La descomposición no conserva el valor");
  assert(countByKind(split).unit === 12 && countByKind(split).rod === 3, "Descomposición con conteos incorrectos");

  // Ordenar no cambia el valor ni saca piezas del suelo
  const arranged = arrangePieces(split);
  assert(piecesValue(arranged) === 42, "Ordenar no debe cambiar el valor");
  for (const piece of arranged) {
    assert(Math.abs(piece.x) <= FLOOR_HALF_EXTENT && Math.abs(piece.z) <= FLOOR_HALF_EXTENT,
      "Ordenar dejó piezas fuera del suelo");
  }

  // Snap a rejilla
  assert(snapToGrid(1.26) === 1.5 && snapToGrid(-0.24) === -0, "snapToGrid incorrecto");

  // Euler en todos los sólidos, incluyendo prisma/pirámide para cada nº de lados
  for (const kind of ["cube", "cylinder", "cone", "sphere"]) {
    assert(satisfiesEuler(solidFacts(kind)), `El sólido ${kind} no cumple Euler`);
  }
  for (let n = 3; n <= 12; n += 1) {
    const pyramid = solidFacts("pyramid", n);
    assert(pyramid.faces === n + 1 && pyramid.edges === 2 * n && pyramid.vertices === n + 1,
      `Caras/aristas/vértices incorrectos en pirámide de ${n} lados`);
    assert(satisfiesEuler(pyramid), `La pirámide de ${n} lados no cumple Euler`);
    const prism = solidFacts("prism", n);
    assert(prism.faces === n + 2 && prism.edges === 3 * n && prism.vertices === 2 * n,
      `Caras/aristas/vértices incorrectos en prisma de ${n} lados`);
    assert(satisfiesEuler(prism), `El prisma de ${n} lados no cumple Euler`);
  }
  // Un cubo es un prisma cuadrangular: mismos números
  const squarePrism = solidFacts("prism", 4);
  assert(squarePrism.faces === 6 && squarePrism.edges === 12 && squarePrism.vertices === 8,
    "El prisma cuadrangular debería coincidir con el cubo");

  console.log("Space3D checks OK");
} finally {
  await rm(outDir, { recursive: true, force: true });
}
