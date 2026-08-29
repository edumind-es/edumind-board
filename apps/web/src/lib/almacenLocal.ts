// Almacén de archivos grandes EN EL NAVEGADOR.
//
// Por qué existe: los archivos del tablero tenían dos caminos, y los dos
// limitados por el servidor — subir (8 MB) o empotrar en base64 dentro del
// propio tablero (1,5 MB). Una ficha con muchas imágenes puede pesar 200 MB y
// no tiene por qué salir del ordenador del docente: se queda en IndexedDB y el
// tablero solo guarda `local:<id>`.
//
// Contrapartida, que la interfaz tiene que decir: un archivo local vive en ESTE
// navegador. No se publica, no se ve en la vista compartida ni en la del aula,
// y se pierde si se borran los datos del sitio.
import { openDB } from "idb";
import { MAX_LOCAL_BYTES } from "@edumind-board/shared";

// Base propia, aparte de la de los tableros: así no hay que subir su versión.
//
// Se abre la PRIMERA vez que hace falta, no al importar el módulo: FileCard lo
// importa y las pruebas de widgets renderizan sobre un canvas de node, donde no
// hay IndexedDB. Abrirla arriba tumbaba el fichero de pruebas entero.
let db: ReturnType<typeof openDB> | null = null;

function abrir() {
  if (!db) {
    db = openDB("edumind-board-archivos", 1, {
      upgrade(base) {
        base.createObjectStore("archivos");
      }
    });
  }
  return db;
}

export type ArchivoLocal = {
  blob: Blob;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export const ESQUEMA_LOCAL = "local:";

export function esUrlLocal(url: string) {
  return url.startsWith(ESQUEMA_LOCAL);
}

export function idDeUrlLocal(url: string) {
  return url.slice(ESQUEMA_LOCAL.length);
}

export class ArchivoDemasiadoGrande extends Error {
  constructor() {
    super("El archivo supera el máximo que se puede guardar en el navegador");
    this.name = "ArchivoDemasiadoGrande";
  }
}

/** Guarda el archivo tal cual (sin base64) y devuelve su URL `local:<id>`. */
export async function guardarArchivoLocal(id: string, file: File): Promise<string> {
  if (file.size > MAX_LOCAL_BYTES) throw new ArchivoDemasiadoGrande();
  const base = await abrir();
  const registro: ArchivoLocal = {
    blob: file,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    createdAt: new Date().toISOString()
  };
  await base.put("archivos", registro, id);
  return `${ESQUEMA_LOCAL}${id}`;
}

export async function leerArchivoLocal(id: string): Promise<ArchivoLocal | undefined> {
  const base = await abrir();
  return (await base.get("archivos", id)) as ArchivoLocal | undefined;
}

export async function borrarArchivoLocal(id: string) {
  const base = await abrir();
  await base.delete("archivos", id);
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

// Las object URL se cachean por id: crear una nueva en cada render dejaría
// blobs vivos hasta recargar la página, y con archivos de cientos de megas eso
// se nota. No se revocan al desmontar porque el mismo archivo puede estar en
// varios sitios (lienzo, presentación) a la vez.
const objectUrls = new Map<string, string>();
const enCurso = new Map<string, Promise<string | null>>();

/** URL reproducible (`blob:`) del archivo local, o null si ya no está. */
export function urlDeArchivoLocal(id: string): Promise<string | null> {
  const cacheada = objectUrls.get(id);
  if (cacheada) return Promise.resolve(cacheada);
  const pendiente = enCurso.get(id);
  if (pendiente) return pendiente;

  const promesa = leerArchivoLocal(id)
    .then((registro) => {
      if (!registro) return null;
      const url = URL.createObjectURL(registro.blob);
      objectUrls.set(id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => { enCurso.delete(id); });

  enCurso.set(id, promesa);
  return promesa;
}

/** Espacio que ocupan los archivos locales, para poder decírselo al docente. */
export async function espacioLocalUsado(): Promise<number> {
  const base = await abrir();
  const registros = (await base.getAll("archivos")) as ArchivoLocal[];
  return registros.reduce((total, registro) => total + (registro.sizeBytes ?? 0), 0);
}

/** Ids de archivos locales que ya no referencia ningún tablero. */
export async function idsHuerfanos(urlsEnUso: string[]): Promise<string[]> {
  const base = await abrir();
  const enUso = new Set(urlsEnUso.filter(esUrlLocal).map(idDeUrlLocal));
  const claves = (await base.getAllKeys("archivos")) as string[];
  return claves.filter((clave) => !enUso.has(clave));
}
