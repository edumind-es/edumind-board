# EDUmind Board

Pizarra de aula **local-first**: se preparan tableros, se proyectan en clase y se comparten en modo solo lectura. PWA, funciona sin conexión.

> Los tableros y lo que se escribe en clase viven en el dispositivo del docente. El servidor guarda lo mínimo para sincronizar y compartir.

Este repositorio es una *release saneada* para revisión de código, reutilización educativa y auditoría: no incluye secretos de producción, configuración de despliegue, guías internas de operación, copias de seguridad, bases de datos SQLite ni contenido subido por nadie.

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
`EDUMIND_BOARD_DB` apuntando a un fichero SQLite con permisos de escritura.

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

## Licencia

Licencia doble **AGPL-3.0-or-later** *o* **EUPL-1.2**, a elección de quien la reutilice. Ver [LICENSE](LICENSE) y [NOTICE](NOTICE).

La música de aula es de Kevin MacLeod, bajo CC BY 4.0. La plantilla «Escritorio docente» se inspira en `jjdeharo/escritorio` (CC BY-SA 4.0); ver la sección anterior.

EDUmind® es marca registrada en España (OEPM). El código es libre; la marca y los logotipos no se ceden con él — ver [TRADEMARKS.md](TRADEMARKS.md).

Por **Luis Vilela Acuña** — maestro de Educación Física.
