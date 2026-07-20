// Ruleta de nombres/opciones con animación de giro.
import { useEffect, useRef, useState } from "react";
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { useBoardStore } from "../../lib/store";

export function SpinnerWidget({
  element, liveControls
}: { element: Extract<BoardElement, { type: "spinner" }>; liveControls: boolean }) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const items = element.data.items;
  const [display, setDisplay] = useState<string>(element.data.result ?? items[0] ?? "—");
  const spinningRef = useRef(false);

  useEffect(() => {
    setDisplay(element.data.result ?? items[0] ?? "—");
  }, [element.data.result, items]);

  function spin() {
    if (!liveControls || spinningRef.current || items.length < 2) return;
    spinningRef.current = true;
    let count = 0;
    let delay = 55;
    function step() {
      const idx = Math.floor(Math.random() * items.length);
      setDisplay(items[idx]);
      count++;
      if (count < 18) {
        if (count > 10) delay = Math.round(delay * 1.4);
        setTimeout(step, delay);
      } else {
        const finalIdx = Math.floor(Math.random() * items.length);
        setDisplay(items[finalIdx]);
        updateElementData(element.id, { result: items[finalIdx] });
        spinningRef.current = false;
      }
    }
    step();
  }

  const hasResult = !!element.data.result;
  const fontSize = Math.min(40, Math.floor(element.width / Math.max(4, (display.length || 1))));
  const cy = element.height / 2;
  return (
    <>
      <Rect width={element.width} height={element.height}
        fill={hasResult ? "#d4edda" : "#fffaf0"}
        stroke="#2a7a6d" strokeWidth={2} cornerRadius={14} />
      {items.length === 0 ? (
        <Text text="Añade nombres\nen el Inspector" width={element.width} y={cy - 24}
          align="center" fill="#a8a49c" fontSize={16} lineHeight={1.4} />
      ) : (
        <Text text={display} width={element.width - 16} x={8} y={cy - Math.round(fontSize * 0.65)}
          align="center" fill="#22302f" fontSize={fontSize} fontStyle="bold" lineHeight={1.2} />
      )}
      {liveControls && items.length >= 2 && (
        <Text text="▶  Toca para girar" y={element.height - 26} width={element.width}
          align="center" fill="#2a7a6d" fontSize={13} />
      )}
      <Rect width={element.width} height={element.height} fill="transparent" cornerRadius={14}
        onClick={(e) => { e.cancelBubble = true; spin(); }}
        onTap={(e) => { e.cancelBubble = true; spin(); }} />
    </>
  );
}
