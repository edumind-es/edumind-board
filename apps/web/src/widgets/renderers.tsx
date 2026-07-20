// Despachador central de renderizado de widgets.
// Cada tipo de elemento resuelve aquí a su componente; el canvas no conoce
// widgets concretos. Para añadir un widget: crear su componente en
// components/, registrar metadatos en registry.ts y añadir su caso aquí.
import { Rect, Text } from "react-konva";
import type { BoardElement } from "@edumind-board/shared";
import { CanvasRaster } from "./components/shared";
import { PictogramSequenceWidget } from "./components/PictogramSequenceWidget";
import { Semaphore } from "./components/SemaphoreWidget";
import { TimerWidget } from "./components/TimerWidget";
import { FileCard } from "./components/FileCard";
import { ClockWidget } from "./components/ClockWidget";
import { DiceWidget } from "./components/DiceWidget";
import { SpinnerWidget } from "./components/SpinnerWidget";
import { GuidelinesWidget } from "./components/GuidelinesWidget";
import { MathWidget } from "./components/MathWidget";
import { BaseTenWidget } from "./components/BaseTenWidget";
import { FractionWidget } from "./components/FractionWidget";
import { AlgorithmWidget } from "./components/AlgorithmWidget";
import { LogicWidget } from "./components/LogicWidget";
import { GridWidget } from "./components/GridWidget";
import { TableWidget } from "./components/TableWidget";
import { CommentWidget } from "./components/CommentWidget";
import { ConnectorWidget } from "./components/ConnectorWidget";
import { FlowWidget } from "./components/FlowWidget";
import { QRWidget } from "./components/QRWidget";
import { DrawingWidget } from "./components/DrawingWidget";
import { NoiseWidget } from "./components/NoiseWidget";
import { HubWidget } from "./components/HubWidget";
import { Mates3DWidget } from "./components/Mates3DWidget";
import { MindmapWidget } from "./components/MindmapWidget";
import { DictadoNumericoWidget } from "./components/DictadoNumericoWidget";

export type WidgetRenderContext = {
  liveControls: boolean;
  guestMode: boolean;
};

export function renderWidget(element: BoardElement, ctx: WidgetRenderContext) {
  switch (element.type) {
    case "note": {
      const noteFontSize = Math.max(10, Math.min(60, Math.round(element.height / 8)));
      return (
        <>
          <Rect width={element.width} height={element.height} fill={element.data.color} cornerRadius={12} />
          <Text text={element.data.text} x={18} y={18} width={element.width - 36} height={element.height - 36}
            fill="#22302f" fontSize={noteFontSize} lineHeight={1.25} wrap="word" />
        </>
      );
    }
    case "text":
      return (
        <Text text={element.data.text} width={element.width} height={element.height}
          fill={element.data.color} fontSize={element.data.fontSize} lineHeight={1.15} wrap="word" />
      );
    case "image":
      return <CanvasRaster url={element.data.url} width={element.width} height={element.height} />;
    case "file":
      return <FileCard element={element} />;
    case "iframe":
      // El contenido real vive en el overlay HTML; esto es el marco visible en el canvas
      return (
        <>
          <Rect width={element.width} height={element.height} fill="#fffaf0" stroke="#2a7a6d" cornerRadius={12} />
          <Text text={element.data.title} x={18} y={18} width={element.width - 36} fill="#22302f" fontSize={22} />
          <Text text={element.data.url} x={18} y={58} width={element.width - 36} fill="#5f6f6d" fontSize={15} />
        </>
      );
    case "timer":
      return <TimerWidget element={element} liveControls={ctx.liveControls} />;
    case "semaphore":
      return <Semaphore element={element} liveControls={ctx.liveControls} />;
    case "clock":
      return <ClockWidget element={element} />;
    case "dice":
      return <DiceWidget element={element} liveControls={ctx.liveControls} />;
    case "spinner":
      return <SpinnerWidget element={element} liveControls={ctx.liveControls} />;
    case "guidelines":
      return <GuidelinesWidget element={element} />;
    case "math":
      return <MathWidget element={element} />;
    case "base10":
      return <BaseTenWidget element={element} liveControls={ctx.liveControls} />;
    case "fraction":
      return <FractionWidget element={element} />;
    case "algorithm":
      return <AlgorithmWidget element={element} />;
    case "logic":
      return <LogicWidget element={element} />;
    case "grid":
      return <GridWidget element={element} />;
    case "table":
      return <TableWidget element={element} />;
    case "pictos":
      return <PictogramSequenceWidget element={element} liveControls={ctx.liveControls} />;
    case "drawing":
      return <DrawingWidget element={element} liveControls={ctx.liveControls} />;
    case "noise":
      return <NoiseWidget element={element} liveControls={ctx.liveControls} />;
    case "qr":
      return <QRWidget element={element} />;
    case "comment":
      return <CommentWidget element={element} />;
    case "connector":
      return <ConnectorWidget element={element} />;
    case "flow":
      return <FlowWidget element={element} />;
    case "hub":
      return <HubWidget element={element} liveControls={ctx.liveControls} guestMode={ctx.guestMode} />;
    case "mates3d":
      // La escena WebGL se monta como overlay HTML; aquí solo el marco
      return <Mates3DWidget element={element} />;
    case "mindmap":
      // El editor de mapa se monta como overlay HTML; aquí solo el marco
      return <MindmapWidget element={element} />;
    case "dictadoNum":
      return <DictadoNumericoWidget element={element} liveControls={ctx.liveControls} />;
    default:
      return null;
  }
}
