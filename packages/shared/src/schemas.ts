import { z } from "zod";

export const allowedEmbedHosts = [
  "phet.colorado.edu",
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "w.soundcloud.com",
  "player.vimeo.com",
  "vimeo.com",
  "canva.com",
  "www.canva.com",
  "santillana.es",
  "anaya.es",
  "anayaeducacion.es",
  "grupoanaya.es",
  "educamos.sm",
  "grupo-sm.com",
  "smconectados.com",
  "smsavia.com",
  "savia-digital.com",
  "edumind.es",
  "board.edumind.es",
  "pasos.edumind.es",
  "motion.edumind.es",
  "breath.edumind.es",
  "miapp.edumind.es",
  "recursos.edumind.es"
] as const;

/**
 * Nubes de terceros que SÍ permiten verse dentro de un iframe con su URL de
 * vista previa. Están aparte de `allowedEmbedHosts` porque no son recursos
 * educativos ni apps EDUmind: son almacenamiento del docente, y conviene poder
 * enumerarlos (avisos de privacidad, pruebas) sin mezclarlos con el resto.
 *
 * Nextcloud u ownCloud autoalojados no pueden estar aquí: el dominio lo pone
 * cada centro. Esas URLs se añaden como tarjeta-lanzador (ver `nube.ts` en la
 * web), que abre en pestaña nueva en vez de un marco en blanco.
 */
export const allowedCloudHosts = [
  "drive.google.com",
  "docs.google.com",
  "onedrive.live.com",
  "1drv.ms",
  "sharepoint.com",
  "dropbox.com",
  "www.dropbox.com",
  "dl.dropboxusercontent.com"
] as const;

export const allowedInstitutionalEmbedSuffixes = [
  "edu.xunta.gal",
  "educa.madrid.org",
  "educa.jcyl.es",
  "edu.gva.es",
  "educarex.es",
  "educarm.es",
  "educa.aragon.es",
  "educantabria.es",
  "educastur.es",
  "xtec.cat",
  "juntadeandalucia.es"
] as const;

export function isAllowedEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;
    if (parsed.protocol === "http:" && parsed.hostname !== "localhost") return false;
    return allowedEmbedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    ) || allowedCloudHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    ) || allowedInstitutionalEmbedSuffixes.some(
      (suffix) => parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

// Sitios que casi siempre bloquean el framing (X-Frame-Options / CSP): portales
// y LMS institucionales con login. No pueden verse dentro de un iframe, así que
// se añaden como tarjeta-lanzador («abrir en pestaña nueva») en vez de un frame
// en blanco. El docente puede forzar modo embed en el Inspector si una página
// concreta sí lo permite.
export function shouldLaunchInNewTab(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return allowedInstitutionalEmbedSuffixes.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

export const boardElementTypeSchema = z.enum([
  "text",
  "note",
  "image",
  "file",
  "iframe",
  "musica",
  "timer",
  "semaphore",
  "clock",
  "dice",
  "spinner",
  "guidelines",
  "math",
  "base10",
  "fraction",
  "algorithm",
  "logic",
  "grid",
  "drawing",
  "noise",
  "qr",
  "table",
  "comment",
  "connector",
  "flow",
  "pictos",
  "hub",
  "mates3d",
  "mindmap",
  "dictadoNum"
]);

export const themeSchema = z.enum(["edumind", "eink", "ocean", "forest"]);

export const elementBaseSchema = z.object({
  id: z.string().uuid(),
  type: boardElementTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().min(40).max(2400),
  height: z.number().min(40).max(1800),
  rotation: z.number().default(0),
  zIndex: z.number().int().default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false)
});

export const textElementSchema = elementBaseSchema.extend({
  type: z.literal("text"),
  data: z.object({
    text: z.string().max(4000),
    fontSize: z.number().min(12).max(120).default(32),
    color: z.string().default("#22302f")
  })
});

export const noteElementSchema = elementBaseSchema.extend({
  type: z.literal("note"),
  data: z.object({
    text: z.string().max(4000),
    color: z.string().default("#fff3c4")
  })
});

export const imageElementSchema = elementBaseSchema.extend({
  type: z.literal("image"),
  data: z.object({
    url: z.string().url(),
    alt: z.string().max(240).default("")
  })
});

export const fileElementSchema = elementBaseSchema.extend({
  type: z.literal("file"),
  data: z.object({
    // data: (empotrado en el tablero), local:<id> (IndexedDB de ESTE navegador,
    // para archivos grandes que no viajan al servidor), https:// (producción)
    // o http://localhost* (API en desarrollo)
    url: z.string().refine((value) =>
      value.startsWith("data:") ||
      value.startsWith("local:") ||
      value.startsWith("https://") ||
      value.startsWith("/api/uploads/") ||
      value.startsWith("http://localhost")
    ),
    name: z.string().min(1).max(240),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    kind: z.enum(["pdf", "image"])
  })
});

export const iframeElementSchema = elementBaseSchema.extend({
  type: z.literal("iframe"),
  data: z.object({
    url: z.string().url(),
    title: z.string().max(160).default("Recurso embebido"),
    // "embed" = iframe en el tablero; "launcher" = tarjeta con botón que abre en
    // pestaña nueva (para sitios que prohíben el framing, como EVA/LMS).
    mode: z.enum(["embed", "launcher"]).default("embed")
  }).superRefine((data, ctx) => {
    // La lista de dominios protege de lo único peligroso: meter una página
    // ajena DENTRO del tablero. Una tarjeta-lanzador no empotra nada, solo
    // abre en otra pestaña un enlace que el docente ha pegado, así que le
    // basta con ser https. Sin esta distinción no se podía enlazar el
    // Nextcloud del centro, cuyo dominio no se puede conocer de antemano.
    if (data.mode === "launcher") {
      if (!data.url.startsWith("https://") && !data.url.startsWith("http://localhost")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "Launcher URLs must be https" });
      }
      return;
    }
    if (!isAllowedEmbedUrl(data.url)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "Embed host is not allowed" });
    }
  })
});

