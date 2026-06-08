# Arquitectura de sala en tiempo real escalable

Fecha: 2026-06-01  
Estado: Propuesta tecnica recomendada

## Decision recomendada

Adoptar Redis Streams como bus de eventos de produccion para la sala de aula, manteniendo SQLite como persistencia transaccional actual y conservando el bus SQLite/polling como modo local, desarrollo y contingencia.

Redis Streams es la mejor evolucion inmediata porque encaja con el contrato SSE existente:

- Cada evento tiene identificador monotono y permite reanudacion con `Last-Event-ID`.
- Permite replay corto para reconexiones de navegador y cambios de nodo.
- Funciona bien con varios procesos y varios nodos detras de balanceador.
- No exige migrar toda la persistencia principal fuera de SQLite en esta fase.
- Evita el limite de Redis Pub/Sub clasico, que entrega en vivo pero no conserva eventos perdidos.

Postgres LISTEN/NOTIFY queda como alternativa si EDUmind decide mover la persistencia principal a Postgres. En ese escenario la arquitectura correcta seria tabla outbox persistente + `NOTIFY` como senal de despertar, no `LISTEN/NOTIFY` como unico bus, porque las notificaciones no son durables.

## Problema actual

La implementacion actual ya corrigio el riesgo critico de proceso unico: los eventos de sala se persisten en `classroom_events`, se emiten por SSE con `id` y cada proceso puede recuperar eventos nuevos mediante polling incremental sobre SQLite.

Ese diseno es suficiente para:

- Desarrollo local.
- Un host con varios procesos Node compartiendo el mismo archivo SQLite.
- Cargas moderadas con sesiones de aula acotadas.
- Reconexiones breves de navegador.

No es el nivel objetivo para:

- Varios nodos fisicos o contenedores sin disco compartido.
- Alta concurrencia sostenida de SSE.
- Balanceadores sin afinidad de sesion.
- Necesidad de latencia baja sin polling constante.
- Observabilidad fina de backlog, lag y fallos de entrega.

## Arquitectura objetivo

Extraer una capa `ClassroomEventBus` y seleccionar proveedor por entorno:

```ts
type ClassroomAudience = "students" | "teacher";

type ClassroomEventEnvelope = {
  id: string;
  sessionCode: string;
  audience: ClassroomAudience;
  data: object;
  createdAt: string;
};

interface ClassroomEventBus {
  publish(input: {
    sessionCode: string;
    audience: ClassroomAudience;
    data: object;
  }): Promise<ClassroomEventEnvelope>;

  readSince(input: {
    sessionCode: string;
    audience: ClassroomAudience;
    afterId: string;
    limit?: number;
  }): Promise<ClassroomEventEnvelope[]>;

  subscribe(input: {
    sessionCode: string;
    audience: ClassroomAudience;
    afterId: string;
    signal: AbortSignal;
    onEvent: (event: ClassroomEventEnvelope) => void;
  }): Promise<void>;
}
```

Proveedores:

- `sqlite`: proveedor actual, persistente y compatible con multiproceso local; usa `classroom_events` y polling.
- `redis-streams`: proveedor productivo horizontal; usa Redis Streams para entrega/replay y puede seguir duplicando eventos criticos en SQLite si se requiere auditoria.

Configuracion propuesta:

```env
CLASSROOM_EVENT_BUS=sqlite
REDIS_URL=redis://127.0.0.1:6379
CLASSROOM_STREAM_MAXLEN=10000
CLASSROOM_STREAM_TTL_HOURS=24
CLASSROOM_SSE_BLOCK_MS=15000
CLASSROOM_SSE_HEARTBEAT_MS=25000
```

En produccion:

```env
CLASSROOM_EVENT_BUS=redis-streams
REDIS_URL=redis://redis.internal:6379
```

## Diseno Redis Streams

Clave de stream:

```txt
edumind:board:classroom:{sessionCode}:{audience}
```

Evento:

```json
{
  "data": "{\"type\":\"response\",\"response\":{...}}",
  "createdAt": "2026-06-01T13:00:00.000Z"
}
```

Publicacion:

- `XADD edumind:board:classroom:{code}:{audience} MAXLEN ~ {CLASSROOM_STREAM_MAXLEN} * data {json} createdAt {iso}`
- Devolver el id generado por Redis como `id` SSE.
- Para eventos que modifican estado durable, escribir primero el estado en SQLite y luego publicar el evento.

Lectura/reconexion:

- Si el cliente envia `Last-Event-ID`, usarlo como `afterId`.
- Si no hay `Last-Event-ID`, emitir primero el estado actual de la sala desde SQLite y empezar a leer eventos nuevos.
- Usar `XRANGE` para recuperar backlog corto y `XREAD BLOCK` para esperar nuevos eventos sin polling agresivo.

Retencion:

- Mantener una ventana corta de eventos por stream, por ejemplo 24 horas o `MAXLEN ~ 10000`.
- La fuente de verdad para respuestas y estado de sala sigue siendo SQLite en esta fase.
- El stream es bus de entrega y replay corto, no almacenamiento historico pedagogico.

