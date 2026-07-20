// Helpers compartidos por los widgets del canvas.
import { useEffect, useState } from "react";
import { Group, Image, Rect, Text } from "react-konva";

export function useCanvasImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
  }, [url]);
  return image;
}

export function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CanvasRaster({ url, width, height }: { url: string; width: number; height: number }) {
  const image = useCanvasImage(url);
  return image ? (
    <Image image={image} width={width} height={height} cornerRadius={12} />
  ) : (
    <>
      <Rect width={width} height={height} fill="#f1eee8" cornerRadius={12} />
      <Text text="Imagen no disponible" width={width} y={height / 2 - 12} align="center" />
    </>
  );
}

export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function CountBadge({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect width={46} height={24} fill="#ffffff" stroke={color} strokeWidth={1.2} cornerRadius={12} />
      <Text text={text} width={46} y={4} align="center" fill={color} fontSize={12} fontStyle="bold" />
    </Group>
  );
}

export function responsiveUnit(width: number, height: number, baseWidth: number, baseHeight: number) {
  return Math.max(0.55, Math.min(1.75, Math.min(width / baseWidth, height / baseHeight)));
}

export function MiniControl({
  x, y, label, disabled, onClick
}: {
  x: number;
  y: number;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Group x={x} y={y}
      opacity={disabled ? 0.35 : 1}
      onClick={(e) => { e.cancelBubble = true; if (!disabled) onClick(); }}
      onTap={(e) => { e.cancelBubble = true; if (!disabled) onClick(); }}>
      <Rect width={28} height={24} fill="#ffffff" stroke="#d7e0e7" strokeWidth={1} cornerRadius={6} />
      <Text text={label} width={28} y={4} align="center" fill="#172b2a" fontSize={13} fontStyle="bold" />
    </Group>
  );
}
