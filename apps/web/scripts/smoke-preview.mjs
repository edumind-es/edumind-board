import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const port = Number(process.env.SMOKE_PORT ?? 4174);
const baseUrl = `http://127.0.0.1:${port}`;
const logLines = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchText(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(response.ok, `${pathname} respondio ${response.status}`);
  return response.text();
}

async function waitForServer() {
  const deadline = Date.now() + 12_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await fetchText("/");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError ?? new Error("Preview no respondio a tiempo");
}

const server = spawn(
  "npm",
  ["--workspace", "@edumind-board/web", "run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: rootDir, detached: true, stdio: ["ignore", "pipe", "pipe"] }
);
let serverExited = false;

server.stdout.on("data", (chunk) => logLines.push(String(chunk)));
server.stderr.on("data", (chunk) => logLines.push(String(chunk)));
server.on("exit", () => { serverExited = true; });

try {
  await waitForServer();

  const html = await fetchText("/");
  assert(html.includes('<div id="root"></div>'), "index.html no contiene el mount root");

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith("/assets/"));
  assert(assetPaths.length > 0, "index.html no referencia assets versionados");

  await Promise.all(assetPaths.map(async (path) => {
    const response = await fetch(`${baseUrl}${path}`);
    assert(response.ok, `${path} respondio ${response.status}`);
  }));

  // Service worker generado por vite-plugin-pwa (workbox generateSW):
  // debe precachear assets versionados y registrar el fallback de navegación.
  const sw = await fetchText("/sw.js");
  assert(sw.includes("workbox"), "sw.js no es el service worker generado por workbox");
  assert(/"url":\s*"assets\//.test(sw) || sw.includes("assets/"), "sw.js no precachea assets versionados");

  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert(manifestResponse.ok, "manifest.webmanifest no responde correctamente");
  const manifest = await manifestResponse.json();
  assert(manifest.name || manifest.short_name, "manifest sin nombre de aplicacion");

  console.log(`Smoke web OK: ${baseUrl}`);
} catch (error) {
  console.error(logLines.join(""));
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
  await Promise.race([
    once(server, "exit").catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
  if (!serverExited && server.pid) {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      server.kill("SIGKILL");
    }
  }
}
