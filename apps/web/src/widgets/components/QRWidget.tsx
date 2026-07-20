// Código QR generado en cliente (import dinámico de qrcode).
import { useEffect, useState } from "react";
import { Image, Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function QRWidget({ element }: { element: Extract<BoardElement, { type: "qr" }> }) {
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);
  const { text, label, bgColor, fgColor } = element.data;

  useEffect(() => {
    let cancelled = false;
    const size = Math.min(element.width, element.height) - (label ? 44 : 16);
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(text || " ", {
        width: Math.max(64, size),
        margin: 1,
        color: { dark: fgColor ?? "#22302f", light: bgColor ?? "#ffffff" }
      }))
      .then((url: string) => {
        if (cancelled) return;
        const img = new window.Image();
        img.onload = () => setQrImage(img);
        img.src = url;
      })
      .catch(() => { if (!cancelled) setQrImage(null); });
    return () => { cancelled = true; };
  }, [text, bgColor, fgColor, element.width, element.height, label]);

  const qrSize = Math.min(element.width, element.height) - (label ? 44 : 16);
  const qrX = (element.width - qrSize) / 2;

  return (
    <>
      <Rect width={element.width} height={element.height} fill={bgColor ?? "#ffffff"} cornerRadius={8} />
      {qrImage ? (
        <Image image={qrImage} x={qrX} y={8} width={qrSize} height={qrSize} />
      ) : (
        <Text text="Generando QR…" width={element.width} y={element.height / 2 - 12}
          align="center" fill="#a8a49c" fontSize={14} />
      )}
      {label ? (
        <Text text={label} y={element.height - 30} width={element.width}
          align="center" fill={fgColor ?? "#22302f"} fontSize={13} />
      ) : null}
    </>
  );
}
