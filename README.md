# EDUmind Board

EDUmind Board es una PWA docente local-first para crear tableros de aula, proyectarlos en PDI y publicarlos como vistas de solo lectura para alumnado.

Dominio previsto de produccion: `board.edumind.es`.

## Estado

Base MVP inicial:

- Monorepo npm workspaces.
- `apps/web`: Vite + React + TypeScript + Konva.
- `apps/api`: Fastify + SQLite + rate limiting + cabeceras de seguridad.
- `packages/shared`: contratos Zod y tipos compartidos.
- Persistencia local con IndexedDB.
- Biblioteca local de boards.
- Import/export JSON de boards.
- Importacion local de PDF, JPEG y PNG pequenos.
- Temporizadores tactiles con estilos editables.
- Semaforo tactil directo en el canvas.
- Bloqueo/desbloqueo rapido de elementos seleccionados.
- Publicacion de snapshots al backend.
- Enlaces publicos por token.
- Revocacion de enlaces compartidos.
- Vista publica read-only en `/share/:token`.
- Allowlist inicial para iframes embebidos.
- Links/embeds de Canva incluidos en la allowlist inicial.

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Levantar API:

```bash
npm run dev:api
```

Levantar web:

```bash
npm run dev:web
```

URLs por defecto:

- Web: `http://localhost:5173`
- API: `http://localhost:3100`
- Healthcheck: `http://localhost:3100/health`

Si el puerto `3100` esta ocupado en el servidor, puede usarse `3101` en desarrollo o produccion local:

```bash
HOST=0.0.0.0 PORT=3101 CORS_ORIGIN=http://localhost:5173 npm run dev:api
VITE_API_BASE_URL=http://localhost:3101 npm run dev:web -- --host 0.0.0.0
```

Build de produccion para `board.edumind.es`:

```bash
VITE_API_BASE_URL=https://board.edumind.es npm run build
```

## Variables

Usa `.env.example` como referencia.

En produccion inicial, la PWA y la API se sirven desde el Hetzner detras de Nginx:

- PWA: `https://board.edumind.es`
- API: `https://board.edumind.es/api`

Cloudflare Pages no es necesario en esta etapa. Cloudflare puede seguir usandose como DNS/proxy, pero el despliegue principal vive en el servidor propio.

La API no se expone en puerto publico: escucha solo en `127.0.0.1:3198` y Nginx la publica bajo `/api`.

Archivos de despliegue:

- `deploy/board.edumind.es.conf`
- `deploy/edumind-board-api.service`
- `deploy/README-deploy.md`

## Principio MVP

El flujo principal es:

```txt
Docente trabaja -> IndexedDB guarda siempre
Docente publica -> API recibe snapshot versionado
Alumnado/proyector ve -> snapshot publico read-only
```

El backend no es obligatorio durante la clase. Primero se protege el trabajo local; luego se publica.

## Seguridad MVP

Medidas activas:

- Tokens publicos largos generados con aleatoriedad criptografica.
- `GET /api/share/:token` no expone borradores.
- Validacion Zod en contratos.
- Limite de payload API de 2 MB.
- Rate limit global de API.
- Cabeceras HTTP de seguridad mediante Helmet.
- Allowlist de dominios para iframes.
- SSO real con Authentik/OIDC, PKCE, nonce y cookie HttpOnly firmada.

Pendiente antes de produccion:

- Mover archivos grandes a storage tipo R2/S3 en vez de snapshots JSON.
- Definir CSP completa de la PWA.
- Revisar la allowlist real de editoriales/recursos.
- Automatizar backups de SQLite.

## SSO Authentik

La integracion OIDC de Authentik vive en la API. La web llama a:

- `GET /api/auth/oidc/start`
- `GET /api/auth/oidc/callback`
- `GET /api/auth/me`
- `GET /api/auth/logout`
- `GET /api/auth/health`

Guia operativa: `docs/SSO_AUTHENTIK.md`.
