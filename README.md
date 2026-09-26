# EDUmind Board

Pizarra de aula **local-first**: se preparan tableros, se proyectan en clase y se comparten en modo solo lectura. PWA, funciona sin conexión.

> Los tableros y lo que se escribe en clase viven en el dispositivo del docente. El servidor guarda lo mínimo para sincronizar y compartir.

Este repositorio es una *release saneada* para revisión de código, reutilización educativa y auditoría: no incluye secretos de producción, configuración de despliegue, guías internas de operación, copias de seguridad, bases de datos SQLite ni contenido subido por nadie.

## Qué hace, qué guarda y con qué se comunica

**Qué hace.** El docente compone tableros con widgets (notas, temporizador,
semáforo, dados, Base 10, fracciones, dictados, mapa mental, medidor de ruido,
pictogramas ARASAAC, apps EDUmind y recursos embebidos), los proyecta en clase y,
si quiere, los sincroniza con cuenta, los comparte por enlace de solo lectura o
abre una «sala de clase» en la que el alumnado ve el tablero y responde con
emojis o levantando la mano.

**Qué guarda.**

- En el navegador del docente (IndexedDB): los tableros, la tinta, las capturas
  y los archivos PDF/imagen locales. Sin cuenta, nada sale del dispositivo.
- En el servidor, solo si se usan esas funciones: la identidad del docente que
  envía el SSO, sus tableros y versiones sincronizados, los enlaces compartidos,
  y la sala de clase (código, tablero proyectado y respuestas del alumnado con un
  alias opcional, **que se borran a las 24 h**).

**Con qué se comunica.** Con su propia API; con `auth.edumind.es` solo al pulsar
«Entrar»; con `api.arasaac.org` al buscar pictogramas; con `edumind.es` para el
catálogo de recursos; y con lo que el docente embeba (apps EDUmind, PhET,
YouTube, SoundCloud, nubes). **Ojo:** la plantilla por defecto «Escritorio
docente» embebe Pasos, Motion y Recursos de EDUmind en iframes, y cada app
embebida carga sus propios recursos en el navegador de quien vea el tablero.

Sin analítica externa. Todo el detalle, tabla por tabla y con plazos, en
[PRIVACIDAD.md](PRIVACIDAD.md).

## Requisitos

- **Node.js 22** o superior. Es la versión que corre en producción y contra la
  que valida el CI; con Node 20 las pruebas de componentes no arrancan.
- npm 10+ (viene con Node 22).
- No hace falta ninguna base de datos externa: usa SQLite en un fichero.

## Puesta en marcha

```bash
npm install
cp .env.example .env          # y sustituye TODOS los valores de ejemplo
npm --workspace @edumind-board/shared run build
npm run typecheck
npm test
npm run dev                   # API + web a la vez
```

`npm run dev` levanta la API en el 3110 y la web en el 5180 (configurable con
`EDUMIND_DEV_API_PORT` y `EDUMIND_DEV_WEB_PORT`). Vite hace de proxy de `/api`
hacia la API, así que el navegador trabaja contra un solo origen.

**Antes de nada, revisa `.env.example` entero.** Dos variables tienen valores
por defecto que sólo valen en el servidor de EDUmind y dejarán funciones
vacías sin decirte por qué: `EDUMIND_RESOURCES_ROOT` (recursos educativos) y
`EDUMIND_MUSICA_ROOT` (música de aula).

### Música de aula

Las pistas no vienen en el repositorio: pesan ~176 MB. Se descargan de su
origen con

```bash
node scripts/curar-musica.mjs
```

Son de Kevin MacLeod y están bajo **CC BY 4.0**, así que se pueden alojar y
servir citando autor y licencia. La aplicación muestra la atribución en
pantalla; no la quites, es la condición de uso. Sin ejecutar ese paso la
aplicación funciona igual: el panel de música avisa de que no hay nada
instalado.

## Despliegue

El despliegue de producción no se publica: compila cada paquete en una versión
nueva y mueve un enlace simbólico de golpe, con vuelta atrás si la verificación
falla. Para desplegar tu propia instancia basta con servir `apps/web/dist` como
estático y correr `apps/api` detrás de un proxy inverso, con la variable
`DATABASE_PATH` apuntando a un fichero SQLite con permisos de escritura.

## Cómo modificarlo

Monorepo con tres paquetes: `apps/web` (PWA, React + Konva), `apps/api`
(Fastify + SQLite) y `packages/shared` (esquemas Zod que comparten ambos).

| Quiero… | Dónde |
|---|---|
| Añadir un widget | Esquema en `packages/shared/src/schemas.ts`, metadatos (nombre, icono, categoría) en `apps/web/src/widgets/registry.ts`, componente en `apps/web/src/widgets/components/` y su caso en `renderers.tsx`; etiqueta en `apps/web/src/lib/etiquetasElementos.ts` |
| Añadir una plantilla de tablero | `apps/web/src/lib/templates.ts` (`BOARD_TEMPLATES`) |
| Añadir una actividad guiada | `apps/web/src/activities/catalog.ts` (`ACTIVITY_BLUEPRINTS`); `npm --workspace @edumind-board/web run check:activities` la valida |
| Añadir una app al hub o un dominio embebible | `apps/web/src/lib/hubApps.ts`; lista blanca en `packages/shared/src/schemas.ts` (y el `frame-src` de tu CSP) |
| Cambiar los textos de los dictados o los niveles de voz | `apps/web/src/lib/dictados.ts`, `apps/web/src/lib/nivelesVoz.ts` |
| Cambiar colores y tipografía | Tokens en `apps/web/public/vendor/lamina-v1.css` y `apps/web/src/styles.css` (temas `.theme-*`) |
| Traducir | Los textos están en los propios componentes y en los ficheros anteriores; no hay capa i18n todavía |

