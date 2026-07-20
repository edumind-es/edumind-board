// Nodo de diagrama de flujo (proceso, decisión, terminador, datos).
import { Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function FlowWidget({ element }: { element: Extract<BoardElement, { type: "flow" }> }) {
  const { text, shape, fill, stroke, textColor, fontSize } = element.data;
  const width = element.width;
  const height = element.height;
  const strokeWidth = 2.2;
  const body = (() => {
    if (shape === "decision") {
      return <Line points={[width / 2, 0, width, height / 2, width / 2, height, 0, height / 2]} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    }
    if (shape === "terminator") {
      return <Rect width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={height / 2} />;
    }
    if (shape === "data") {
      const skew = Math.min(34, width * 0.14);
      return <Line points={[skew, 0, width, 0, width - skew, height, 0, height]} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    }
    return <Rect width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={8} />;
  })();

  return (
    <>
      {body}
      <Text text={text} x={18} y={Math.max(12, height / 2 - fontSize)}
        width={width - 36} height={Math.max(24, fontSize * 2.4)}
        align="center" verticalAlign="middle" fill={textColor}
        fontSize={Math.min(fontSize, Math.max(12, height * 0.32))}
        fontStyle="bold" wrap="word" />
    </>
  );
}
