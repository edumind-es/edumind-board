import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = await mkdtemp(path.join(tmpdir(), "edumind-geometry-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertClose(actual, expected, message) {
  assert(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

try {
  const tsc = path.join(rootDir, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, [
    "apps/web/src/lib/geometry.ts",
    "--target", "ES2022",
    "--module", "NodeNext",
    "--moduleResolution", "NodeNext",
    "--outDir", outDir,
    "--rootDir", "apps/web/src",
    "--skipLibCheck",
    "--strict"
  ], { cwd: rootDir, encoding: "utf8" });

  assert(result.status === 0, result.stderr || result.stdout || "geometry.ts no compila");

  const geometry = await import(pathToFileURL(path.join(outDir, "lib", "geometry.js")).href);
  const { measureAngleFromVector, toLocalPoint, clampSides, ellipsePolygonPoints, angleVectorFromDegrees } = geometry;

  assert(measureAngleFromVector(120, 0).angle === 0, "angulo horizontal incorrecto");
  assert(measureAngleFromVector(120, -120).angle === 45, "angulo 45 ascendente incorrecto");
  assert(measureAngleFromVector(0, -120).angle === 90, "angulo 90 ascendente incorrecto");
  assert(measureAngleFromVector(0, 120).angle === 90, "angulo 90 descendente incorrecto");
  assert(measureAngleFromVector(120, 120).angle === 45, "angulo 45 descendente incorrecto");

  // clampSides: rango y redondeo
  assert(clampSides(2) === 3, "clampSides no aplica el minimo");
  assert(clampSides(99) === 24, "clampSides no aplica el maximo");
  assert(clampSides(5.4, 3, 12) === 5, "clampSides no redondea");

  // ellipsePolygonPoints: nº de vértices y primer vértice arriba (a las 12)
  const tri = ellipsePolygonPoints(0, 0, 10, 10, 3, -90);
  assert(tri.length === 6, "el triangulo debe tener 3 vertices (6 coords)");
  assertClose(tri[0], 0, "primer vertice x debe estar centrado");
  assertClose(tri[1], -10, "primer vertice y debe estar arriba");
  assert(ellipsePolygonPoints(0, 0, 5, 5, 8, -90).length === 16, "octogono debe tener 8 vertices");

  // angleVectorFromDegrees inverso de measureAngleFromVector
  for (const deg of [0, 30, 45, 90, 135, 180]) {
    const { w, h } = angleVectorFromDegrees(deg, 150);
    assert(measureAngleFromVector(w, h).angle === deg, `angleVectorFromDegrees no es inverso en ${deg}°`);
  }

  const plain = toLocalPoint({ x: 15, y: 25 }, { x: 10, y: 20, rotation: 0 });
  assertClose(plain.x, 5, "coordenada local x sin rotacion");
  assertClose(plain.y, 5, "coordenada local y sin rotacion");

  const rotated = toLocalPoint({ x: 0, y: 10 }, { x: 0, y: 0, rotation: 90 });
  assertClose(rotated.x, 10, "coordenada local x con rotacion 90");
  assertClose(rotated.y, 0, "coordenada local y con rotacion 90");

  console.log("Geometry checks OK");
} finally {
  await rm(outDir, { recursive: true, force: true });
}
