# Decisiones de diseño de EDUmind Board

> Redactado a posteriori el 2026-09-26, a partir del código, de
> `docs/ARCHITECTURE.md` y de los comentarios que ya explicaban el porqué en
> los ficheros. Recoge cómo funciona el recurso hoy y por qué se hizo así.

## 1. Local-first: el navegador es la fuente de verdad

Los tableros, la tinta y los archivos viven en IndexedDB del dispositivo del
docente. Sin cuenta y sin conexión la pizarra funciona entera (PWA con service
worker). El servidor es un espejo opcional. **Por qué:** en un aula la red falla,
el docente no debe depender de un servidor para dar clase, y así los datos de
clase no salen del dispositivo salvo que se pida (`docs/ARCHITECTURE.md` §6).

## 2. Sin cuentas para el alumnado, códigos anónimos

La «sala de clase» se abre con un código de cuatro cifras; el alumnado entra sin
registro y con un alias opcional. **Por qué:** minimizar datos de menores. Desde
la versión 0.1.1 sus respuestas se borran del servidor a las 24 h
(`CLASSROOM_EVENT_RETENTION_HOURS`), igual que los eventos.

## 3. La cuenta del docente es SSO (OIDC) y nunca es requisito

Solo hace falta para sincronizar, compartir por enlace y abrir sala. El código
público admite cualquier proveedor OIDC (`AUTHENTIK_*`); con
`AUTHENTIK_ENABLED=false` la app se queda en modo local.

## 4. Sin analítica externa

No hay Matomo, Google Analytics ni similares; la CSP del servidor solo permite
`script-src 'self'` y `connect-src 'self'`. La «analítica» de
`lib/analytics.ts` es un contador local en IndexedDB, sin nombres, exportable
a CSV por el docente. **Por qué:** privacy-first y coherencia con lo que se le
dice al usuario.

## 5. Archivos locales que no viajan al servidor

Los PDF e imágenes del docente se guardan como `local:<id>` en IndexedDB; la
tabla `uploads` del servidor se retiró en la migración 2. **Por qué:** los
archivos de aula son lo más sensible y lo más pesado; no tienen que salir del
dispositivo (`apps/api/src/migraciones.ts`).

## 6. Música servida por el propio servidor, no por un embed

Las pistas CC BY de Kevin MacLeod se descargan una vez (`scripts/curar-musica.mjs`)
y las sirve la API. **Por qué:** los embeds de terceros paran a los 30 s sin
sesión y envían datos de navegación; con pistas propias suena entero y no sale
nada fuera (`apps/api/src/routes/musica.ts`). SoundCloud y YouTube quedan como
opción explícita, con aviso en pantalla.

## 7. Lista blanca de embeds

Solo se pueden empotrar dominios conocidos (`packages/shared/src/schemas.ts`),
reflejados en la CSP `frame-src`. **Por qué:** proteger de la única cosa
peligrosa de un iframe, meter una página cualquiera delante del alumnado, sin
romper lo útil (apps EDUmind, PhET, nubes, editoriales, dominios `edu`).

## 8. Accesibilidad del lienzo por una lista espejo

El tablero se dibuja en un `<canvas>` (Konva) que no tiene foco ni ARIA. En vez
de reescribir el lienzo, una lista accesible (`ListaElementosAccesible.tsx`)
espeja los elementos y comparte la selección del store: flechas para elegir,
Mayús+flechas para mover, Enter para editar en el inspector. **Por qué:** es la
vía más simple que da acceso por teclado y lector de pantalla sin tocar el
modelo de datos.

## 9. Licencia doble AGPL-3.0-or-later / EUPL-1.2

Quien reutilice elige. **Por qué:** la AGPL protege el uso en red (art. 13); la
EUPL es la licencia de la administración europea y compatible con los centros
públicos. La marca EDUmind® no se cede con el código (`TRADEMARKS.md`).

## 10. Release pública saneada

El repositorio público no lleva el despliegue (scripts, unidades systemd,
nginx), ni bases de datos, ni datos de aula, ni el módulo de autenticación en
su versión de producción. **Por qué:** lo que es del servidor de EDUmind no le
sirve a nadie más y puede exponer detalles operativos. Lo que hace falta para
levantar una instancia propia está en el README.
