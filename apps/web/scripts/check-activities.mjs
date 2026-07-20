import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = await mkdtemp(path.join(tmpdir(), "edumind-activities-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function patchRelativeEsmImports(filePath) {
  const source = await readFile(filePath, "utf8");
  await writeFile(
    filePath,
    source
      .replaceAll('from "../lib/ids"', 'from "../lib/ids.js"')
      .replaceAll('from "../lib/templates"', 'from "../lib/templates.js"')
      .replaceAll('from "./ids"', 'from "./ids.js"')
  );
}

try {
  await symlink(path.join(rootDir, "node_modules"), path.join(outDir, "node_modules"), "dir");

  const sharedBuild = spawnSync("npm", ["--workspace", "@edumind-board/shared", "run", "build"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  assert(sharedBuild.status === 0, sharedBuild.stderr || sharedBuild.stdout || "shared no compila");

  const tsc = path.join(rootDir, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, [
    "apps/web/src/activities/catalog.ts",
    "apps/web/src/lib/templates.ts",
    "apps/web/src/lib/ids.ts",
    "--target", "ES2022",
    "--module", "ESNext",
    "--moduleResolution", "Bundler",
    "--outDir", outDir,
    "--rootDir", "apps/web/src",
    "--skipLibCheck",
    "--strict"
  ], { cwd: rootDir, encoding: "utf8" });

  assert(result.status === 0, result.stderr || result.stdout || "activities/catalog.ts no compila");

  await patchRelativeEsmImports(path.join(outDir, "activities", "catalog.js"));
  await patchRelativeEsmImports(path.join(outDir, "lib", "templates.js"));

  const activities = await import(pathToFileURL(path.join(outDir, "activities", "catalog.js")).href);
  const templates = await import(pathToFileURL(path.join(outDir, "lib", "templates.js")).href);
  const templateIds = new Set(templates.BOARD_TEMPLATES.map((template) => template.id));

  assert(activities.ACTIVITY_BLUEPRINTS.length >= 3, "debe existir un catalogo inicial de actividades");

  for (const blueprint of activities.ACTIVITY_BLUEPRINTS) {
    assert(templateIds.has(blueprint.boardTemplateId), `actividad sin plantilla valida: ${blueprint.id}`);
    assert(blueprint.steps.length > 0, `actividad sin pasos: ${blueprint.id}`);

    const activity = activities.createActivity(blueprint, { includeBoard: true });
    assert(activity.schemaVersion === 1, `schemaVersion incorrecto: ${blueprint.id}`);
    assert(activity.board?.elements?.length >= 0, `board no generado: ${blueprint.id}`);
    assert(activity.materials.every((material) => material.id), `material sin id: ${blueprint.id}`);
    assert(activity.steps.every((step) => step.id), `paso sin id: ${blueprint.id}`);
  }

  console.log("Activity checks OK");
} finally {
  await rm(outDir, { recursive: true, force: true });
}
