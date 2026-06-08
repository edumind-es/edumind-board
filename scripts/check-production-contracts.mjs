import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sharedDist = resolve("packages/shared/dist/schemas.js");
assert(
  existsSync(sharedDist),
  "Shared package is not built. Run: npm --workspace @edumind-board/shared run build"
);

const { boardDocumentSchema, isAllowedEmbedUrl } = await import(pathToFileURL(sharedDist).href);

const now = new Date().toISOString();
const sampleBoard = {
  schemaVersion: 1,
  id: randomUUID(),
  title: "Contrato premium EDUmind Board",
  theme: "edumind",
  viewport: { x: 0, y: 0, zoom: 1 },
  updatedAt: now,
  elements: [
    {
      id: randomUUID(),
      type: "comment",
      x: 100,
      y: 100,
      width: 300,
      height: 170,
      rotation: 0,
      zIndex: 1,
      opacity: 1,
      locked: false,
      data: {
        text: "Acuerdo asincrono del equipo",
        author: "Equipo A",
        status: "open",
        color: "#fff3c4",
        createdAt: now
      }
    },
    {
      id: randomUUID(),
      type: "connector",
      x: 440,
      y: 130,
      width: 300,
      height: 100,
      rotation: 0,
      zIndex: 2,
      opacity: 1,
      locked: false,
      data: {
        label: "siguiente",
        color: "#1a5fa8",
        strokeWidth: 4,
        style: "straight",
        arrowStart: false,
        arrowEnd: true
      }
    },
    {
      id: randomUUID(),
      type: "flow",
      x: 780,
      y: 100,
      width: 260,
      height: 130,
      rotation: 0,
      zIndex: 3,
      opacity: 1,
      locked: false,
      data: {
        text: "Decision",
        shape: "decision",
        fill: "#ffffff",
        stroke: "#2a7a6d",
        textColor: "#22302f",
        fontSize: 22
      }
    },
    {
      id: randomUUID(),
      type: "algorithm",
      x: 100,
      y: 320,
      width: 460,
      height: 320,
      rotation: 0,
      zIndex: 4,
      opacity: 1,
      locked: false,
      data: {
        operation: "divide",
        operandA: "123",
        operandB: "10",
        result: "12 r 3",
        strategy: "birdBeak",
        showResult: true,
        showPlaceValue: true,
        showGrid: true
      }
    }
  ],
  ink: []
};

boardDocumentSchema.parse(sampleBoard);

assert(isAllowedEmbedUrl("https://pasos.edumind.es/?embed=1"), "EDUmind Hub apps must be embeddable");
assert(!isAllowedEmbedUrl("https://example.invalid/"), "Unknown hosts must stay blocked for embeds");

const serverSource = readFileSync(resolve("apps/api/src/server.ts"), "utf8");
const dbSource = readFileSync(resolve("apps/api/src/db.ts"), "utf8");
[
  '"/api/arasaac/search"',
  '"/api/sala/:code/responses"',
  "publishClassroomEvent",
  "streamStoredClassroomEvents"
].forEach((needle) => {
  assert(serverSource.includes(needle), `Missing production contract: ${needle}`);
});

[
  "CREATE TABLE IF NOT EXISTS classroom_events",
  "CREATE TABLE IF NOT EXISTS arasaac_search_cache"
].forEach((needle) => {
  assert(dbSource.includes(needle), `Missing database contract: ${needle}`);
});

const inspectorSource = readFileSync(resolve("apps/web/src/components/Inspector.tsx"), "utf8");
assert(inspectorSource.includes("searchArasaacApi(query)"), "Inspector must use backend ARASAAC proxy/cache");
assert(
  !inspectorSource.includes("api.arasaac.org/api/pictograms/es/search"),
  "Inspector must not call ARASAAC search directly"
);

console.log("Production contracts OK");
