// Runner de desarrollo full-stack para EDUmind Board.
//
// Arranca API (Fastify, puerto 3100) y Web (Vite, puerto 5173) a la vez,
// con salida prefijada y apagado ordenado: Ctrl+C mata ambos procesos.
// Sin dependencias externas — solo child_process del propio Node.
//
// Uso:  npm run dev        (desde la raíz del monorepo)
import { spawn } from "node:child_process";

// Puertos dedicados al dev de board. Esta máquina es compartida: 3100 (API) y
// 5173 (Vite) los ocupan otros servicios EDUmind, así que board usa su propio
// rango. Sobreescribibles con EDUMIND_DEV_API_PORT / EDUMIND_DEV_WEB_PORT.
const API_PORT = process.env.EDUMIND_DEV_API_PORT ?? "3110";
const WEB_PORT = process.env.EDUMIND_DEV_WEB_PORT ?? "5180";
const API_TARGET = `http://127.0.0.1:${API_PORT}`;

// La API hereda su puerto; la web recibe el target del proxy y su propio puerto
// con --strictPort (si está ocupado, falla en voz alta en vez de derivar a otro
// puerto y romper el proxy silenciosamente).
const entornoApi = { ...process.env, PORT: API_PORT, HOST: "127.0.0.1" };
// El puerto de la web viaja por entorno (no por CLI): las capas anidadas de
// `npm run` se comen los args `--`. vite.config lo lee y activa strictPort.
const entornoWeb = { ...process.env, VITE_DEV_API_TARGET: API_TARGET, EDUMIND_DEV_WEB_PORT: WEB_PORT };

const procesos = [
  { nombre: "api", color: "\x1b[36m", cmd: "npm", args: ["run", "dev:api"], env: entornoApi }, // cian
  { nombre: "web", color: "\x1b[35m", cmd: "npm", args: ["run", "dev:web"], env: entornoWeb }  // magenta
];
const RESET = "\x1b[0m";
const hijos = [];
let cerrando = false;

function prefijar(nombre, color, chunk) {
  const etiqueta = `${color}[${nombre}]${RESET}`;
  for (const linea of chunk.toString().split(/\r?\n/)) {
    if (linea.length > 0) process.stdout.write(`${etiqueta} ${linea}\n`);
  }
}

for (const p of procesos) {
  // detached: cada hijo lidera su propio grupo de procesos, para poder matar el
  // árbol completo (npm → vite/tsx → esbuild) de una vez y no dejar huérfanos.
  const hijo = spawn(p.cmd, p.args, { shell: false, env: p.env, detached: true });
  hijo.stdout.on("data", (d) => prefijar(p.nombre, p.color, d));
  hijo.stderr.on("data", (d) => prefijar(p.nombre, p.color, d));
  hijo.on("exit", (code) => {
    prefijar(p.nombre, p.color, `proceso terminado (código ${code ?? 0})`);
    // Si un proceso cae, arrastra al otro para no dejar entornos a medias.
    if (!cerrando) apagar(code ?? 1);
  });
  hijos.push(hijo);
}

function matarGrupo(hijo, senal) {
  if (!hijo.pid) return;
  // pid negativo = todo el grupo de procesos (posible por detached: true).
  try { process.kill(-hijo.pid, senal); } catch { /* ya muerto */ }
}

function apagar(code = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const hijo of hijos) matarGrupo(hijo, "SIGTERM");
  // Red de seguridad: SIGKILL al grupo si algo ignora SIGTERM, y salir.
  setTimeout(() => {
    for (const hijo of hijos) matarGrupo(hijo, "SIGKILL");
    process.exit(code);
  }, 4000).unref();
}

process.on("SIGINT", () => apagar(0));
process.on("SIGTERM", () => apagar(0));

console.log(`EDUmind Board · dev — API en :${API_PORT}, Web en :${WEB_PORT} (Ctrl+C para parar ambos)`);
