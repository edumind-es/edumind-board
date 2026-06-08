# Hito pre-release · 2026-05-24

## Objetivo

Consolidar EDUmind Board como pizarra docente usable en aula real antes de fase pre-release:

- lienzo persistente sobre fondos como cuadricula o pauta;
- herramienta matematica Base 10 manipulativa;
- ingestion pedagogica desde recursos EDUmind;
- paneles mas estables y tema EDUmind menos heredado del estilo e-ink;
- build y API desplegados en `board.edumind.es`.

## Cambios entregados

### Lienzo persistente

El board incorpora una propiedad `ink` validada en el contrato compartido. Los trazos y figuras del lienzo global dejan de ser estado local efimero y se guardan/publican con el documento.

Esto permite usar una cuadricula o pauta como fondo bloqueado y escribir encima durante la explicacion sin perder la tinta al salir del modo lienzo, recargar o publicar.

### Base 10

Nuevo widget `base10` con:

- unidades, decenas, centenas y millares;
- vista 2D y apoyo visual 3D;
- controles directos en canvas;
- inspector con valor representado y canjes `10U -> 1D`, `10D -> 1C`, `10C -> 1M`;
- modo manipulativo libre con piezas arrastrables;
- agrupacion desde piezas libres y vuelta a columnas de valor posicional;
- plantilla `Matematicas · Base 10`.

### Recursos EDUmind

Nuevo endpoint `GET /api/resources` que indexa `/var/www/edumind_content/published` y devuelve recursos HTML/PDF publicos con titulo, categoria, URL y fecha.

Nuevo selector visual en el board para buscar y anadir recursos como iframe pedagogico desde la barra lateral.

Actualizacion 2026-05-24: los recursos embebidos ya no dependen de `https://edumind.es/recursos-static`. El API sirve el contenido desde `GET /api/resource-content/*` bajo `https://board.edumind.es`, con ruta sanitizada, MIME correcto, cache no-store y cabeceras compatibles con iframe de mismo origen.

### Tinta anclada y geometria

La tinta puede guardarse anclada a contenedores didacticos seleccionados (`grid`, `guidelines`, `table`, `base10`, `drawing`, `fraction`, `algorithm`, `logic`) mediante `anchorElementId`.

Cuando se dibuja con un contenedor seleccionado, el trazo o figura se convierte a coordenadas locales, queda recortado dentro del widget y se mueve/rota con el contenedor. El borrador tambien opera en coordenadas locales cuando ese contenedor esta seleccionado.

La herramienta de medicion angular muestra el angulo interior 0-180 grados, arco y marcas tipo transportador.

Actualizacion posterior: el lienzo incorpora poligono regular con selector de lados 3-24, control +/- en la barra y ajuste +/- sobre el poligono seleccionado en canvas. El poligono muestra mediciones docentes: radio, perimetro e angulo interior aproximado. Tambien se amplia el catalogo de solidos 2.5D con prisma triangular, cilindro, cono y esfera, ademas de cubo y piramide.

### Matematica primaria e infantil

Nuevos widgets de matematicas:

- `fraction`: modelo de fracciones en barra, circulo o conjunto, con comparacion opcional.
- `algorithm`: suma, resta, multiplicacion y division basica con cuadricula y valor posicional.
- `logic`: seriacion, conteo y clasificacion para logica matematica en infantil.

Nuevas plantillas de arranque: `Matematicas · Fracciones`, `Matematicas · Algoritmos` e `Infantil · Logica matematica`.

### UI y despliegue

- Paleta EDUmind revisada para diferenciarla del modo e-ink.
- Paleta EDUmind alineada con `edumind_websiteproject`: azul `#5e8fa3`, azul profundo `#3c6e7a`, verde `#9ccb7b`, amarillo `#f3c969`, coral `#f28c7a` y fondo oscuro `#0b1929`.
- Z-index de topbar, inspector, biblioteca y selector de recursos reajustado.
- Boton de cuadricula `Fijar como fondo` para enviar atras y bloquear.
- Marco de apps Hub ampliado: asas superiores/laterales mas visibles para seleccionar, mover o eliminar sin perder la navegacion interna del iframe.
- Service worker actualizado a `edumind-board-v8`.

## Validacion

- `npm --workspace @edumind-board/web run typecheck`
- `npm --workspace @edumind-board/api run typecheck`
- `npm --workspace @edumind-board/web run check:geometry`
- `npm run build`
- `npm run smoke:web`
- Produccion:
  - `https://board.edumind.es/` responde `200`
  - `https://board.edumind.es/api/health` responde `200`
  - `https://board.edumind.es/api/resources?limit=1` responde `200`
  - `https://board.edumind.es/api/resources?limit=1` devuelve URLs `https://board.edumind.es/api/resource-content/...`
  - `https://board.edumind.es/api/resource-content/stem-projects/resumen_fils_innovacion.html` responde `200`
  - `https://board.edumind.es/sw.js` sirve `edumind-board-v8`

## Riesgos abiertos

- Falta prueba visual automatizada con navegador real para flujos de arrastre, escritura y selector de recursos.
- La tinta anclada ya acompana movimiento y rotacion del contenedor. Si se redimensiona un contenedor despues de escribir, los trazos conservan sus coordenadas locales actuales; una fase posterior puede incorporar escalado proporcional por version de marco.
- Base 10 ya incorpora piezas libres arrastrables y agrupacion. La fase siguiente puede refinar seleccion multiple, canje por proximidad espacial y desagrupacion por manipulacion directa.
- Los solidos del lienzo son representaciones 2.5D. La navegacion tridimensional real deberia abordarse como widget dedicado con motor 3D, camara orbital y pruebas visuales especificas.