// Música de aula servida por el propio servidor (ver routes/musica.ts).
// Sólo guarda a qué modo de trabajo pertenece: las pistas viven en el
// catálogo del servidor, así que recurar la música no obliga a tocar los
// tableros que ya existen.
export const musicaElementSchema = elementBaseSchema.extend({
  type: z.literal("musica"),
  data: z.object({
    modeId: z.string().min(1).max(40),
    titulo: z.string().max(80).default("Música de aula"),
    // Reanudar donde se quedó al reabrir el tablero.
    pistaId: z.string().max(80).optional()
  })
});

export const timerElementSchema = elementBaseSchema.extend({
  type: z.literal("timer"),
  data: z.object({
    label: z.string().max(120).default("Temporizador"),
    initialSeconds: z.number().int().min(0).max(7200).default(300),
    seconds: z.number().int().min(0).max(7200).default(300),
    running: z.boolean().default(false),
    style: z.enum(["classic", "focus", "minimal"]).default("classic"),
    accentColor: z.string().default("#c45d3e")
  })
});

export const semaphoreElementSchema = elementBaseSchema.extend({
  type: z.literal("semaphore"),
  data: z.object({
    state: z.enum(["red", "yellow", "green"]).default("green"),
    label: z.string().max(120).default("Semaforo")
  })
});

// ── Nuevos widgets Fase 1 ────────────────────────────────────────────────────

export const clockElementSchema = elementBaseSchema.extend({
  type: z.literal("clock"),
  data: z.object({
    style: z.enum(["digital", "analog"]).default("digital"),
    showSeconds: z.boolean().default(true),
    color: z.string().default("#22302f"),
    bgColor: z.string().default("#fffaf0")
  })
});

export const diceElementSchema = elementBaseSchema.extend({
  type: z.literal("dice"),
  data: z.object({
    value: z.number().int().min(1).max(100).default(1),
    sides: z.number().int().min(2).max(100).default(6),
    color: z.string().default("#c45d3e")
  })
});

export const spinnerElementSchema = elementBaseSchema.extend({
  type: z.literal("spinner"),
  data: z.object({
    items: z.array(z.string().max(80)).max(60).default([]),
    result: z.string().nullable().default(null)
  })
});

