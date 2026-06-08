import type { BoardDocument, BoardElement } from "@edumind-board/shared";
import { newId } from "./ids";

export type BoardTemplate = {
  id: string;
  name: string;
  description: string;
  category: "aula" | "matematicas" | "escritura" | "calma" | "proyecto" | "general";
  emoji: string;
  elements: Array<Omit<BoardElement, "id">>;
};

// Helpers tipados para construir elementos de plantilla sin repetir boilerplate
function base(x: number, y: number, width: number, height: number, zIndex = 1) {
  return { x, y, width, height, zIndex, rotation: 0, opacity: 1, locked: false };
}

function note(text: string, color: string, x: number, y: number, w = 360, h = 160): Omit<BoardElement, "id"> {
  return { ...base(x, y, w, h), type: "note", data: { text, color } };
}
function comment(text: string, author: string, status: "open" | "resolved" | "blocked", color: string, x: number, y: number, w = 300, h = 170): Omit<BoardElement, "id"> {
  return { ...base(x, y, w, h), type: "comment", data: { text, author, status, color, createdAt: new Date().toISOString() } };
}
function flow(text: string, shape: "process" | "decision" | "terminator" | "data", x: number, y: number, w = 260, h = 120): Omit<BoardElement, "id"> {
  return { ...base(x, y, w, h), type: "flow", data: { text, shape, fill: "#ffffff", stroke: "#2a7a6d", textColor: "#22302f", fontSize: 22 } };
}
function connector(x: number, y: number, w = 260, h = 80, label = ""): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, w, h),
    type: "connector",
    data: { label, color: "#1a5fa8", strokeWidth: 4, style: "straight", arrowStart: false, arrowEnd: true }
  };
}
function semaphore(label: string, x: number, y: number): Omit<BoardElement, "id"> {
  return { ...base(x, y, 160, 220, 2), type: "semaphore", data: { state: "green", label } };
}
function timer(label: string, seconds: number, x: number, y: number, style: "classic" | "focus" | "minimal" = "classic"): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, 260, 160, 2),
    type: "timer",
    data: { label, initialSeconds: seconds, seconds, running: false, style, accentColor: "#c45d3e" }
  };
}
function clock(x: number, y: number, style: "digital" | "analog" = "digital"): Omit<BoardElement, "id"> {
  return { ...base(x, y, 280, 140), type: "clock", data: { style, showSeconds: true, color: "#22302f", bgColor: "#fffaf0" } };
}
function spinner(items: string[], x: number, y: number): Omit<BoardElement, "id"> {
  return { ...base(x, y, 320, 200, 2), type: "spinner", data: { items, result: null } };
}
function math(operation: "sum" | "subtract" | "multiply" | "divide", x: number, y: number): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, 300, 280),
    type: "math",
    data: { operation, operandA: "", operandB: "", result: "", showResult: false, fontSize: 52 }
  };
}
function base10(x: number, y: number): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, 760, 430),
    type: "base10",
    data: {
      unitCount: 4,
      rodCount: 3,
      flatCount: 2,
      cubeCount: 0,
      mode: "placeValue",
      pieces: [],
      style: "2d",
      showValue: true,
      showPlaceLabels: true
    }
  };
}
function fraction(x: number, y: number): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, 520, 300),
    type: "fraction",
    data: {
      numerator: 3,
      denominator: 4,
      model: "bar",
      compareNumerator: 2,
      compareDenominator: 3,
      showCompare: true,
      showLabels: true,
      color: "#e75f3c"
    }
  };
}
function algorithm(
  operation: "add" | "subtract" | "multiply" | "divide",
  operandA: string,
  operandB: string,
  x: number,
  y: number
): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, 460, 300),
    type: "algorithm",
    data: {
      operation,
      operandA,
      operandB,
      result: "",
      strategy: operation === "divide" ? "birdBeak" : operation === "multiply" ? "areaModel" : "placeValue",
      showResult: false,
      showPlaceValue: true,
      showGrid: true
    }
  };
}
function logic(mode: "pattern" | "count" | "sort", x: number, y: number): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, 540, 330),
    type: "logic",
    data: {
      mode,
      pattern: mode === "sort" ? ["circle", "triangle", "square", "star"] : ["circle", "square", "circle"],
      colors: ["#e75f3c", "#0f8f83", "#1a5fa8"],
      repeatCount: mode === "count" ? 8 : 12,
      hiddenIndex: mode === "pattern" ? 5 : -1,
      showAnswer: false,
      targetCount: 8
    }
  };
}
function dice(x: number, y: number): Omit<BoardElement, "id"> {
  return { ...base(x, y, 180, 180, 2), type: "dice", data: { value: 1, sides: 6, color: "#c45d3e" } };
}
function guidelines(style: "montessori" | "double" | "normal", x: number, y: number, w = 540, h = 340): Omit<BoardElement, "id"> {
  return { ...base(x, y, w, h), type: "guidelines", data: { style, lineColor: "#2a7a6d", bgColor: "#fffdf4", lines: 6 } };
}
function grid(x: number, y: number, w = 560, h = 360): Omit<BoardElement, "id"> {
  return {
    ...base(x, y, w, h),
    type: "grid",
    data: { cellSize: 25, lineColor: "#a8c8a0", bgColor: "#f8fff6", boldEvery: 5 }
  };
}
function noise(x: number, y: number): Omit<BoardElement, "id"> {
  return { ...base(x, y, 320, 190, 2), type: "noise", data: { threshold: 50, label: "Nivel de ruido", color: "#c45d3e" } };
}
function qr(text: string, label: string, x: number, y: number): Omit<BoardElement, "id"> {
  return { ...base(x, y, 220, 260), type: "qr", data: { text, label, bgColor: "#ffffff", fgColor: "#22302f" } };
}
function webEmbed(url: string, title: string, x: number, y: number, w = 560, h = 380): Omit<BoardElement, "id"> {
  return { ...base(x, y, w, h), type: "iframe", data: { url, title } };
}
function hubApp(
  appId: Extract<BoardElement, { type: "hub" }>["data"]["appId"],
  x: number,
  y: number,
  w = 360,
  h = 240
): Omit<BoardElement, "id"> {
  return { ...base(x, y, w, h), type: "hub", data: { appId, mode: "express" } };
}

