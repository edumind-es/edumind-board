# EDUmind Board Architecture

**Estado:** arquitectura viva de producto  
**Fecha:** 2026-06-10  
**Producto:** EDUmind Board / `board.edumind.es`

EDUmind Board es una PWA docente local-first para crear, proyectar y compartir tableros de aula. La arquitectura prioriza uso sin conexión, edición fluida, seguridad en recursos embebidos y crecimiento modular de widgets educativos.

## 1. Principios

- **App soberana:** Board se autentica directamente contra `auth.edumind.es` cuando el usuario usa funciones Pro.
- **Local-first:** la creación y edición base no dependen de red ni de cuenta.
- **Dominios separados:** widgets, lienzo, manipulativos, perfiles y datos tienen contratos propios.
- **Contratos compartidos:** el paquete `@edumind-board/shared` define schemas Zod y tipos persistidos.
- **Despliegue reversible:** cada release visible debe tener backup, smoke y rollback.
- **Inspiración abierta:** cualquier reutilización o inspiración open source se registra en `NOTICE`.

## 2. Estructura

```text
edumind-board/
  apps/
    web/                 React + Vite + Konva + Zustand + PWA (vite-plugin-pwa)
      src/
        components/      Shell visual, canvas, paneles y ui/ (toasts, diálogos)
        activities/      Catalogo y factories de actividades guiadas
        ink/             Herramientas y geometría del lienzo global
        manipulatives/   Reglas puras de materiales manipulativos
        profiles/        Perfiles docentes y plantillas recomendadas
        widgets/         Registro, despachador (renderers.tsx) y components/
        three/           Escena WebGL de manipulativos 3D (chunk perezoso)
        lib/             Store, API, factories, IndexedDB y utilidades
    api/                 Fastify modular
      src/
        app.ts           Factory buildApp() (usada también por los tests)
        server.ts        Punto de entrada (listen)
        auth/            Sesión firmada y flujo OIDC
        routes/          auth, boards, sala, resources, uploads
        test/            Tests de integración con fastify.inject()
  packages/
    shared/              Schemas Zod, tipos y contratos de seguridad
  docs/                  Arquitectura, decisiones y planes técnicos
```

## 3. Frontend

### 3.1 Shell

`App.tsx` coordina la experiencia principal:

- carga del board activo;
- toolbar y biblioteca;
- inspector contextual;
- presentación/PDI;
- estado de autenticación;
- persistencia local y sincronización cuando corresponda.

### 3.2 Canvas

`BoardCanvas.tsx` renderiza el tablero con Konva. Su responsabilidad debe ser principalmente visual:

- stage, viewport y transformaciones;
- nodos de elementos;
- selección y transformador;
- renderizado Konva de cada widget;
- overlays HTML para iframes y recursos embebidos.

Regla de evolución: la lógica didáctica o de negocio no debe crecer dentro del canvas. Cuando un widget tenga reglas propias, deben vivir en un módulo de dominio.

### 3.3 Widgets

`src/widgets/registry.ts` centraliza el catálogo:

- tipo de elemento;
- etiqueta;
- icono;
- categoría;
- estado destacado.

Este registro alimenta toolbar, biblioteca, perfiles y futuras plantillas. Los widgets no deben duplicar metadatos en componentes separados.

### 3.4 Perfiles

`src/profiles/profiles.ts` define perfiles docentes como Matemáticas manipulativas, Escritura, PDI o aula visual.

Objetivo siguiente:

- guardar perfil por board;
- guardar favoritos por usuario;
- permitir perfiles de centro o ciclo educativo.

## 4. Lienzo

El dominio `src/ink` separa:

- catálogo de herramientas;
- categorías de herramientas;
- geometría reutilizable;
- objetos del lienzo global.

El lienzo debe evolucionar hacia un editor profesional:

- selección múltiple;
- capas;
- copiar/pegar;
- duplicar;
- bloqueo;
- traer al frente/enviar atrás;
- snapping a cuadrícula y objetos;
- guías inteligentes;
- inspector contextual.

Los objetos de tinta no deben depender de un widget concreto salvo cuando estén anclados explícitamente a un elemento.

## 5. Manipulativos

`src/manipulatives` contiene reglas puras de materiales manipulativos. El primer módulo extraído es `base10.ts`.

