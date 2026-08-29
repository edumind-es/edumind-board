// Catálogo de música de aula que sirve el propio servidor.
import { apiBaseUrl } from "./api";

export type PistaMusica = {
    id: string;
    titulo: string;
    duracion: number;
    instrumentos: string;
    fichero: string;
    atribucion: string;
};

export type CatalogoMusica = {
    licencia: { nombre: string; url: string };
    autor: { nombre: string; url: string };
    modos: { id: string; razon: string; pistas: PistaMusica[] }[];
};

// Se pide una vez por sesión: el catálogo sólo cambia al recurar la música.
let enCurso: Promise<CatalogoMusica> | null = null;

export function cargarCatalogoMusica(): Promise<CatalogoMusica> {
    if (!enCurso) {
        enCurso = fetch(`${apiBaseUrl}/api/musica/catalogo`)
            .then((r) => {
                if (!r.ok) throw new Error(`catálogo no disponible (${r.status})`);
                return r.json() as Promise<CatalogoMusica>;
            })
            .catch((error) => {
                enCurso = null;   // que un fallo de red no deje la app sin música para siempre
                throw error;
            });
    }
    return enCurso;
}
