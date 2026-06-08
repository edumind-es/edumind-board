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
  const { measureAngleFromVector, toLocalPoint } = geometry;

  assert(measureAngleFromVector(120, 0).angle === 0, "angulo horizontal incorrecto");
  assert(measureAngleFromVector(120, -120).angle === 45, "angulo 45 ascendente incorrecto");
  assert(measureAngleFromVector(0, -120).angle === 90, "angulo 90 ascendente incorrecto");
  assert(measureAngleFromVector(0, 120).angle === 90, "angulo 90 descendente incorrecto");
  assert(measureAngleFromVector(120, 120).angle === 45, "angulo 45 descendente incorrecto");

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