Responsabilidades del motor Base 10:

- valor de cada pieza;
- métricas proporcionales;
- creación de piezas desde valor posicional;
- conteo de piezas;
- normalización por canjes;
- agrupación de 10 piezas cercanas;
- descomposición reversible.

Contrato didáctico Base 10:

- `10 unidades` equivalen a `1 decena`;
- `10 decenas` equivalen a `1 centena`;
- `10 centenas` equivalen a `1 millar`;
- todo canje conserva el valor total;
- el renderizado 2D/2.5D no puede romper proporciones matemáticas.

Prueba asociada:

```bash
npm --workspace @edumind-board/web run check:base10
```

### 5.1 Manipulativos 3D reales (widget `mates3d`)

`src/manipulatives/space3d.ts` define las reglas puras del manipulativo 3D
(WebGL con three + react-three-fiber, render en `src/three/`):

- dimensiones con proporción matemática real: unidad 1×1×1, decena 10×1×1,
  centena 10×1×10, millar 10×10×10 — el volumen en unidades cúbicas ES el valor;
- canjes ascendentes por proximidad y descomposiciones reversibles que
  conservan el valor total;
- sólidos con caras/aristas/vértices: prisma y pirámide son paramétricos por
  número de lados de la base (`solidFacts(kind, n)` calcula F/A/V y cumple
  Euler para cualquier n).

Desde el lienzo global, un sólido dibujado (proyección 2D) puede "abrirse en
3D": crea un widget `mates3d` en modo sólidos con el cuerpo y número de lados
equivalentes (`createMates3dSolid`). Así el boceto rápido del lienzo y el
manipulativo tridimensional real quedan enlazados.

La escena 3D se carga con React.lazy en el chunk `vendor-3d`: el bundle
principal no crece si el board no usa el widget. La cámara se persiste en el
documento del board. Rendimiento PDI: `frameloop="demand"` y DPR limitado.

Prueba asociada:

```bash
npm --workspace @edumind-board/web run check:space3d
```

## 6. Datos

El contrato persistido vive en `packages/shared/src/schemas.ts`.

Entidad principal:

```text
BoardDocument
  schemaVersion
  id
  title
  theme
  viewport
  elements[]
  ink[]
  updatedAt
```

Toda nueva entidad persistente debe:

- añadirse al schema compartido;
- tener valor por defecto o migración;
- mantener compatibilidad con boards antiguos;
- ser validable en backend y frontend.

### 6.1 Sincronización local ↔ nube

La fuente de verdad de trabajo es **IndexedDB** (`apps/web/src/lib/localDb.ts`):
la app crea, edita y guarda sin cuenta ni red. Con sesión EDUmind, la nube es un
**espejo opcional** de los tableros del docente (tabla `boards`, por `owner_id`).

- **Endpoint:** `PUT /api/boards/:id` hace upsert del borrador conservando el id
  del cliente (sin versionar; `/publish` es aparte). Conflicto por `updatedAt`:
  si el servidor tiene una versión más nueva, responde `409` con su copia.
- **Orquestación** (`apps/web/src/lib/sync.ts`): al iniciar sesión, reconciliación
  bidireccional (sube solo-local, baja solo-nube, gana el `updatedAt` mayor);
  tras editar, push con debounce del tablero activo; en conflicto no se pisa la
  edición en curso. Estado visible en la topbar.
- **Invariante local-first:** todo el código de sync está condicionado a sesión;
  el flujo anónimo no cambia. La nube nunca es requisito para trabajar.
- **Limitación conocida (MVP):** el borrado usa borrado remoto directo, no
  tombstones; borrar sin red puede reaparecer en la siguiente reconciliación.

## 7. Actividades

`src/activities/catalog.ts` define actividades guiadas reutilizando plantillas de board.

Responsabilidades actuales:

- catalogar actividades iniciales;
- vincular cada actividad a una plantilla existente;
- generar entidades `Activity` validas mediante el schema compartido;
- crear un board inicial cuando la actividad lo requiere.

Contrato de actividad:

- toda actividad tiene objetivo, perfil, tiempo estimado y pasos;
- cada paso puede declarar evidencia esperada;
- cada material tiene tipo, titulo y, si aplica, `widgetType` o `url`;
- `boardTemplateId` debe apuntar a una plantilla real.

