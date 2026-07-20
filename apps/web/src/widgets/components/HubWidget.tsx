// Hub de apps EDUmind: tarjeta express o placeholder para modo embed.
import { Group, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";
import { getHubApp } from "../../lib/hubApps";

export function HubWidget({
  element,
  liveControls,
  guestMode = false
}: {
  element: Extract<BoardElement, { type: "hub" }>;
  liveControls: boolean;
  guestMode?: boolean;
}) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const updateElement = useBoardStore((s) => s.updateElement);
  const app = getHubApp(element.data.appId);
  const { width, height } = element;
  const pad = 16;
  const isEmbed = element.data.mode === "embed";
  // En modo guest usar guestUrl si existe (acceso sin cuenta EDUmind)
  const targetUrl = (guestMode && app?.guestUrl) ? app.guestUrl : (app?.url ?? "");

  if (!app) return <Rect width={width} height={height} fill="#f1eee8" cornerRadius={10} />;

  if (isEmbed) {
    // En modo embed el iframe HTML overlay hace el trabajo real.
    // El widget Konva muestra el placeholder con opción de fallback a nueva pestaña.
    const fz = Math.max(13, Math.min(20, height * 0.1));
    const btnH = Math.max(26, height * 0.18);
    const btnFz = Math.max(10, Math.min(14, btnH * 0.42));
    const btnW = Math.min(width - pad * 2, 180);
    const btnY = height - btnH - pad * 0.6;
    return (
      <>
        <Rect width={width} height={height} fill={app.bgColor} cornerRadius={10} stroke={app.color} strokeWidth={1.5} />
        <Rect width={width} height={4} fill={app.color} cornerRadius={10} />
        <Text text={`${app.emoji}  ${app.name}`} x={pad} y={Math.max(12, height * 0.1)}
          width={width - pad * 2} fill={app.color} fontSize={fz} fontStyle="bold" />
        <Text text="Cargando app…" x={pad} y={Math.max(12, height * 0.1) + fz + 8}
          width={width - pad * 2} fill="#5c5853" fontSize={Math.max(10, fz * 0.7)} opacity={0.7} />
        {liveControls && (
          <Group x={(width - btnW) / 2} y={btnY}
            onClick={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}
            onTap={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}>
            <Rect width={btnW} height={btnH} fill={app.color} cornerRadius={6} />
            <Text text="Si no carga, abrir →" y={(btnH - btnFz) / 2}
              width={btnW} align="center" fill="#fff" fontSize={btnFz} />
          </Group>
        )}
      </>
    );
  }

  // Modo express: tarjeta de la app con acciones
  const titleFz = Math.max(14, Math.min(22, height * 0.13));
  const descFz = Math.max(10, Math.min(15, height * 0.09));
  const emojiFz = Math.max(20, Math.min(40, height * 0.22));
  const btnH = Math.max(28, height * 0.2);
  const btnY = height - btnH - pad * 0.6;
  const btnFz = Math.max(11, Math.min(15, btnH * 0.44));
  const btnW = (width - pad * 2 - 8) / 2;

  return (
    <>
      <Rect width={width} height={height} fill={app.bgColor} cornerRadius={10} />
      <Rect width={width} height={4} fill={app.color} cornerRadius={10} />

      {/* Emoji grande */}
      <Text text={app.emoji} x={0} y={Math.max(10, height * 0.1)} width={width}
        align="center" fontSize={emojiFz} />

      {/* Nombre */}
      <Text text={app.name} x={pad} y={Math.max(10, height * 0.1) + emojiFz + 6}
        width={width - pad * 2} align="center"
        fill={app.color} fontSize={titleFz} fontStyle="bold" />

      {/* Descripción */}
      <Text text={app.description} x={pad} y={Math.max(10, height * 0.1) + emojiFz + titleFz + 12}
        width={width - pad * 2} align="center"
        fill="#3d3a36" fontSize={descFz} opacity={0.75} lineHeight={1.3} />

      {liveControls && (
        <>
          {/* Botón: Abrir en nueva pestaña — usa guestUrl si está en modo alumno */}
          <Group x={pad} y={btnY}
            onClick={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}
            onTap={(e) => { e.cancelBubble = true; window.open(targetUrl, "_blank", "noopener"); }}>
            <Rect width={btnW} height={btnH} fill={app.color} cornerRadius={6} />
            <Text text="Abrir →" y={(btnH - btnFz) / 2} width={btnW}
              align="center" fill="#fff" fontSize={btnFz} />
          </Group>

          {/* Botón: Embeber en el board */}
          <Group x={pad + btnW + 8} y={btnY}
            onClick={(e) => {
              e.cancelBubble = true;
              updateElementData(element.id, { mode: "embed" });
              updateElement(element.id, {
                width: Math.max(element.width, element.data.appId === "pasos" ? 1180 : 920),
                height: Math.max(element.height, element.data.appId === "pasos" ? 760 : 560)
              });
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              updateElementData(element.id, { mode: "embed" });
              updateElement(element.id, {
                width: Math.max(element.width, element.data.appId === "pasos" ? 1180 : 920),
                height: Math.max(element.height, element.data.appId === "pasos" ? 760 : 560)
              });
            }}>
            <Rect width={btnW} height={btnH} fill="#fff" stroke={app.color} strokeWidth={1.5} cornerRadius={6} />
            <Text text="Embed ↗" y={(btnH - btnFz) / 2} width={btnW}
              align="center" fill={app.color} fontSize={btnFz} />
          </Group>
        </>
      )}
    </>
  );
}

export function withEmbedParams(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("embed", "1");
    url.searchParams.set("board", "1");
    url.searchParams.set("sso", "edumind");
    url.searchParams.set("parent_origin", window.location.origin);
    return url.toString();
  } catch {
    return rawUrl;
  }
}