## Por que no Redis Pub/Sub

Redis Pub/Sub seria rapido y sencillo, pero no conserva eventos. Si un navegador se reconecta, si un nodo se reinicia o si el balanceador mueve la conexion, no existe replay. Para aula en vivo parece suficiente hasta que falla justo cuando el docente limpia respuestas, cambia el board o recibe participaciones. Streams evita ese punto debil sin complicar mucho la arquitectura.

## Por que no Postgres LISTEN/NOTIFY ahora

Postgres seria excelente si tambien se decide migrar persistencia principal, tableros, sesiones, respuestas y auditoria. Pero `LISTEN/NOTIFY` solo notifica; no conserva mensajes para clientes desconectados. La version robusta seria:

- Insertar evento en tabla `classroom_events`.
- Hacer `NOTIFY classroom_events, {id}`.
- Cada nodo consulta la tabla por `id`.

Eso es correcto, pero implica introducir Postgres como base principal o adicional. Para el estado actual del producto, Redis Streams aporta escala horizontal con menor coste de migracion.

## Plan de implantacion

### Fase 1 - Abstraccion sin cambio funcional

Objetivo: reducir acoplamiento y dejar el sistema preparado para proveedores.

- Crear `apps/api/src/classroomEventBus.ts`.
- Mover la logica actual de `classroom_events`, `publishClassroomEvent`, `fetchClassroomEvents` y `streamStoredClassroomEvents` al proveedor SQLite.
- Mantener los endpoints de sala sin cambios de contrato.
- Anadir tests de contrato para:
  - `publish` devuelve id.
  - `readSince` respeta orden.
  - `subscribe` no duplica eventos.
  - `Last-Event-ID` recupera eventos pendientes.

### Fase 2 - Proveedor Redis Streams

Objetivo: habilitar produccion horizontal.

- Anadir dependencia `ioredis` o `redis`.
- Implementar `RedisStreamsClassroomEventBus`.
- Seleccionar proveedor con `CLASSROOM_EVENT_BUS`.
- Mantener fallback explicito a SQLite solo si `CLASSROOM_EVENT_BUS=sqlite`.
- Fallar el arranque si `CLASSROOM_EVENT_BUS=redis-streams` y `REDIS_URL` no existe.
- Probar con dos procesos API simultaneos:
  - Docente conectado al proceso A.
  - Alumno publica respuesta contra proceso B.
  - Docente recibe evento sin polling SQLite.

### Fase 3 - Operacion y observabilidad

Objetivo: operar como producto EdTech de alto nivel.

- Exponer healthcheck extendido:
  - proveedor activo.
  - estado de Redis.
  - latencia de ping.
  - ultimo error de bus.
- Registrar metricas:
  - conexiones SSE activas por audiencia.
  - eventos publicados por minuto.
  - errores de publicacion.
  - reconexiones por `Last-Event-ID`.
  - lag medio entre `createdAt` y entrega.
- Documentar configuracion de Nginx/Traefik:
  - buffering desactivado para SSE.
  - timeouts de lectura superiores a 60s.
  - compresion desactivada para `text/event-stream`.

### Fase 4 - Hardening de alta concurrencia

Objetivo: sostener eventos masivos sin degradacion silenciosa.

- Limitar tamano de payload de eventos de sala.
- Separar evento de board completo de eventos incrementales si el board crece mucho.
- Anadir backpressure por conexion SSE.
- Cerrar conexiones lentas con error controlado.
- Evaluar WebSocket solo si aparecen flujos bidireccionales intensivos; para el caso actual SSE sigue siendo suficiente.

## Pruebas de aceptacion

Minimas para aprobar Redis Streams:

- Build y typecheck pasan sin warnings nuevos.
- Test unitario del bus SQLite.
- Test unitario del bus Redis con Redis local o contenedor.
- Test de integracion con dos procesos API y una misma sala.
- Reconectar SSE con `Last-Event-ID` y recibir eventos pendientes una sola vez.
- Cerrar sala publica `ended` y limpia conexiones.
- Limpiar respuestas publica `responses:cleared` en todos los nodos.
- Si Redis cae al arrancar en modo `redis-streams`, la API falla de forma clara.
- Si Redis cae durante ejecucion, los endpoints devuelven error 503 para acciones dependientes del bus y el healthcheck lo reporta.

## Recomendacion ejecutiva

La ruta mas profesional y eficiente es:

1. Extraer primero la interfaz `ClassroomEventBus` manteniendo SQLite.
2. Implementar Redis Streams como proveedor de produccion.
3. Desplegar con `CLASSROOM_EVENT_BUS=redis-streams` en staging.
4. Ejecutar prueba con dos procesos API y balanceador.
5. Promover a produccion cuando el healthcheck, reconexion SSE y replay con `Last-Event-ID` esten verificados.

Esta decision minimiza riesgo, evita una migracion prematura de base de datos y deja a EDUmind Board preparado para aulas simultaneas, despliegue horizontal y operacion profesional.
