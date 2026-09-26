# Créditos y material ajeno

EDUmind Board es obra de **Luis Vilela Acuña · EDUmind®** (contacto@edumind.es),
con licencia doble AGPL-3.0-or-later / EUPL-1.2 (ver [LICENSE](LICENSE) y [NOTICE](NOTICE)).
Aquí se acredita todo lo que no es suyo.

## Pictogramas

Autor pictogramas: Sergio Palao. Origen: ARASAAC (http://www.arasaac.org).
Licencia: CC BY-NC-SA. Propiedad: Gobierno de Aragón (España).

Los pictogramas **no están en este repositorio**: el widget «Pictogramas» los
busca en `api.arasaac.org` y los carga bajo demanda; el propio widget muestra la
atribución en pantalla. Por ser CC BY-NC-SA, no se pueden usar con fines
comerciales.

## Música de aula

- **Kevin MacLeod** — https://incompetech.com/ — licencia **CC BY 4.0**
  (https://creativecommons.org/licenses/by/4.0/). Las pistas no vienen en el
  repositorio; `scripts/curar-musica.mjs` las descarga de incompetech.com y la
  aplicación muestra la atribución en el reproductor. Es la condición de uso: no
  la quites.
- Listas de **SoundCloud** propuestas por modo de trabajo (Lofi Girl y Chillhop,
  `apps/web/src/lib/music.ts`): se reproducen con el reproductor oficial de
  SoundCloud y no se redistribuyen. Sus derechos son de sus autores; el panel de
  música avisa de que SoundCloud recibe datos de navegación de quien lo use.

## Inspiración

- **jjdeharo/escritorio** — https://github.com/jjdeharo/escritorio — Juan José de
  Haro, con la idea original «Escritorio Interactivo para el Aula» de María
  Teresa González — CC BY-SA 4.0. La plantilla «Escritorio docente» se inspira en
  su enfoque; no se copia código ni recursos. Detalle en [NOTICE](NOTICE).

## Tipografías

No se incluye ni se carga ninguna tipografía ajena: el sistema visual
(`apps/web/public/vendor/lamina-v1.css`, propio) usa las fuentes del sistema.

## Iconos

- **Lucide** (`lucide-react`) — https://lucide.dev — licencia ISC.
- `apps/web/public/icon.svg` es propio.

## Librerías principales

| Librería | Uso | Licencia |
|---|---|---|
| React, react-dom | Interfaz | MIT |
| Konva, react-konva | Lienzo del tablero | MIT |
| three, @react-three/fiber, @react-three/drei | Manipulativo «Mates 3D» | MIT |
| zustand | Estado | MIT |
| zod | Esquemas compartidos | MIT |
| idb | IndexedDB (local-first) | ISC |
| qrcode | Códigos QR | MIT |
| Fastify y plugins (@fastify/cors, @fastify/rate-limit…) | API | MIT |
| better-sqlite3 | Base de datos | MIT |
| Vite, vite-plugin-pwa, Workbox | Compilación y PWA | MIT |
| Vitest, Testing Library | Pruebas | MIT |
| TypeScript | Lenguaje | Apache-2.0 |

La lista completa con versiones está en `package-lock.json`; cada paquete lleva su
licencia dentro de `node_modules`.

## Servicios externos (no se redistribuye nada)

Apps EDUmind embebidas (`pasos`, `motion`, `recursos`, `breath`, `quiz`,
`robotics`, `miapp` en `.edumind.es`), PhET (phet.colorado.edu), YouTube
(youtube-nocookie.com), SoundCloud, nubes (Drive, OneDrive, Dropbox…) y
`placehold.co` (imagen de ejemplo). Ver [PRIVACIDAD.md](PRIVACIDAD.md).
