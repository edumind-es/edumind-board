# Roadmap produccion masiva - EDUmind Board

Fecha: 2026-06-01

## Objetivo

Elevar EDUmind Board desde MVP docente local-first a espacio de aula digital listo para uso masivo, con navegacion estable, SSO consistente, widgets didacticos fiables y una capa colaborativa de alto nivel inspirada en pizarras premium.

## Prioridad 0 - Estabilidad de aula

- Garantizar que `npm run typecheck`, `npm run build`, `npm run smoke:web` y `check:geometry` pasan antes de despliegue.
- Corregir regresiones de navegacion del canvas: zoom, drag, seleccion, iframes y modo PDI.
- Proteger IndexedDB como fuente local fiable: guardado automatico, restauracion del ultimo board, import/export y recuperacion ante cierre de pestana.
- Mantener undo/redo funcional para acciones estructurales: crear, mover, redimensionar, duplicar, eliminar y ordenar elementos.

## Prioridad 1 - SSO y apps Hub

- Board debe usar Authentik/OIDC como unica autenticacion real en produccion.
- Apps Hub embebidas deben recibir contexto `embed=1`, `board=1`, `sso=edumind` y `parent_origin` para evitar pantallas de login duplicadas cuando la app soporte SSO silencioso.
- Cada app Hub debe implementar el Board Plugin Protocol: `board:ready`, `board:state:request`, metricas de iframe y acciones pedagogicas hacia semaforo/timer/notas.
- Para alumnado o vistas publicas, usar `guestUrl` cuando exista y no forzar login.

## Prioridad 2 - Widgets didacticos criticos

- Base 10: validar columnas, canjes, modo manipulativo, limites visuales y publicacion del estado.
- Algoritmos: suma, resta, multiplicacion y division deben renderizar todas sus estrategias seleccionables.
- Web/iframes: mantener allowlist compartida frontend/backend y avisos claros antes de publicar.
- Recursos EDUmind: asegurar URL propia de `board.edumind.es/api/resource-content/*`, MIME correcto y compatibilidad iframe.

## Prioridad 3 - Board colaborativo premium

- Elementos base: post-it, texto, flechas/conectores, tarjetas de flujo, tablas, imagenes, QR y recursos embebidos.
- Diagramacion: proceso, decision, inicio/fin, dato, conectores rectos/codo/discontinuos y etiquetas.
- Cooperacion asincrona: comentarios, menciones, estados de tarea, autores, timestamp, historial por elemento y actividad del board.
- Cooperacion online: presencia, cursores, locks suaves por elemento y sincronizacion incremental.
- Plantillas: retrospectiva, mapa de proyecto, flujo de trabajo, pensamiento visual, investigacion cooperativa y planificacion de aula.

## Entrega inicial completada

- Corregido undo/redo estructural para que el primer cambio pueda deshacerse.
- Corregido render de algoritmos clasicos en suma/resta.
- Anadidos elementos persistentes `connector` y `flow` al contrato Zod compartido.
- Anadidos botones de barra para `Flecha` y `Diagrama`.
- Anadido render Konva e inspector editable para conectores y diagramas.
- Anadidos parametros de contexto SSO/embed para apps Hub embebidas.

## Entrega fase 2 completada

- Pasos embebido en Board ya no cae directamente al login interno cuando no hay usuario local.
- Pasos espera restauracion de sesion Pro en embed y, si hace falta, arranca OIDC con Authentik manteniendo el `next` del iframe.
- Pasos informa a Board mediante `board:ready` y solicita estado con `board:state:request`.
- Board registra `board:ready` en el iframe emisor para mejorar diagnostico de apps Hub.
- Anadido elemento persistente `comment` para cooperacion asincrona: texto, autor/equipo, estado abierto/resuelto/bloqueado, color y fecha.
- Anadido boton `Comentario` en la toolbar y controles de inspector para editarlo.

## Entrega fase 3 completada

- Prioridad 1: ampliado Board Plugin Protocol con `board:auth:login`.
- Prioridad 1: Board responde a apps Hub con `board:auth`, incluyendo estado de autenticacion, usuario disponible y URL de login cuando procede.
- Prioridad 1: Pasos embebido solicita login al parent antes de iniciar su OIDC interno, reduciendo inconsistencias de login dentro del iframe.
- Prioridad 2: Base 10 incorpora canjes inversos directos `1D -> 10U`, `1C -> 10D` y `1M -> 10C` en canvas e inspector.
- Prioridad 2: al activar modo manipulativo desde inspector, Base 10 genera las piezas desde el valor posicional si aun no existen.
- Prioridad 2: el resultado manual de algoritmos acepta division con resto, por ejemplo `12 r 3`.
- Prioridad 3: anadidas plantillas colaborativas `Equipo · Retrospectiva`, `Equipo · Flujo de proyecto` y `Aula · Plan cooperativo`.
- Prioridad 3: las nuevas plantillas combinan comentarios, diagramas, conectores, timers, semaforo y App Hub Pasos.

## Entrega auditoria y depuracion

- Corregido enlace incompleto `/proyector/TOKEN` en el panel de sala.
- Normalizadas respuestas historicas de sala a `studentLabel` y `createdAt`.
- Anadida ruta docente `DELETE /api/sala/:code/responses`.
- El boton `Limpiar` respuestas ahora borra tambien en backend y propaga `responses:cleared`.
- La sincronizacion de sala valida `response.ok` y muestra error si falla.
- Informe detallado: `docs/audit-2026-06-01.md`.

## Entrega resiliencia y arquitectura premium

- Sala de aula preparada para multiproceso local: eventos persistidos en `classroom_events`, SSE con `id` y recuperacion incremental por proceso.
- Configuracion nueva: `CLASSROOM_EVENT_RETENTION_HOURS`.
- Bus en memoria conservado como fast-path, con SQLite como fuente durable de eventos.
- Definida arquitectura objetivo para escala horizontal: `ClassroomEventBus` con proveedor SQLite para local/contingencia y Redis Streams para produccion multinodo.
- Decision tecnica detallada: `docs/classroom-realtime-scale-architecture-2026-06-01.md`.
- ARASAAC pasa a proxy propio `/api/arasaac/search`.
- Cache persistente ARASAAC en `arasaac_search_cache`, TTL por `ARASAAC_CACHE_TTL_HOURS` y fallback stale cuando la red externa falla.
- Inspector usa el proxy/cache y ya no consulta directamente la busqueda externa de ARASAAC.
- Anadido `npm run check:contracts` como verificacion profesional de contratos de produccion.
- Actualizado Browserslist/caniuse-lite en Pasos y validado build sin aviso.

## Validacion realizada

- `npm --workspace @edumind-board/shared run build`
- `npm run typecheck`
- `npm --workspace @edumind-board/web run check:geometry`
- `npm run build`
- `npm run check:contracts`
- `npm run smoke:web`
- `/var/www/pasos_v2`: `npm run build`
