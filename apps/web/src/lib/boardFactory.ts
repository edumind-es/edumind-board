import type { BoardDocument, BoardElement } from "@edumind-board/shared";
import { newId } from "./ids";

export function createEmptyBoard(): BoardDocument {
  return {
    schemaVersion: 1,
    id: newId(),
    title: "Mi primer board",
    theme: "edumind",
    viewport: { x: 0, y: 0, zoom: 1 },
    elements: [
      {
        id: newId(),
        type: "note",
        x: 120,
        y: 120,
        width: 360,
        height: 180,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        locked: false,
        data: {
          text: "Prepara aqui la sesion: recursos, consignas y apoyos visuales.",
          color: "#fff3c4"
        }
      },
      {
        id: newId(),
        type: "semaphore",
        x: 540,
        y: 120,
        width: 160,
        height: 220,
        rotation: 0,
        zIndex: 2,
        opacity: 1,
        locked: false,
        data: { state: "green", label: "Ritmo de aula" }
      }
    ],
    ink: [],
    updatedAt: new Date().toISOString()
  };
}

export function createElement(type: BoardElement["type"]): BoardElement {
  const base = {
    id: newId(),
    x: 160,
    y: 120,
    width: 280,
    height: 160,
    rotation: 0,
    zIndex: Date.now(),
    opacity: 1,
    locked: false
  };

  switch (type) {
    case "text":
      return { ...base, type, height: 100, data: { text: "Nuevo texto", fontSize: 32, color: "#22302f" } };

    case "note":
      return { ...base, type, data: { text: "Nueva nota", color: "#fff3c4" } };

    case "image":
      return {
        ...base, type, width: 360, height: 240,
        data: { url: "https://placehold.co/720x480/faf8f4/22302f?text=EDUmind+Board", alt: "" }
      };

    case "file":
      return {
        ...base, type, width: 380, height: 260,
        data: { url: "data:application/pdf;base64,", name: "Documento.pdf", mimeType: "application/pdf", kind: "pdf" }
      };

    case "iframe":
      return {
        ...base, type, width: 520, height: 320,
        data: { url: "https://phet.colorado.edu/", title: "Recurso web", mode: "embed" }
      };

    case "timer":
      return {
        ...base, type, width: 240, height: 150,
        data: { label: "Temporizador", initialSeconds: 300, seconds: 300, running: false, style: "classic", accentColor: "#c45d3e" }
      };

    case "semaphore":
      return {
        ...base, type, width: 160, height: 220,
        data: { state: "green", label: "Semaforo" }
      };

    case "clock":
      return {
        ...base, type, width: 280, height: 140,
        data: { style: "digital", showSeconds: true, color: "#22302f", bgColor: "#fffaf0" }
      };

    case "dice":
      return {
        ...base, type, width: 180, height: 180,
        data: { value: 1, sides: 6, color: "#c45d3e" }
      };

    case "spinner":
      return {
        ...base, type, width: 320, height: 200,
        data: {
          items: ["Alumno 1", "Alumno 2", "Alumno 3", "Alumno 4", "Alumno 5"],
          result: null
        }
      };

    case "guidelines":
      return {
        ...base, type, width: 500, height: 300,
        data: { style: "montessori", lineColor: "#2a7a6d", bgColor: "#fffdf4", lines: 5 }
      };

    case "math":
      return {
        ...base, type, width: 300, height: 260,
        data: { operation: "sum", operandA: "", operandB: "", result: "", showResult: false, fontSize: 48 }
      };

    case "base10":
      return {
        ...base, type, width: 720, height: 420,
        data: {
          unitCount: 4,
          rodCount: 3,
          flatCount: 2,
          cubeCount: 0,
          mode: "placeValue",
          pieces: [],
          style: "3d",
          showValue: true,
          showPlaceLabels: true
        }
      };

    case "fraction":
      return {
        ...base, type, width: 520, height: 300,
        data: {
          numerator: 1,
          denominator: 2,
          model: "bar",
          compareNumerator: 1,
          compareDenominator: 3,
          showCompare: false,
          showLabels: true,
          color: "#e75f3c"
        }
      };

    case "algorithm":
      return {
        ...base, type, width: 420, height: 420,
        data: {
          operation: "add",
          operandA: "234",
          operandB: "156",
          result: "",
          strategy: "placeValue",
          showResult: false,
          showPlaceValue: true,
          showGrid: true
        }
      };

    case "logic":
      return {
        ...base, type, width: 620, height: 300,
        data: {
          mode: "pattern",
          pattern: ["circle", "square", "circle"],
          colors: ["#e75f3c", "#0f8f83", "#1a5fa8"],
          repeatCount: 9,
          hiddenIndex: 5,
          showAnswer: false,
          targetCount: 6
        }
      };

    case "hub":
      return {
        ...base, type, width: 360, height: 240,
        data: { appId: "motion", mode: "express" }
      };

    case "table":
      return {
        ...base, type, width: 480, height: 260,
        data: {
          rows: 4, cols: 3,
          cells: Array(12).fill(""),
          headerRow: true,
          borderColor: "#3d3a36",
          headerBg: "#c9c4bb",
          fontSize: 18
        }
      };

    case "pictos":
      return {
        ...base, type, width: 720, height: 320,
        data: {
          title: "Secuencia visual",
          mode: "sequence",
          activeIndex: 0,
          showLights: true,
          repeatCount: 6,
          items: []
        }
      };

    case "grid":
      return {
        ...base, type, width: 500, height: 400,
        data: { cellSize: 25, lineColor: "#a8c8a0", bgColor: "#f8fff6", boldEvery: 5 }
      };

    case "drawing":
      return {
        ...base, type, width: 400, height: 300,
        data: { strokes: [], strokeColor: "#22302f", strokeWidth: 3, bgColor: "#ffffff", drawMode: true }
      };

    case "noise":
      return {
        ...base, type, width: 320, height: 180,
        data: { threshold: 50, label: "Nivel de ruido", color: "#c45d3e" }
      };

    case "qr":
      return {
        ...base, type, width: 220, height: 260,
        data: { text: "https://edumind.es", label: "", bgColor: "#ffffff", fgColor: "#22302f" }
      };

    case "comment":
      return {
        ...base, type, width: 300, height: 170,
        data: {
          text: "Comentario para el equipo",
          author: "Equipo",
          status: "open",
          color: "#fff3c4",
          createdAt: new Date().toISOString()
        }
      };

    case "connector":
      return {
        ...base, type, width: 320, height: 120,
        data: {
          label: "",
          color: "#1a5fa8",
          strokeWidth: 4,
          style: "straight",
          arrowStart: false,
          arrowEnd: true
        }
      };

    case "flow":
      return {
        ...base, type, width: 260, height: 130,
        data: {
          text: "Nuevo paso",
          shape: "process",
          fill: "#ffffff",
          stroke: "#2a7a6d",
          textColor: "#22302f",
          fontSize: 22
        }
      };

    case "mates3d":
      // Escena inicial con 123 (1 centena, 2 decenas, 3 unidades):
      // el docente ve el manipulativo funcionando desde el primer segundo
      return {
        ...base, type, width: 960, height: 620,
        data: {
          mode: "base10",
          pieces: [
            { id: newId(), kind: "flat", x: -12, z: -8, rotY: 0 },
            { id: newId(), kind: "rod", x: 2, z: 6, rotY: 0 },
            { id: newId(), kind: "rod", x: 2, z: 9, rotY: 0 },
            { id: newId(), kind: "unit", x: 12, z: 12, rotY: 0 },
            { id: newId(), kind: "unit", x: 14, z: 12, rotY: 0 },
            { id: newId(), kind: "unit", x: 16, z: 12, rotY: 0 }
          ],
          showValue: true,
          solid: "cube",
          solidSides: 4,
          solidColor: "#2a7a6d",
          solidTransparent: false,
          showEdges: true,
          showVertices: false,
          showCounts: true,
          cameraPosition: [16, 14, 22],
          cameraTarget: [0, 0, 0]
        }
      };

    case "mindmap": {
      // Mapa de ejemplo: un tema central con tres ramas, listo para usar
      const root = newId(), a = newId(), b = newId(), c = newId();
      return {
        ...base, type, width: 720, height: 480,
        data: {
          variant: "mindmap",
          accent: "#2a7a6d",
          edgeStyle: "curved",
          background: "#fbfaf7",
          nodes: [
            { id: root, text: "Tema central", x: 360, y: 240, color: "#2a7a6d", shape: "rounded" },
            { id: a, text: "Idea 1", x: 170, y: 130, color: "#c45d3e", shape: "rounded" },
            { id: b, text: "Idea 2", x: 560, y: 150, color: "#1a5fa8", shape: "rounded" },
            { id: c, text: "Idea 3", x: 380, y: 400, color: "#8b5cf6", shape: "rounded" }
          ],
          edges: [
            { id: newId(), from: root, to: a, label: "" },
            { id: newId(), from: root, to: b, label: "" },
            { id: newId(), from: root, to: c, label: "" }
          ]
        }
      };
    }

    case "dictadoNum":
      return {
        ...base, type, width: 420, height: 300,
        data: {
          forms: ["cifra", "letra", "romano"],
          min: 1, max: 100, current: 24, form: "letra",
          showAnswer: false, accent: "#1a5fa8"
        }
      };

    default:
      return { ...base, type: "note", data: { text: "Nueva nota", color: "#fff3c4" } };
  }
}