// ── Plantillas ───────────────────────────────────────────────────────────────

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "blank",
    name: "Pizarra vacía",
    description: "Canvas en blanco para empezar de cero.",
    category: "general",
    emoji: "⬜",
    elements: []
  },
  {
    id: "ef-semaforo",
    name: "Clase EF · Semáforo",
    description: "Semáforo de ritmo + timer de actividad + consigna inicial.",
    category: "aula",
    emoji: "🏃",
    elements: [
      semaphore("Ritmo de clase", 700, 80),
      timer("Actividad", 300, 80, 300, "classic"),
      note("Consigna de la sesión:\n\n• Actividad 1\n• Actividad 2", "#fff9c4", 80, 80, 360, 180),
      note("Materiales necesarios:", "#fffaf0", 80, 290, 360, 140)
    ]
  },
  {
    id: "mates-calculo",
    name: "Matemáticas · Cálculo",
    description: "Layout de operación + dado aleatorio + timer de trabajo.",
    category: "matematicas",
    emoji: "➕",
    elements: [
      math("sum", 80, 80),
      dice(440, 80),
      timer("Tiempo de trabajo", 300, 640, 80, "focus"),
      note("Resuelve la operación del tablero.\nAnota el resultado en tu cuaderno.", "#cce5ff", 440, 290, 260, 130)
    ]
  },
  {
    id: "mates-base10",
    name: "Matemáticas · Base 10",
    description: "Unidades, decenas, centenas y millares para construir números.",
    category: "matematicas",
    emoji: "🔢",
    elements: [
      base10(80, 80),
      note("Construye el número, canjea 10 unidades por 1 decena y verbaliza el valor posicional.", "#fff9c4", 880, 80, 340, 190),
      grid(80, 540, 760, 260)
    ]
  },
  {
    id: "mates-fracciones",
    name: "Matemáticas · Fracciones",
    description: "Representación y comparación de fracciones con modelos visuales.",
    category: "matematicas",
    emoji: "½",
    elements: [
      fraction(80, 80),
      note("Compara las fracciones.\nExplica qué parte está coloreada y cómo lo sabes.", "#fff9c4", 640, 80, 360, 150),
      guidelines("normal", 80, 430, 560, 260)
    ]
  },
  {
    id: "mates-algoritmos",
    name: "Matemáticas · Algoritmos",
    description: "Operaciones de primaria con apoyo de valor posicional.",
    category: "matematicas",
    emoji: "➗",
    elements: [
      algorithm("add", "234", "156", 80, 80),
      algorithm("multiply", "24", "13", 580, 80),
      note("Resuelve paso a paso.\nUsa la cuadrícula para alinear unidades, decenas y centenas.", "#cce5ff", 80, 430, 520, 150)
    ]
  },
  {
    id: "infantil-logica",
    name: "Infantil · Lógica matemática",
    description: "Series, conteo y clasificación con formas y colores.",
    category: "matematicas",
    emoji: "◼",
    elements: [
      logic("pattern", 80, 80),
      logic("count", 660, 80),
      note("Completa la serie y cuenta los elementos.\nDespués clasifica por forma o color.", "#d4edda", 80, 470, 480, 150)
    ]
  },
  {
    id: "mates-tabla",
    name: "Matemáticas · Tabla ×",
    description: "Multiplicación en grande para practicar tablas.",
    category: "matematicas",
    emoji: "✖️",
    elements: [
      math("multiply", 160, 80),
      dice(520, 80),
      note("El dado decide el número.\nCompleta la tabla del resultado.", "#fff9c4", 520, 290, 260, 140)
    ]
  },
  {
    id: "grafo-montessori",
    name: "Grafomotricidad · Montessori",
    description: "Pauta Montessori de 3 líneas para infantil y primaria.",
    category: "escritura",
    emoji: "✏️",
    elements: [
      guidelines("montessori", 80, 80, 620, 380),
      note("Escribe con cuidado:\n• Letras en la zona central\n• Trazo suave y continuo", "#d4edda", 730, 80, 280, 160),
      clock(730, 270)
    ]
  },
  {
    id: "dictado-lengua",
    name: "Dictado · Lengua",
    description: "Pauta normal + reloj para dictados temporizados.",
    category: "escritura",
    emoji: "📝",
    elements: [
      guidelines("normal", 80, 80, 600, 340),
      clock(720, 80, "analog"),
      timer("Dictado", 600, 640, 80, "minimal")
    ]
  },
  {
    id: "grupos-cooperativo",
    name: "Trabajo en grupos",
    description: "4 notas de colores por grupo + semáforo + timer.",
    category: "proyecto",
    emoji: "👥",
    elements: [
      note("Grupo 1\n\nTarea:", "#ffd6cc", 80, 80, 240, 200),
      note("Grupo 2\n\nTarea:", "#d4edda", 340, 80, 240, 200),
      note("Grupo 3\n\nTarea:", "#cce5ff", 600, 80, 240, 200),
      note("Grupo 4\n\nTarea:", "#f3e5f5", 860, 80, 240, 200),
      semaphore("Nivel de trabajo", 80, 320),
      timer("Tiempo del grupo", 600, 290, 80, "focus")
    ]
  },
  {
    id: "evaluacion-ruleta",
    name: "Evaluación · Ruleta",
    description: "Ruleta de alumnos + timer de respuesta + semáforo.",
    category: "aula",
    emoji: "🎡",
    elements: [
      spinner(["Alumno 1", "Alumno 2", "Alumno 3", "Alumno 4", "Alumno 5", "Alumno 6"], 80, 80),
      timer("Tiempo de respuesta", 60, 460, 80, "classic"),
      semaphore("Turno", 760, 80),
      note("Pregunta:\n\n", "#fff9c4", 80, 320, 640, 140)
    ]
  },
  {
    id: "aula-silencio",
    name: "Aula en silencio",
    description: "Medidor de ruido + semáforo + consigna de trabajo.",
    category: "aula",
    emoji: "🔇",
    elements: [
      noise(80, 80),
      semaphore("Ambiente", 460, 80),
      note("TRABAJO INDIVIDUAL\n\nMantén el silencio.\nSi necesitas ayuda, levanta la mano.", "#fff9c4", 680, 80, 340, 200),
      timer("Trabajo", 600, 80, 310, "minimal")
    ]
  },
  {
    id: "ciencias-phet",
    name: "Ciencias · PhET",
    description: "Simulación PhET + timer + nota de observaciones.",
    category: "proyecto",
    emoji: "🔬",
    elements: [
      webEmbed("https://phet.colorado.edu/", "Simulación PhET", 80, 80, 580, 380),
      note("Observaciones:\n\n1.\n2.\n3.", "#d4edda", 700, 80, 300, 200),
      timer("Exploración", 600, 700, 310, "focus")
    ]
  },
  {
    id: "calma-respiracion",
    name: "Calma · Respiración",
    description: "Ejercicio de respiración guiada con Breath + timer.",
    category: "calma",
    emoji: "🌬️",
    elements: [
      webEmbed("https://breath.edumind.es/?embed=1&board=1", "Breath EDUmind", 160, 80, 720, 460),
      note("Cierra los ojos.\nSigue el ritmo de la respiración.\nInhala 4 · Mantén 4 · Exhala 4.", "#f3e5f5", 760, 80, 300, 200),
      timer("Sesión de calma", 180, 760, 320, "minimal")
    ]
  },
  {
    id: "qr-recursos",
    name: "QR de recursos",
    description: "QR grande para compartir un enlace + instrucciones.",
    category: "general",
    emoji: "📱",
    elements: [
      qr("https://edumind.es", "Escanea para acceder", 160, 80),
      note("Actividad:\n\n1. Escanea el QR con tu móvil\n2. Lee el contenido\n3. Responde las preguntas", "#cce5ff", 430, 80, 380, 200),
      note("¿Sin móvil? El enlace está en la pantalla.", "#fffaf0", 430, 310, 380, 120)
    ]
  },
  {
    id: "pomodoro",
    name: "Pomodoro · Trabajo autónomo",
    description: "Timer foco + nota de tareas para trabajo por bloques.",
    category: "aula",
    emoji: "🍅",
    elements: [
      timer("POMODORO", 1500, 180, 100, "focus"),
      note("TAREAS DEL BLOQUE\n\n□ \n□ \n□ \n□", "#fff9c4", 500, 100, 360, 280),
      semaphore("Estado", 920, 100),
      note("Cuando suene el timer: 5 min de descanso.", "#ffd6cc", 180, 310, 300, 100)
    ]
  },
  {
    id: "equipo-retro",
    name: "Equipo · Retrospectiva",
    description: "Columnas de mejora, acuerdos y bloqueos para trabajo cooperativo asincrono.",
    category: "proyecto",
    emoji: "🔁",
    elements: [
      note("RETROSPECTIVA\n\nCada equipo deja evidencias, acuerdos y dudas para la siguiente sesión.", "#fffaf0", 80, 60, 460, 150),
      flow("Funcionó", "process", 80, 250, 260, 120),
      flow("Mejorar", "process", 420, 250, 260, 120),
      flow("Bloqueos", "decision", 760, 230, 250, 160),
      comment("Evidencia o logro del equipo", "Equipo A", "resolved", "#d4edda", 80, 430),
      comment("Idea de mejora para el próximo ciclo", "Equipo B", "open", "#fff3c4", 420, 430),
      comment("Necesitamos ayuda externa", "Equipo C", "blocked", "#ffd6cc", 760, 430),
      timer("Cierre", 600, 1080, 250, "minimal")
    ]
  },
  {
    id: "equipo-flujo",
    name: "Equipo · Flujo de proyecto",
    description: "Mapa visual con fases, decisiones y conectores para coordinar tareas.",
    category: "proyecto",
    emoji: "🧭",
    elements: [
      flow("Inicio", "terminator", 80, 120, 220, 100),
      connector(300, 130, 180, 80),
      flow("Investigar", "process", 480, 120, 240, 100),
      connector(720, 130, 180, 80),
      flow("¿Validado?", "decision", 900, 90, 220, 160),
      connector(1010, 250, 100, 160, "sí"),
      flow("Prototipo", "process", 900, 420, 240, 110),
      connector(620, 430, 280, 80),
      flow("Presentar", "terminator", 380, 420, 240, 110),
      comment("Definir responsable de evidencias", "Docente", "open", "#cce5ff", 80, 330, 270, 160)
    ]
  },
  {
    id: "aula-plan-cooperativo",
    name: "Aula · Plan cooperativo",
    description: "Organiza roles, recursos, tiempos y decisiones del aula.",
    category: "proyecto",
    emoji: "🤝",
    elements: [
      note("OBJETIVO COMPARTIDO\n\nQué vamos a lograr y cómo sabremos que está terminado.", "#fff9c4", 80, 70, 440, 170),
      note("ROLES\n\n• Coordinación\n• Materiales\n• Evidencias\n• Portavoz", "#d4edda", 560, 70, 340, 220),
      comment("Acuerdo pendiente", "Equipo", "open", "#fff3c4", 80, 300),
      comment("Riesgo o dependencia", "Equipo", "blocked", "#ffd6cc", 420, 300),
      comment("Decisión tomada", "Equipo", "resolved", "#d4edda", 760, 300),
      hubApp("pasos", 80, 540, 390, 260),
      timer("Sprint", 900, 520, 540, "focus"),
      semaphore("Estado de aula", 820, 540)
    ]
  }
];

// Crea un BoardDocument a partir de una plantilla asignando UUIDs frescos
export function applyTemplate(template: BoardTemplate): BoardDocument {
  return {
    schemaVersion: 1,
    id: newId(),
    title: template.name,
    theme: "edumind",
    viewport: { x: 0, y: 0, zoom: 1 },
    elements: template.elements.map((el, i) => ({
      ...el,
      id: newId(),
      zIndex: i + 1
    })) as BoardDocument["elements"],
    ink: [],
    updatedAt: new Date().toISOString()
  };
}