export const guidelinesElementSchema = elementBaseSchema.extend({
  type: z.literal("guidelines"),
  data: z.object({
    style: z.enum(["montessori", "double", "normal"]).default("montessori"),
    lineColor: z.string().default("#2a7a6d"),
    bgColor: z.string().default("#fffdf4"),
    lines: z.number().int().min(1).max(30).default(6)
  })
});

export const mathElementSchema = elementBaseSchema.extend({
  type: z.literal("math"),
  data: z.object({
    operation: z.enum(["sum", "subtract", "multiply", "divide"]).default("sum"),
    operandA: z.string().max(20).default(""),
    operandB: z.string().max(20).default(""),
    result: z.string().max(20).default(""),
    showResult: z.boolean().default(false),
    fontSize: z.number().min(16).max(120).default(48)
  })
});

export const baseTenElementSchema = elementBaseSchema.extend({
  type: z.literal("base10"),
  data: z.object({
    unitCount: z.number().int().min(0).max(99).default(4),
    rodCount: z.number().int().min(0).max(99).default(3),
    flatCount: z.number().int().min(0).max(30).default(2),
    cubeCount: z.number().int().min(0).max(10).default(0),
    mode: z.enum(["placeValue", "free"]).default("placeValue"),
    pieces: z.array(z.object({
      id: z.string().uuid(),
      kind: z.enum(["unit", "rod", "flat", "cube"]),
      x: z.number(),
      y: z.number()
    })).max(300).default([]),
    style: z.enum(["2d", "3d"]).default("2d"),
    showValue: z.boolean().default(true),
    showPlaceLabels: z.boolean().default(true)
  })
});

export const fractionElementSchema = elementBaseSchema.extend({
  type: z.literal("fraction"),
  data: z.object({
    numerator: z.number().int().min(0).max(24).default(1),
    denominator: z.number().int().min(1).max(24).default(2),
    model: z.enum(["bar", "circle", "set"]).default("bar"),
    compareNumerator: z.number().int().min(0).max(24).default(1),
    compareDenominator: z.number().int().min(1).max(24).default(3),
    showCompare: z.boolean().default(false),
    showLabels: z.boolean().default(true),
    color: z.string().default("#e75f3c")
  })
});

export const algorithmElementSchema = elementBaseSchema.extend({
  type: z.literal("algorithm"),
  data: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]).default("add"),
    operandA: z.string().regex(/^\d{0,6}$/).default("234"),
    operandB: z.string().regex(/^\d{0,6}$/).default("156"),
    result: z.string().max(16).regex(/^\d{0,8}(?:\s*r\s*\d{0,6})?$/i).default(""),
    strategy: z.enum(["placeValue", "areaModel", "birdBeak", "standard"]).default("placeValue"),
    showResult: z.boolean().default(false),
    showPlaceValue: z.boolean().default(true),
    showGrid: z.boolean().default(true)
  })
});

export const logicElementSchema = elementBaseSchema.extend({
  type: z.literal("logic"),
  data: z.object({
    mode: z.enum(["pattern", "count", "sort"]).default("pattern"),
    pattern: z.array(z.enum(["circle", "square", "triangle", "star"])).min(1).max(8).default(["circle", "square", "circle"]),
    colors: z.array(z.string()).min(1).max(8).default(["#e75f3c", "#0f8f83", "#1a5fa8"]),
    repeatCount: z.number().int().min(2).max(16).default(9),
    hiddenIndex: z.number().int().min(-1).max(31).default(5),
    showAnswer: z.boolean().default(false),
    targetCount: z.number().int().min(1).max(20).default(6)
  })
});

// ── Dictado numérico ────────────────────────────────────────────────────────

export const numeroFormaSchema = z.enum(["cifra", "letra", "romano", "ordinal", "base10"]);

export const dictadoNumericoElementSchema = elementBaseSchema.extend({
  type: z.literal("dictadoNum"),
  data: z.object({
    // Formas habilitadas en el sorteo (el docente elige en el panel)
    forms: z.array(numeroFormaSchema).min(1).default(["cifra", "letra"]),
    min: z.number().int().min(0).max(9999).default(1),
    max: z.number().int().min(0).max(9999).default(100),
    current: z.number().int().min(0).max(9999).default(24),
    form: numeroFormaSchema.default("letra"),
    showAnswer: z.boolean().default(false),
    accent: z.string().default("#1a5fa8")
  })
});

