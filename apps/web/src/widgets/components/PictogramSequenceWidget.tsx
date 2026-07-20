// Secuencia visual de pictogramas ARASAAC (rutinas, patrones).
import { Circle, Group, Image, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";
import { useCanvasImage } from "./shared";

function PictogramImage({
  url, x, y, width, height
}: { url: string; x: number; y: number; width: number; height: number }) {
  const image = useCanvasImage(url);
  return image ? (
    <Image image={image} x={x} y={y} width={width} height={height} cornerRadius={10} />
  ) : (
    <>
      <Rect x={x} y={y} width={width} height={height} fill="#fffaf0" stroke="#d9d2c5" cornerRadius={10} />
      <Text text="..." x={x} y={y + height / 2 - 10} width={width} align="center" fill="#6b6258" fontSize={18} />
    </>
  );
}

export function PictogramSequenceWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "pictos" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const { width, height } = element;
  const { items, mode, activeIndex, showLights, repeatCount, title } = element.data;
  const pad = Math.max(12, Math.min(22, width * 0.03));
  const titleH = Math.max(28, Math.min(42, height * 0.13));
  const creditH = 28;
  const lightH = showLights ? Math.max(20, Math.min(34, height * 0.1)) : 6;
  const contentY = pad + titleH;
  const contentH = Math.max(80, height - contentY - creditH - lightH - pad);
  const displayItems = mode === "pattern" && items.length > 0
    ? Array.from({ length: repeatCount }, (_, index) => items[index % items.length])
    : items;
  const count = Math.max(1, displayItems.length);
  const gap = Math.max(8, Math.min(14, width * 0.015));
  const cardW = Math.max(64, Math.min(150, (width - pad * 2 - gap * (count - 1)) / count));
  const cardH = contentH;
  const startX = pad + Math.max(0, (width - pad * 2 - (cardW * count + gap * (count - 1))) / 2);
  const pictoSize = Math.max(40, Math.min(cardW - 16, cardH - 56));
  const active = Math.min(Math.max(activeIndex, 0), Math.max(0, count - 1));

  return (
    <>
      <Rect width={width} height={height} fill="#fffdf4" stroke="#2a7a6d" strokeWidth={1.5} cornerRadius={12} />
      <Rect width={width} height={5} fill="#2a7a6d" cornerRadius={12} />
      <Text text={title || "Secuencia visual"} x={pad} y={pad} width={width - pad * 2}
        fill="#22302f" fontSize={Math.max(16, Math.min(28, titleH * 0.62))} fontStyle="bold" />

      {displayItems.length === 0 ? (
        <Text text="Añade pictogramas ARASAAC desde el inspector." x={pad} y={height / 2 - 12}
          width={width - pad * 2} align="center" fill="#6b6258" fontSize={18} />
      ) : displayItems.map((item, index) => {
        const x = startX + index * (cardW + gap);
        const selected = index === active;
        const y = contentY;
        return (
          <Group key={`${item.id}-${index}`} x={x} y={y}
            onClick={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { activeIndex: index }); }}
            onTap={(e) => { e.cancelBubble = true; if (liveControls) updateElementData(element.id, { activeIndex: index }); }}>
            <Rect width={cardW} height={cardH} fill={selected ? "#e4f4ee" : "#ffffff"}
              stroke={selected ? "#2a7a6d" : "#d9d2c5"} strokeWidth={selected ? 3 : 1.2} cornerRadius={10} />
            <PictogramImage url={item.url} x={(cardW - pictoSize) / 2} y={10} width={pictoSize} height={pictoSize} />
            <Text text={item.label} x={8} y={Math.min(cardH - 38, pictoSize + 18)} width={cardW - 16}
              height={34} align="center" fill="#22302f" fontSize={Math.max(11, Math.min(16, cardW * 0.12))}
              lineHeight={1.05} wrap="word" />
          </Group>
        );
      })}

      {showLights && displayItems.length > 0 && displayItems.map((item, index) => {
        const cx = startX + index * (cardW + gap) + cardW / 2;
        const cy = height - creditH - lightH / 2 - 2;
        const selected = index === active;
        return (
          <Circle key={`light-${item.id}-${index}`} x={cx} y={cy} radius={Math.max(7, Math.min(13, lightH * 0.34))}
            fill={selected ? "#2f9f72" : "#d9d2c5"} stroke={selected ? "#166748" : "#b8afa3"}
            strokeWidth={selected ? 2 : 1} shadowColor={selected ? "#2f9f72" : undefined} shadowBlur={selected ? 10 : 0} />
        );
      })}

      <Text text="Pictogramas: Gobierno de Aragón · Sergio Palao · ARASAAC · CC BY-NC-SA"
        x={pad} y={height - creditH + 5} width={width - pad * 2} align="center"
        fill="#6b6258" fontSize={Math.max(9, Math.min(12, height * 0.035))} />
    </>
  );
}
