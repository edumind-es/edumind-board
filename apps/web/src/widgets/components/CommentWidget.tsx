// Comentario asíncrono con estado (abierto/resuelto/bloqueado).
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";

export function CommentWidget({ element }: { element: Extract<BoardElement, { type: "comment" }> }) {
  const { text, author, status, color, createdAt } = element.data;
  const width = element.width;
  const height = element.height;
  const pad = Math.max(14, Math.min(22, width * 0.06));
  const statusMeta = {
    open: { label: "Abierto", color: "#1a5fa8" },
    resolved: { label: "Resuelto", color: "#2f9f72" },
    blocked: { label: "Bloqueado", color: "#c45d3e" }
  }[status];
  const date = (() => {
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("es");
  })();

  return (
    <>
      <Rect width={width} height={height} fill={color} stroke={statusMeta.color} strokeWidth={1.8} cornerRadius={8}
        shadowColor="rgba(34,48,47,0.22)" shadowBlur={8} shadowOffset={{ x: 0, y: 4 }} shadowOpacity={0.22} />
      <Rect width={width} height={5} fill={statusMeta.color} cornerRadius={8} />
      <Text text={text} x={pad} y={pad + 10} width={width - pad * 2} height={Math.max(42, height - pad * 2 - 44)}
        fill="#22302f" fontSize={Math.max(13, Math.min(20, height * 0.12))} lineHeight={1.18} wrap="word" ellipsis />
      <Rect x={pad} y={height - pad - 25} width={Math.min(96, width * 0.36)} height={24}
        fill="#ffffff" opacity={0.78} cornerRadius={6} />
      <Text text={statusMeta.label} x={pad + 8} y={height - pad - 19} width={Math.min(80, width * 0.3)}
        fill={statusMeta.color} fontSize={11} fontStyle="bold" />
      <Text text={[author, date].filter(Boolean).join(" · ")} x={pad + Math.min(108, width * 0.4)} y={height - pad - 18}
        width={Math.max(60, width - pad * 2 - Math.min(108, width * 0.4))}
        align="right" fill="#5f6f6d" fontSize={11} ellipsis />
    </>
  );
}