// ── Mapa mental / conceptual (estilo CmapTools) ─────────────────────────────

export const mindmapNodeSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(400).default("Idea"),
  // Posición local dentro del widget, en px
  x: z.number(),
  y: z.number(),
  color: z.string().default("#2a7a6d"),
  shape: z.enum(["rounded", "pill", "rect", "ellipse"]).default("rounded")
});

export const mindmapEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  // Frase de enlace estilo mapa conceptual ("es un", "provoca", …)
  label: z.string().max(160).default("")
});

export const mindmapElementSchema = elementBaseSchema.extend({
  type: z.literal("mindmap"),
  data: z.object({
    variant: z.enum(["mindmap", "concept"]).default("mindmap"),
    nodes: z.array(mindmapNodeSchema).max(200).default([]),
    edges: z.array(mindmapEdgeSchema).max(400).default([]),
    accent: z.string().default("#2a7a6d"),
    edgeStyle: z.enum(["curved", "elbow", "straight"]).default("curved"),
    background: z.string().default("#fbfaf7")
  })
});

// ── Manipulativos matemáticos 3D reales (WebGL) ─────────────────────────────

export const solid3dKindSchema = z.enum([
  "cube",
  "sphere",
  "cylinder",
  "cone",
  "pyramid",
  "prism"
]);

export const mates3dPieceSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["unit", "rod", "flat", "cube"]),
  // Posición en el plano del suelo, en unidades de mundo (1 = un cubo unidad)
  x: z.number().min(-60).max(60),
  z: z.number().min(-60).max(60),
  rotY: z.number().default(0)
});

export const mates3dElementSchema = elementBaseSchema.extend({
  type: z.literal("mates3d"),
  data: z.object({
    mode: z.enum(["base10", "solids"]).default("base10"),
    // Escena Base 10
    pieces: z.array(mates3dPieceSchema).max(200).default([]),
    showValue: z.boolean().default(true),
    // Explorador de sólidos
    solid: solid3dKindSchema.default("cube"),
    // Número de lados de la base para prisma y pirámide (3–12)
    solidSides: z.number().int().min(3).max(12).default(4),
    solidColor: z.string().default("#2a7a6d"),
    solidTransparent: z.boolean().default(false),
    showEdges: z.boolean().default(true),
    showVertices: z.boolean().default(false),
    showCounts: z.boolean().default(true),
    // Cámara persistida por board (posición y punto de mira)
    cameraPosition: z.tuple([z.number(), z.number(), z.number()]).default([16, 14, 22]),
    cameraTarget: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0])
  })
});

export const hubElementSchema = elementBaseSchema.extend({
  type: z.literal("hub"),
  data: z.object({
    appId: z.enum(["motion", "pasos", "quiz", "robotics", "miapp", "breath"]).default("motion"),
    mode: z.enum(["express", "embed"]).default("express")
  })
});

export const pictogramSequenceElementSchema = elementBaseSchema.extend({
  type: z.literal("pictos"),
  data: z.object({
    title: z.string().max(120).default("Secuencia visual"),
    mode: z.enum(["sequence", "pattern"]).default("sequence"),
    activeIndex: z.number().int().min(0).max(23).default(0),
    showLights: z.boolean().default(true),
    repeatCount: z.number().int().min(2).max(12).default(6),
    items: z.array(z.object({
      id: z.number().int().positive(),
      label: z.string().max(80),
      url: z.string().url(),
      source: z.literal("arasaac").default("arasaac")
    })).max(24).default([])
  })
});

export const tableElementSchema = elementBaseSchema.extend({
  type: z.literal("table"),
  data: z.object({
    rows: z.number().int().min(1).max(12).default(3),
    cols: z.number().int().min(1).max(8).default(3),
    // Celdas en array plano fila×col (row-major)
    cells: z.array(z.string().max(120)).max(96).default([]),
    headerRow: z.boolean().default(true),
    borderColor: z.string().default("#3d3a36"),
    headerBg: z.string().default("#c9c4bb"),
    fontSize: z.number().min(8).max(48).default(18)
  })
});

