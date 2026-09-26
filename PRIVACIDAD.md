# Privacidad — EDUmind Board

Este documento describe qué datos maneja EDUmind Board, dónde se guardan y durante
cuánto tiempo. Se refiere al código de este repositorio; la instancia pública
<https://board.edumind.es> la opera Luis Vilela Acuña (contacto@edumind.es).
Quien despliegue su propia instancia es responsable de sus obligaciones de
protección de datos (RGPD/LOPDGDD): base jurídica, información, retención,
derechos y borrado seguro de copias.

## Principio: local-first

La pizarra funciona entera **sin cuenta y sin servidor**: los tableros, la tinta y
los archivos viven en el navegador del docente. El servidor solo entra en juego
para tres cosas opcionales: sincronizar con cuenta, compartir por enlace y abrir
una «sala de clase» en vivo. No hay analítica externa ni rastreadores: la CSP del
servidor solo permite scripts y conexiones al propio origen.

## Qué guarda el navegador (dispositivo del docente)

| Dato | Dónde | Cuánto tiempo |
|---|---|---|
| Tableros (título, elementos, tinta, capturas JPEG del lienzo) | IndexedDB `edumind-board` | Hasta que el docente los borra desde la biblioteca |
| Archivos PDF/JPEG/PNG añadidos con «PDF o imagen local» | IndexedDB `edumind-board-archivos` (`local:<id>`); **nunca suben al servidor** | Hasta borrar el elemento o los datos del sitio |
| Estadísticas de uso propias (widgets añadidos, sesiones), sin nombres | IndexedDB `edumind-board-analytics`, **solo local**, exportable a CSV | Hasta borrar los datos del sitio |
| Preferencias de música y proyección, aviso de sesión cerrado | `localStorage` / `sessionStorage` | Preferencias: indefinido; sesión: al cerrar la pestaña |
| Exportaciones (JSON del tablero, HTML de «Grabar sesión») | Descargas del docente | Las gestiona el docente |

## Qué guarda el servidor (solo si se usan esas funciones)

| Dato | Cuándo | Tabla | Cuánto tiempo |
|---|---|---|---|
| Identidad del docente: identificador, correo, nombre de usuario y grupos que envía el proveedor de identidad (Authentik, `auth.edumind.es`) | Al iniciar sesión | `users` | Mientras exista la cuenta |
| Sesión OIDC (`id_token`, solo para cerrar sesión en el proveedor) | Al iniciar sesión | `oidc_sessions` | 8 días (10 horas si se entra con el móvil); las caducadas se purgan al abrir sesiones nuevas |
| Tableros del docente y sus versiones | Al sincronizar con cuenta | `boards`, `board_versions` | Hasta que el docente los borra |
| Enlaces de solo lectura | Al compartir | `share_links` | Hasta que se revocan o caducan |
| Sala de clase: código, tablero proyectado y **respuestas del alumnado** (emoji o mano levantada, y un alias opcional de hasta 40 caracteres) | Al abrir una sala y responder | `classroom_sessions`, `classroom_responses`, `classroom_events` | **Respuestas y eventos: 24 horas** (`CLASSROOM_EVENT_RETENTION_HOURS`), o antes si el docente pulsa «limpiar» o cierra la sala |
| Caché de búsquedas de pictogramas ARASAAC (solo el término buscado) | Al buscar pictogramas | `arasaac_search_cache` | 168 horas (`ARASAAC_CACHE_TTL_HOURS`) |

Al alumnado no se le pide ninguna cuenta. El campo «Tu nombre» es opcional, admite
un alias y así se indica en pantalla; solo lo ve su docente. El alias se recuerda
en el `sessionStorage` del dispositivo del alumno hasta cerrar la pestaña.

El servidor de la instancia pública registra los accesos con la dirección IP
anonimizada, como el resto de sitios de EDUmind.

## Con quién se comunica el navegador

| Destino | Para qué | Cuándo |
|---|---|---|
| La propia API (`/api`) | Sincronizar, compartir, sala, música, recursos, pictogramas | Al usar esas funciones |
| `auth.edumind.es` | Inicio de sesión (OIDC) | Solo al pulsar «Entrar» |
| `pasos.edumind.es`, `motion.edumind.es`, `recursos.edumind.es` | La plantilla «Escritorio docente» los embebe en iframes | Al abrir esa plantilla (es la del tablero inicial) |
| `breath`, `quiz`, `robotics`, `miapp` `.edumind.es` | Widgets «App EDUmind» | Al añadir el widget |
| `api.arasaac.org` | Búsqueda (a través del servidor) e imágenes de los pictogramas | Al buscar o mostrar pictogramas |
| `www.youtube-nocookie.com`, `w.soundcloud.com` | Música o vídeo si el docente elige esa fuente | Al elegir la fuente (el panel lo avisa) |
| PhET, nubes (Drive, OneDrive, Dropbox…) y dominios `edu` de la lista blanca | Embeds que añada el docente | Al añadir el embed |
| `placehold.co` | Imagen de ejemplo del widget imagen | Al añadir una imagen sin URL |

Cada app o sitio embebido aplica su propia política de privacidad y puede cargar
sus propios recursos (tipografías, analítica) en el navegador de quien vea el
tablero. Si no se quiere, basta con no usar esa plantilla o quitar el iframe.

## Qué sale del dispositivo sin cuenta

Nada de lo que escriba el docente, salvo que abra una sala (entonces el tablero
proyectado viaja al servidor para que lo vea el alumnado) o comparta por enlace.

## Derechos y contacto

Para consultar, corregir o borrar datos guardados en la instancia pública:
contacto@edumind.es, asunto «[Privacidad]». Si el aviso afecta a datos de
menores, indícalo en la primera línea.