Compilar: `npm run build` (antes, `npm --workspace @edumind-board/shared run build`).
Pruebas: `npm test` (Vitest, API y web) y los `check:*` de `package.json`.

**Desactivar servicios opcionales** (todo en `.env`):

- Sin cuentas ni sincronización: `AUTHENTIK_ENABLED=false` (la app queda en modo local).
- Sin catálogo de recursos: deja `EDUMIND_RESOURCES_ROOT` vacío o apúntalo a tu carpeta.
- Sin música: no ejecutes `curar-musica.mjs`; el panel avisa de que no hay nada instalado.
- Sin pictogramas ARASAAC: quita `pictos` de `registry.ts`.
- Sin apps EDUmind embebidas: elige otra plantilla inicial o vacía `HUB_APPS`.

## Alcance de la release

Qué incluye y qué se deja fuera: [OPEN_SOURCE_RELEASE.md](OPEN_SOURCE_RELEASE.md).

## Inspiración: Escritorio docente

EDUmind Board includes a "Escritorio docente" board template that packages
EDUmind apps, classroom resources, timers and visual classroom state into a
single board-style workspace.

This template is inspired by the educational desktop approach of
`jjdeharo/escritorio`:

- Repository: <https://github.com/jjdeharo/escritorio>
- Reviewed commit: `9c939e8c6bb2105a4e54ad4a21ffeb4ebd189523`
- Author credited by the repository: Juan Jose de Haro
- The upstream README credits the original "Escritorio Interactivo para el Aula"
  idea to Maria Teresa Gonzalez and credits the React migration/collaboration to
  Maria Teresa Gonzalez and Juan Jose de Haro.
- Upstream license notice: Creative Commons Attribution-ShareAlike 4.0
  International (`CC BY-SA 4.0`), as stated in the upstream README.

No source code, images, sounds or other assets from `jjdeharo/escritorio` are
copied into this repository by this template. If future changes reuse upstream
code or assets directly, preserve the corresponding `CC BY-SA 4.0` attribution
and share-alike obligations in the affected files and release materials.

## Colaborar

Se puede colaborar **sin programar**: contar cómo te ha ido en clase, reportar un fallo, revisar los textos o traducir. Todo el proyecto está en español. Empieza por [CONTRIBUTING.md](CONTRIBUTING.md) y el [código de conducta](CODE_OF_CONDUCT.md).

¿Un fallo de seguridad? No abras un issue público: ver [SECURITY.md](SECURITY.md).

## Hecho con IA

Este recurso se ha desarrollado con *vibe coding* con asistencia de IA (Claude
Code y ChatGPT), siguiendo la [política de IA de EDUmind](https://edumind.es/es/legal/ia).
Lo que ha comprobado el autor:

- Las pruebas automáticas: 274 pruebas con Vitest (34 del API, 240 de la web),
  más los `check:*` de dominio (actividades, Base 10, geometría, 3D, dictados,
  contratos de producción, arranque sin motor 3D) y el smoke de la PWA, todo en
  el CI de GitHub en cada PR.
- El contenido didáctico que ve el alumnado: dictados numéricos (0–999 999,
  romanos, ordinales), caras/aristas/vértices de los cuerpos 3D, canjes de Base
  10 y textos de actividades y plantillas.
- Las licencias del material ajeno ([CREDITS.md](CREDITS.md)) y lo que la app
  guarda y con quién se comunica ([PRIVACIDAD.md](PRIVACIDAD.md)).
- El funcionamiento en navegador y en la pizarra digital del aula, con ratón,
  táctil y teclado.

## Créditos

Pictogramas de ARASAAC, música de Kevin MacLeod, inspiración de
`jjdeharo/escritorio`, iconos Lucide y librerías: [CREDITS.md](CREDITS.md).
Registro de decisiones en [DECISIONES.md](DECISIONES.md) y de cambios en
[CHANGELOG.md](CHANGELOG.md).

## Licencia

Licencia doble **AGPL-3.0-or-later** *o* **EUPL-1.2**, a elección de quien la reutilice. Ver [LICENSE](LICENSE) y [NOTICE](NOTICE).

La música de aula es de Kevin MacLeod, bajo CC BY 4.0. La plantilla «Escritorio docente» se inspira en `jjdeharo/escritorio` (CC BY-SA 4.0); ver la sección anterior.

EDUmind® es marca registrada en España (OEPM). El código es libre; la marca y los logotipos no se ceden con él — ver [TRADEMARKS.md](TRADEMARKS.md).

Por **Luis Vilela Acuña** — maestro de Educación Física.