export function createFileElement(file: {
  url: string;
  name: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
}): BoardElement {
  const isImage = file.mimeType === "image/jpeg" || file.mimeType === "image/png";
  return {
    id: newId(),
    type: "file",
    x: 180, y: 180,
    width: isImage ? 420 : 520,
    height: isImage ? 300 : 620,
    rotation: 0,
    zIndex: Date.now(),
    opacity: 1,
    locked: false,
    data: { url: file.url, name: file.name, mimeType: file.mimeType, kind: isImage ? "image" : "pdf" }
  };
}

// Crea un elemento iframe con URL y título predefinidos (presets web y música).
export function createIframePreset(
  url: string,
  title: string,
  mode: "embed" | "launcher" = "embed"
): BoardElement {
  const isMusic = title === "Música";
  // El lanzador es una tarjeta compacta (no un frame a tamaño de recurso).
  const width = mode === "launcher" ? 300 : isMusic ? 620 : 560;
  const height = mode === "launcher" ? 172 : isMusic ? 220 : 360;
  return {
    id: newId(),
    type: "iframe",
    x: 160, y: 160,
    width,
    height,
    rotation: 0,
    zIndex: Date.now(),
    opacity: 1,
    locked: false,
    data: { url, title, mode }
  };
}

export type Mates3dSolidKind = "cube" | "sphere" | "cylinder" | "cone" | "pyramid" | "prism";

// Crea un widget Mates 3D en modo sólidos, ya centrado en el cuerpo indicado.
// Se usa al "abrir en 3D" un sólido dibujado en el lienzo: aristas y vértices
// visibles para explorar caras/aristas/vértices y la fórmula de Euler.
export function createMates3dSolid(
  solid: Mates3dSolidKind,
  sides: number,
  position?: { x: number; y: number }
): BoardElement {
  return {
    id: newId(),
    type: "mates3d",
    x: position?.x ?? 200,
    y: position?.y ?? 160,
    width: 620,
    height: 460,
    rotation: 0,
    zIndex: Date.now(),
    opacity: 1,
    locked: false,
    data: {
      mode: "solids",
      pieces: [],
      showValue: true,
      solid,
      solidSides: Math.max(3, Math.min(12, Math.round(sides))),
      solidColor: "#2a7a6d",
      solidTransparent: false,
      showEdges: true,
      showVertices: true,
      showCounts: true,
      cameraPosition: [16, 14, 22],
      cameraTarget: [0, 4, 0]
    }
  };
}
