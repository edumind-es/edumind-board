// Tarjeta de archivo (imagen inline o placeholder PDF).
//
// La URL puede ser `local:<id>` — un archivo grande que vive en IndexedDB de
// este navegador y no ha viajado al servidor. `useArchivoUrl` la resuelve.
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { esUrlLocal } from "../../lib/almacenLocal";
import { useArchivoUrl } from "../../lib/useArchivoUrl";
import { CanvasRaster } from "./shared";

export function FileCard({ element }: { element: Extract<BoardElement, { type: "file" }> }) {
  const { url, estado } = useArchivoUrl(element.data.url);
  const esLocal = esUrlLocal(element.data.url);

  if (estado !== "listo" || !url) {
    return (
      <>
        <Rect width={element.width} height={element.height} fill="#f7f5f0" stroke="#c9c3b6" cornerRadius={12} dash={[8, 6]} />
        <Text
          text={estado === "cargando" ? "Abriendo archivo…" : "Este archivo se guardó en otro navegador"}
          x={18} y={18} width={element.width - 36} fill="#687876" fontSize={17} />
        <Text text={element.data.name} x={18} y={62} width={element.width - 36} fill="#22302f" fontSize={19} />
      </>
    );
  }

  if (element.data.kind === "image") {
    return <CanvasRaster url={url} width={element.width} height={element.height} />;
  }

  return (
    <>
      <Rect width={element.width} height={element.height} fill="#fffaf0" stroke="#d94b3d" cornerRadius={12} />
      <Text text="PDF" x={18} y={18} fill="#d94b3d" fontSize={34} fontStyle="bold" />
      <Text text={element.data.name} x={18} y={70} width={element.width - 36} fill="#22302f" fontSize={20} />
      <Text
        text={esLocal
          ? "Guardado solo en este navegador: no viaja al publicar"
          : "Visible en presentacion y vista compartida"}
        x={18} y={112} width={element.width - 36} fill="#687876" fontSize={15} />
    </>
  );
}
