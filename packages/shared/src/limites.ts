/**
 * Límites de tamaño, en un solo sitio.
 *
 * ⛔ **EDUmind Board no guarda archivos de nadie.** Ni PDF, ni imágenes, ni
 * documentos: no es su sitio y no queremos ser depositarios de material que no
 * nos pertenece. Los archivos que el docente pone en un tablero viven en SU
 * navegador (IndexedDB, esquema `local:<id>`) y no salen de ahí.
 *
 * Por eso aquí ya no hay «límite de subida»: no hay subida. Lo que queda son
 * dos cifras muy distintas entre sí:
 *
 *   - lo que cabe en el navegador del docente (`MAX_LOCAL_BYTES`), que puede
 *     ser enorme porque no cuesta disco nuestro;
 *   - lo que cabe en una petición al servidor (`MAX_CUERPO_PETICION_BYTES`),
 *     que solo tiene que dar para el JSON de un tablero.
 *
 * Historia, para que no se repita: hubo cuatro cifras distintas repartidas por
 * el sistema (nginx 3 MB, Fastify 4 MB, la ruta 12 MB, el navegador 8 MB). La
 * más pequeña, la de nginx, no la conocía nadie. La interfaz prometía 8 MB, un
 * PDF de 4 MB se rechazaba antes de llegar al servidor, y el mensaje decía
 * «inténtalo de nuevo» — un consejo que nunca podía funcionar. Cualquier
 * cambio se hace AQUÍ y se propaga; `scripts/check-limite-subida.mjs` comprueba
 * que la cifra de nginx sigue cuadrando.
 */

/**
 * Tamaño máximo de un archivo que se queda EN EL NAVEGADOR del docente.
 *
 * No viaja a ningún sitio: se guarda en IndexedDB (almacén
 * `edumind-board-archivos`) y el tablero solo referencia `local:<id>`. Lo que
 * manda de verdad es la cuota que el navegador conceda al origen, no nuestro
 * disco. 512 MB deja sitio de sobra a una ficha con muchas imágenes sin llegar
 * a cifras en las que el navegador empieza a expulsar datos.
 */
export const MAX_LOCAL_BYTES = 512 * 1024 * 1024;

/**
 * Tamaño máximo del cuerpo de una petición al API.
 *
 * Solo tiene que dar para el JSON de un tablero: texto, posiciones, nodos de
 * mapa mental y trazos de tinta. Los archivos NO van aquí. Se deja holgado
 * porque un tablero muy trabajado con mucha tinta crece, y quedarse corto se
 * manifiesta como un 413 opaco al publicar.
 */
export const MAX_CUERPO_PETICION_BYTES = 12 * 1024 * 1024;

/** Lo que hay que poner en `client_max_body_size` de nginx, en megas. */
export const NGINX_MAX_BODY_MB = Math.ceil(MAX_CUERPO_PETICION_BYTES / (1024 * 1024));

export function enMegas(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1).replace(".", ",")} MB`;
}