export const gridElementSchema = elementBaseSchema.extend({
  type: z.literal("grid"),
  data: z.object({
    cellSize: z.number().min(10).max(120).default(25),
    lineColor: z.string().default("#a8c8a0"),
    bgColor: z.string().default("#f8fff6"),
    boldEvery: z.number().int().min(2).max(10).default(5)
  })
});

export const drawingElementSchema = elementBaseSchema.extend({
  type: z.literal("drawing"),
  data: z.object({
    strokes: z.array(z.array(z.number())).max(500).default([]),
    strokeColor: z.string().default("#22302f"),
    strokeWidth: z.number().min(1).max(30).default(3),
    bgColor: z.string().default("#ffffff"),
    drawMode: z.boolean().default(true)
  })
});

export const noiseElementSchema = elementBaseSchema.extend({
  type: z.literal("noise"),
  data: z.object({
    threshold: z.number().min(10).max(90).default(50),
    label: z.string().max(80).default("Nivel de ruido"),
    color: z.string().default("#c45d3e")
  })
});

export const qrElementSchema = elementBaseSchema.extend({
  type: z.literal("qr"),
  data: z.object({
    text: z.string().max(500).default("https://edumind.es"),
    label: z.string().max(120).default(""),
    bgColor: z.string().default("#ffffff"),
    fgColor: z.string().default("#22302f")
  })
});

export const commentElementSchema = elementBaseSchema.extend({
  type: z.literal("comment"),
  data: z.object({
    text: z.string().max(1200).default("Comentario"),
    author: z.string().max(120).default("Equipo"),
    status: z.enum(["open", "resolved", "blocked"]).default("open"),
    color: z.string().default("#fff3c4"),
    createdAt: z.string().datetime().default(() => new Date().toISOString())
  })
});

export const connectorElementSchema = elementBaseSchema.extend({
  type: z.literal("connector"),
  data: z.object({
    label: z.string().max(160).default(""),
    color: z.string().default("#1a5fa8"),
    strokeWidth: z.number().min(1).max(16).default(4),
    style: z.enum(["straight", "elbow", "dashed"]).default("straight"),
    arrowStart: z.boolean().default(false),
    arrowEnd: z.boolean().default(true),
    // Extremos en coordenadas NORMALIZADAS dentro del propio recuadro (0..1).
    // Antes la flecha era siempre horizontal de izquierda a derecha, así que
    // unir dos elementos en diagonal era imposible sin recolocar a mano. El
    // valor por defecto reproduce exactamente la flecha horizontal de antes,
    // de modo que los tableros ya existentes no cambian.
    desde: z.object({ x: z.number().min(-1).max(2), y: z.number().min(-1).max(2) })
      .default({ x: 0, y: 0.5 }),
    hasta: z.object({ x: z.number().min(-1).max(2), y: z.number().min(-1).max(2) })
      .default({ x: 1, y: 0.5 }),
    // Anclaje a otros elementos: si están, la flecha se recoloca sola cuando
    // el origen o el destino se mueven (conexión rápida estilo mapa mental).
    anclaDesde: z.string().optional(),
    anclaHasta: z.string().optional()
  })
});

export const flowElementSchema = elementBaseSchema.extend({
  type: z.literal("flow"),
  data: z.object({
    text: z.string().max(600).default("Paso"),
    shape: z.enum(["process", "decision", "terminator", "data"]).default("process"),
    fill: z.string().default("#ffffff"),
    stroke: z.string().default("#2a7a6d"),
    textColor: z.string().default("#22302f"),
    fontSize: z.number().min(10).max(64).default(22)
  })
});

// ────────────────────────────────────────────────────────────────────────────

export const boardElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  noteElementSchema,
  imageElementSchema,
  fileElementSchema,
  iframeElementSchema,
  musicaElementSchema,
  timerElementSchema,
  semaphoreElementSchema,
  clockElementSchema,
  diceElementSchema,
  spinnerElementSchema,
  guidelinesElementSchema,
  mathElementSchema,
  baseTenElementSchema,
  fractionElementSchema,
  algorithmElementSchema,
  logicElementSchema,
  gridElementSchema,
  tableElementSchema,
  pictogramSequenceElementSchema,
  drawingElementSchema,
  noiseElementSchema,
  qrElementSchema,
  commentElementSchema,
  connectorElementSchema,
  flowElementSchema,
  hubElementSchema,
  mates3dElementSchema,
  mindmapElementSchema,
  dictadoNumericoElementSchema
]);