Prueba asociada:

```bash
npm --workspace @edumind-board/web run check:activities
```

## 8. Backend

`apps/api` ofrece:

- API de boards;
- sesiones/autenticación;
- compartición;
- eventos de aula;
- proxy/cache de recursos externos cuando corresponde.

El backend no debe asumir que todos los usuarios están autenticados. La capa Pro añade identidad, sincronización y colaboración, pero el modo local sigue siendo válido.

## 9. Seguridad

Controles obligatorios:

- validación Zod en contratos de entrada/salida;
- allowlist para embeds;
- CSP y sandbox progresivo en iframes;
- cookies propias y configuración segura en producción;
- secretos fuera del repositorio;
- rate limit en APIs públicas;
- auditoría de dependencias antes de release.

## 10. Calidad

Comandos mínimos antes de release:

```bash
npm run typecheck
npm run test
npm --workspace @edumind-board/web run check:activities
npm --workspace @edumind-board/web run check:geometry
npm --workspace @edumind-board/web run check:base10
npm --workspace @edumind-board/web run check:space3d
npm run build
npm run check:contracts
npm run smoke:web
```

Esta batería se ejecuta automáticamente en cada push y PR mediante
`.github/workflows/ci.yml` (CI en GitHub Actions, Node 20).

Los cambios visuales relevantes deben cubrir:

- viewport desktop;
- viewport PDI 1366x768;
- viewport móvil;
- estado e-ink cuando aplique;
- ausencia de solapamientos en header, toolbar e inspector.

## 11. Despliegue

Destino actual:

```text
/var/www/edumind_board
```

Flujo esperado:

1. Build en repo fuente.
2. Backup del despliegue visible.
3. Copia de artefactos web/API.
4. Migraciones si existen.
5. Restart de servicio API.
6. Smoke HTTP y PWA.
7. Verificación manual breve de canvas, widgets y PDI.

No se debe desplegar una iteración que no tenga rollback claro.

El empaquetado se puede generar desde CI con `.github/workflows/release.yml`
(disparo manual `workflow_dispatch`): verifica y sube los artefactos web/API/
shared como tarballs. **No hace deploy automático** por política; el job de
deploy queda documentado y desactivado dentro del propio workflow.

### 11.1 Actualización de la PWA

La app es una PWA con service worker (vite-plugin-pwa, estrategia `generateSW`
en modo `prompt`). El registro y la política de actualización viven en
`apps/web/src/lib/registerPwa.ts`:

- comprobación de versión cada hora y al recuperar foco/conexión;
- aviso no intrusivo con botón «Actualizar» cuando hay versión nueva;
- auto-aplicación al ocultar la pestaña, de modo que la siguiente sesión
  arranca fresca sin recargar en mitad de una clase.

Requisito del servidor web (Nginx) para que las actualizaciones lleguen: servir
`index.html` y `sw.js` con `Cache-Control: no-cache` (o `no-store`). Si el
proxy cachea el service worker, los clientes pueden quedarse anclados a una
versión antigua entre sesiones. Los assets con hash (`/assets/*`) sí pueden
cachearse de forma inmutable.

## 12. Roadmap Técnico Inmediato

1. Consolidar `manipulatives/base10.ts` y ampliar pruebas de canje espacial.
2. Extraer otros manipulativos a motores propios: fracciones, regletas y geometría.
3. Convertir `Activity` en experiencia de UI: selector, previsualizacion y ejecucion por pasos.
4. Añadir versionado de boards y recuperación tras cierre inesperado.
5. Incorporar screenshots Playwright para UI PDI/mobile.
6. Endurecer colaboración con salas, permisos y auditoría.
7. Preparar transición PostgreSQL/Object Storage para modo Pro.

## 13. Política Open Source

EDUmind Board puede inspirarse en experiencias open source de alto valor educativo. Cuando exista inspiración, reutilización de ideas, assets o código:

- registrar proyecto, autor y URL;
- revisar licencia;
- diferenciar inspiración conceptual de copia;
- añadir atribución en `NOTICE` si corresponde;
- evitar incorporar código/assets sin cumplir la licencia.

Referencia actual:

- La plantilla “Escritorio docente” declara inspiración en `jjdeharo/escritorio`.
