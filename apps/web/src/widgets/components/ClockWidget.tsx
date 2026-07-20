// Reloj de aula digital/analógico.
import { useEffect, useState } from "react";
import { Circle, Line, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function ClockWidget({ element }: { element: Extract<BoardElement, { type: "clock" }> }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { style, showSeconds, color, bgColor } = element.data;
  const cx = element.width / 2;
  const cy = element.height / 2;

  if (style === "analog") {
    const r = Math.min(cx, cy) - 10;
    const hAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI * 2 / 12);
    const mAngle = (now.getMinutes() + now.getSeconds() / 60) * (Math.PI * 2 / 60);
    const sAngle = now.getSeconds() * (Math.PI * 2 / 60);
    const handEnd = (angle: number, len: number) => [cx + len * Math.sin(angle), cy - len * Math.cos(angle)];
    return (
      <>
        <Rect width={element.width} height={element.height} fill={bgColor} cornerRadius={8} />
        <Circle x={cx} y={cy} radius={r} stroke={color} strokeWidth={2.5} fill={bgColor} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = i * Math.PI * 2 / 12;
          const major = i % 3 === 0;
          return <Line key={i}
            points={[cx + (r - (major ? 10 : 6)) * Math.sin(a), cy - (r - (major ? 10 : 6)) * Math.cos(a),
                     cx + r * Math.sin(a), cy - r * Math.cos(a)]}
            stroke={color} strokeWidth={major ? 2.5 : 1.5} />;
        })}
        <Line points={[cx, cy, ...handEnd(hAngle, r * 0.52)]} stroke={color} strokeWidth={4} lineCap="round" />
        <Line points={[cx, cy, ...handEnd(mAngle, r * 0.76)]} stroke={color} strokeWidth={2.5} lineCap="round" />
        {showSeconds && <Line points={[cx, cy, ...handEnd(sAngle, r * 0.84)]} stroke="#c45d3e" strokeWidth={1.5} lineCap="round" />}
        <Circle x={cx} y={cy} radius={5} fill={color} />
      </>
    );
  }

  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const timeStr = showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  const fontSize = Math.min(80, Math.floor(element.width / (showSeconds ? 5.2 : 3.4)));
  return (
    <>
      <Rect width={element.width} height={element.height} fill={bgColor} cornerRadius={8} />
      <Text text={timeStr} width={element.width} y={cy - Math.round(fontSize * 0.6)}
        align="center" fill={color} fontSize={fontSize} fontStyle="bold" fontFamily="monospace" />
    </>
  );
}
