# Arquitectura MVP

## Objetivo

Construir una version inicial de EDUmind Board que pueda sobrevivir a una clase real:

- Crear y editar un board.
- Guardar automaticamente en el dispositivo.
- Publicar un snapshot remoto.
- Compartir una vista de solo lectura.
- Evitar exposicion accidental de borradores.
- Gestionar varios boards locales.
- Exportar e importar boards como JSON.
- Importar archivos pequenos PDF/JPEG/PNG como elementos autocontenidos.

## Decisiones

### Local-first

IndexedDB es la fuente inmediata de verdad durante la sesion docente. El servidor guarda snapshots publicados y permite recuperar/publicar, pero no debe bloquear el trabajo en aula.

### Snapshot sobre colaboracion real-time

El MVP no implementa CRDTs, WebSockets ni edicion multiusuario. La vista publica consume la ultima version publicada. Esto reduce riesgos de sincronizacion y privacidad.

### JSON versionado

El board se guarda como documento JSON validado con Zod. La normalizacion fina de elementos queda fuera del MVP.

Tablas iniciales:

- `boards`
- `board_versions`
- `share_links`

### Vista publica aislada

Los enlaces publicos usan tokens aleatorios largos. La ruta publica no recibe `boardId` ni devuelve borradores.

### Embeds con allowlist

Los iframes son necesarios para el producto, pero tienen riesgo de privacidad y seguridad. El MVP solo permite dominios incluidos en la allowlist compartida entre frontend y backend.

Dominios iniciales:

- PhET
- YouTube / YouTube Nocookie
- Vimeo
- Canva
- dominios EDUmind

### Archivos locales pequenos

El MVP permite importar PDF, JPEG y PNG como `data:` URLs dentro del documento del board. Esto es util para probar el flujo local-first y compartir recursos ligeros sin storage externo.

Limite recomendado en frontend: 1.5 MB por archivo.

Antes de produccion, los archivos deberian pasar a object storage y el board deberia guardar referencias, no blobs grandes dentro del JSON.

## Riesgos tecnicos abiertos

- Iframes: necesitan allowlist real antes de produccion.
- Autenticacion: el MVP usa `X-Teacher-Id` local para desarrollo; produccion debe usar sesion segura. La referencia operativa para vincular Board y el resto de apps con Authentik esta en `/var/www/SSO_EDUMIND_AUTHENTIK.md`.
- Assets subidos: fuera de MVP. Inicialmente se usan URLs.
- Archivos embebidos: activos para MVP solo con tamano pequeno.
- Service worker: cache basica inicial; necesita estrategia de actualizacion antes de beta publica.
- Sin Git inicializado todavia en la carpeta del proyecto.

## Endpoints API

- `GET /health`
- `GET /api/boards`
- `POST /api/boards`
- `GET /api/boards/:id`
- `PUT /api/boards/:id/publish`
- `POST /api/boards/:id/share`
- `GET /api/boards/:id/shares`
- `DELETE /api/share/:token`
- `GET /api/share/:token`

En produccion Hetzner, Nginx publica la API bajo el mismo origen:

- Web: `https://board.edumind.es`
- API: `https://board.edumind.es/api`
- Puerto interno API: `127.0.0.1:3198`

No se debe exponer Vite ni la API dev en `0.0.0.0`.

## Criterio de exito MVP

Un docente prepara una sesion, la usa en una PDI durante 45 minutos, publica el enlace, cierra el portatil, vuelve al dia siguiente y todo sigue ahi.