export const boardInkObjectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stroke"),
    points: z.array(z.number()).min(4).max(2000),
    color: z.string().default("#22302f"),
    width: z.number().min(1).max(30).default(4),
    anchorElementId: z.string().uuid().optional()
  }),
  z.object({
    kind: z.enum([
      "line",
      "rect",
      "ellipse",
      "triangle",
      "angle",
      "angleMeasure",
      "baseUnit",
      "baseRod",
      "baseFlat",
      "hexagon",
      "polygon",
      "cube",
      "pyramid",
      "triangularPrism",
      "cylinder",
      "cone",
      "sphere"
    ]),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    color: z.string().default("#22302f"),
    width: z.number().min(1).max(30).default(4),
    sides: z.number().int().min(3).max(24).optional(),
    showMeasurements: z.boolean().optional(),
    anchorElementId: z.string().uuid().optional()
  })
]);

export const boardDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  theme: themeSchema.default("edumind"),
  viewport: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    zoom: z.number().min(0.1).max(4).default(1)
  }),
  elements: z.array(boardElementSchema).max(250),
  ink: z.array(boardInkObjectSchema).max(1000).default([]),
  updatedAt: z.string().datetime()
});

export const activityMaterialSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["widget", "resource", "link", "file", "manipulative", "instruction"]),
  title: z.string().min(1).max(160),
  description: z.string().max(800).default(""),
  url: z.string().url().optional(),
  widgetType: boardElementTypeSchema.optional()
});

export const activityStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  teacherNotes: z.string().max(2000).default(""),
  studentPrompt: z.string().max(2000).default(""),
  durationMinutes: z.number().int().min(0).max(180).default(0),
  boardElementIds: z.array(z.string().uuid()).max(80).default([]),
  expectedEvidence: z.enum(["none", "photo", "audio", "text", "boardSnapshot"]).default("none")
});

export const activitySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  objective: z.string().max(1200).default(""),
  profileId: z.string().max(80).default("general"),
  estimatedTimeMinutes: z.number().int().min(0).max(480).default(0),
  materials: z.array(activityMaterialSchema).max(80).default([]),
  steps: z.array(activityStepSchema).min(1).max(40),
  evidencePolicy: z.enum(["none", "optional", "required"]).default("optional"),
  boardTemplateId: z.string().max(120).optional(),
  board: boardDocumentSchema.optional(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createBoardSchema = z.object({
  title: z.string().min(1).max(160).default("Nuevo board")
});

export const publishBoardSchema = z.object({
  board: boardDocumentSchema
});

export const createShareSchema = z.object({
  expiresAt: z.string().datetime().optional()
});

export function assertBoardEmbedsAllowed(board: BoardDocument) {
  const blocked = board.elements.filter(
    // Las tarjetas-lanzador no empotran nada: no pasan por la lista (ver el
    // superRefine de iframeElementSchema).
    (element) => element.type === "iframe" && element.data.mode !== "launcher" && !isAllowedEmbedUrl(element.data.url)
  );
  if (blocked.length > 0) {
    throw new Error("Board contains iframe URLs outside the allowed embed list");
  }
}

export type BoardElementType = z.infer<typeof boardElementTypeSchema>;
export type Solid3dKind = z.infer<typeof solid3dKindSchema>;
export type Mates3dPiece = z.infer<typeof mates3dPieceSchema>;
export type MindmapNode = z.infer<typeof mindmapNodeSchema>;
export type MindmapEdge = z.infer<typeof mindmapEdgeSchema>;
export type BoardElement = z.infer<typeof boardElementSchema>;
export type BoardInkObject = z.infer<typeof boardInkObjectSchema>;
export type BoardDocument = z.infer<typeof boardDocumentSchema>;
export type ActivityMaterial = z.infer<typeof activityMaterialSchema>;
export type ActivityStep = z.infer<typeof activityStepSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ThemeName = z.infer<typeof themeSchema>;
