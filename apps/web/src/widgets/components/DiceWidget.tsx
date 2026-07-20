// Dado configurable (2-100 caras) con animación de tirada.
import { useEffect, useRef, useState } from "react";
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";

export function DiceWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "dice" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const [display, setDisplay] = useState(element.data.value);
  const rollingRef = useRef(false);

  useEffect(() => { setDisplay(element.data.value); }, [element.data.value]);

  function roll() {
    if (!liveControls || rollingRef.current) return;
    rollingRef.current = true;
    const sides = element.data.sides ?? 6;
    let count = 0;
    const total = 14;
    const id = setInterval(() => {
      setDisplay(Math.floor(Math.random() * sides) + 1);
      count++;
      if (count >= total) {
        clearInterval(id);
        const result = Math.floor(Math.random() * sides) + 1;
        setDisplay(result);
        updateElementData(element.id, { value: result });
        rollingRef.current = false;
      }
    }, 70);
  }

  const accent = element.data.color ?? "#c45d3e";
  const fontSize = Math.min(96, Math.floor(element.height * 0.5));
  const cy = element.height / 2;
  return (
    <>
      <Rect width={element.width} height={element.height} fill="#fffaf0" stroke={accent}
        strokeWidth={3} cornerRadius={16} />
      <Text text={String(display)} width={element.width} y={cy - Math.round(fontSize * 0.6)}
        align="center" fill={accent} fontSize={fontSize} fontStyle="bold" />
      {liveControls && (
        <Text text="toca para tirar" y={element.height - 22} width={element.width}
          align="center" fill="#a8a49c" fontSize={12} />
      )}
      <Rect width={element.width} height={element.height} fill="transparent" cornerRadius={16}
        onClick={(e) => { e.cancelBubble = true; roll(); }}
        onTap={(e) => { e.cancelBubble = true; roll(); }} />
    </>
  );
}
