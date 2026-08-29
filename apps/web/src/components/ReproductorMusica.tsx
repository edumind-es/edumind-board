// Reproductor de la música de aula.
//
// Audio nativo, no un iframe: la música la sirve nuestro propio servidor, así
// que suena entera, sin depender de la cuenta de nadie, y no se manda ni un
// dato del alumnado a un tercero.
//
// La atribución se ve siempre en pantalla. No es decoración: es la condición
// de la licencia CC BY con la que podemos usar esta música.
import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, SkipForward } from "lucide-react";

import { apiBaseUrl } from "../lib/api";
import { cargarCatalogoMusica, type PistaMusica } from "../lib/musicaCatalogo";

export function ReproductorMusica({
    modeId,
    titulo,
    pistaInicial,
    onPistaChange
}: {
    modeId: string;
    titulo: string;
    pistaInicial?: string;
    onPistaChange?: (pistaId: string) => void;
}) {
    const [pistas, setPistas] = useState<PistaMusica[] | null>(null);
    const [indice, setIndice] = useState(0);
    const [sonando, setSonando] = useState(false);
    const [fallo, setFallo] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        let cancelado = false;
        cargarCatalogoMusica()
            .then((catalogo) => {
                if (cancelado) return;
                const modo = catalogo.modos.find((m) => m.id === modeId);
                const lista = modo?.pistas ?? [];
                setPistas(lista);
                const inicio = pistaInicial ? lista.findIndex((p) => p.id === pistaInicial) : -1;
                setIndice(inicio >= 0 ? inicio : 0);
            })
            .catch(() => {
                if (!cancelado) setFallo("No hay música instalada en este servidor.");
            });
        return () => { cancelado = true; };
    }, [modeId, pistaInicial]);

    const pista = pistas?.[indice];

    function alternar() {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) void audio.play().catch(() => setFallo("El navegador no ha dejado reproducir."));
        else audio.pause();
    }

    function siguiente() {
        if (!pistas || pistas.length === 0) return;
        const proximo = (indice + 1) % pistas.length;
        setIndice(proximo);
        onPistaChange?.(pistas[proximo]!.id);
    }

    if (fallo) {
        return (
            <div className="musica-panel musica-panel-vacio">
                <Music2 size={18} aria-hidden="true" />
                <p>{fallo}</p>
            </div>
        );
    }

    if (!pistas) {
        return <div className="musica-panel musica-panel-vacio"><p>Cargando música…</p></div>;
    }

    if (pistas.length === 0) {
        return (
            <div className="musica-panel musica-panel-vacio">
                <Music2 size={18} aria-hidden="true" />
                <p>Este modo todavía no tiene pistas.</p>
            </div>
        );
    }

    return (
        <div className="musica-panel">
            <header className="musica-cabecera">
                <Music2 size={16} aria-hidden="true" />
                <strong>{titulo}</strong>
            </header>

            <p className="musica-pista">{pista?.titulo}</p>

            <div className="musica-controles">
                <button type="button" onClick={alternar}
                    aria-label={sonando ? "Pausar música" : "Reproducir música"}>
                    {sonando ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button type="button" onClick={siguiente} aria-label="Pista siguiente"
                    disabled={pistas.length < 2}>
                    <SkipForward size={18} />
                </button>
                <span className="musica-posicion">{indice + 1}/{pistas.length}</span>
            </div>

            {/* La atribución es obligatoria por la licencia CC BY, no un extra. */}
            <p className="musica-atribucion">{pista?.atribucion}</p>

            <audio
                ref={audioRef}
                src={pista ? `${apiBaseUrl}/api/musica/pista/${encodeURIComponent(pista.id)}` : undefined}
                onPlay={() => setSonando(true)}
                onPause={() => setSonando(false)}
                onEnded={siguiente}
                onError={() => setFallo("No se pudo cargar esta pista.")}
                preload="none"
            />
        </div>
    );
}
