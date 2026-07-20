import { activitySchema, type Activity, type ActivityMaterial, type ActivityStep } from "@edumind-board/shared";
import { newId } from "../lib/ids";
import { applyTemplate, BOARD_TEMPLATES, type BoardTemplate } from "../lib/templates";

type ActivityMaterialBlueprint = Omit<ActivityMaterial, "id">;
type ActivityStepBlueprint = Omit<ActivityStep, "id" | "boardElementIds"> & {
  boardElementIds?: string[];
};

export type ActivityBlueprint = {
  id: string;
  title: string;
  objective: string;
  profileId: string;
  estimatedTimeMinutes: number;
  evidencePolicy: Activity["evidencePolicy"];
  boardTemplateId: string;
  materials: ActivityMaterialBlueprint[];
  steps: ActivityStepBlueprint[];
};

export const ACTIVITY_BLUEPRINTS: ActivityBlueprint[] = [
  {
    id: "base10-canje-234",
    title: "Construir y canjear 234",
    objective: "Representar un numero con material Base 10, explicar su valor posicional y realizar canjes reversibles.",
    profileId: "math",
    estimatedTimeMinutes: 25,
    evidencePolicy: "optional",
    boardTemplateId: "mates-base10",
    materials: [
      {
        type: "manipulative",
        title: "Material Base 10",
        description: "Unidades, decenas, centenas y millares manipulables.",
        widgetType: "base10"
      },
      {
        type: "widget",
        title: "Cuadricula de registro",
        description: "Espacio para anotar equivalencias y verbalizaciones.",
        widgetType: "grid"
      }
    ],
    steps: [
      {
        title: "Construccion inicial",
        teacherNotes: "Pide al alumnado que represente 234 sin usar el numero escrito como unica pista.",
        studentPrompt: "Construye 234 con centenas, decenas y unidades.",
        durationMinutes: 8,
        expectedEvidence: "boardSnapshot"
      },
      {
        title: "Canje guiado",
        teacherNotes: "Provoca 10 unidades adicionales y pide transformar sin cambiar el valor.",
        studentPrompt: "Agrupa 10 unidades y cambialas por 1 decena. Explica por que el valor no cambia.",
        durationMinutes: 10,
        expectedEvidence: "text"
      },
      {
        title: "Cierre verbal",
        teacherNotes: "Recoge una frase de valor posicional y una equivalencia numerica.",
        studentPrompt: "Escribe una equivalencia que hayas demostrado con piezas.",
        durationMinutes: 7,
        expectedEvidence: "text"
      }
    ]
  },
  {
    id: "cooperativo-sprint-aula",
    title: "Sprint cooperativo de aula",
    objective: "Organizar roles, acuerdos, bloqueos y evidencias de un equipo durante una sesion de trabajo.",
    profileId: "cooperative",
    estimatedTimeMinutes: 45,
    evidencePolicy: "required",
    boardTemplateId: "aula-plan-cooperativo",
    materials: [
      {
        type: "widget",
        title: "Notas de roles",
        description: "Roles de coordinacion, materiales, evidencias y portavoz.",
        widgetType: "note"
      },
      {
        type: "widget",
        title: "Comentarios de seguimiento",
        description: "Acuerdos, riesgos y decisiones del equipo.",
        widgetType: "comment"
      },
      {
        type: "link",
        title: "Pasos EDUmind",
        description: "Apoyo para organizar tareas y evidencias.",
        url: "https://pasos.edumind.es/"
      }
    ],
    steps: [
      {
        title: "Roles y objetivo",
        teacherNotes: "Asegura que cada equipo define objetivo verificable antes de empezar.",
        studentPrompt: "Completa el objetivo compartido y reparte roles.",
        durationMinutes: 10,
        expectedEvidence: "text"
      },
      {
        title: "Trabajo por sprint",
        teacherNotes: "Usa el temporizador y revisa bloqueos a mitad del ciclo.",
        studentPrompt: "Trabaja durante el sprint y registra al menos una decision o bloqueo.",
        durationMinutes: 25,
        expectedEvidence: "boardSnapshot"
      },
      {
        title: "Cierre y portavoz",
        teacherNotes: "Cada equipo comparte logro, bloqueo y siguiente paso.",
        studentPrompt: "Resume logro, bloqueo y proximo paso.",
        durationMinutes: 10,
        expectedEvidence: "text"
      }
    ]
  },
  {
    id: "calma-respiracion-3min",
    title: "Rutina de respiracion de 3 minutos",
    objective: "Facilitar una transicion breve de calma con apoyo visual, temporizador y consigna clara.",
    profileId: "calm",
    estimatedTimeMinutes: 8,
    evidencePolicy: "none",
    boardTemplateId: "calma-respiracion",
    materials: [
      {
        type: "link",
        title: "Breath EDUmind",
        description: "Respiracion guiada embebida en el board.",
        url: "https://breath.edumind.es/?embed=1&board=1"
      },
      {
        type: "widget",
        title: "Temporizador de calma",
        description: "Tiempo visible para la rutina.",
        widgetType: "timer"
      }
    ],
    steps: [
      {
        title: "Preparacion",
        teacherNotes: "Baja estimulo visual, proyecta el board y marca la consigna.",
        studentPrompt: "Adopta una postura comoda y mira la guia visual.",
        durationMinutes: 2,
        expectedEvidence: "none"
      },
      {
        title: "Respiracion guiada",
        teacherNotes: "Mantener ritmo estable. No introducir explicaciones largas durante la rutina.",
        studentPrompt: "Sigue el ritmo: inhala, mantiene y exhala.",
        durationMinutes: 3,
        expectedEvidence: "none"
      },
      {
        title: "Vuelta a la tarea",
        teacherNotes: "Cierra con una instruccion concreta de continuidad.",
        studentPrompt: "Vuelve a la actividad indicada en silencio.",
        durationMinutes: 3,
        expectedEvidence: "none"
      }
    ]
  }
];

export function getActivityBlueprint(id: string) {
  return ACTIVITY_BLUEPRINTS.find((activity) => activity.id === id);
}

export function getActivityTemplate(activity: ActivityBlueprint): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((template) => template.id === activity.boardTemplateId);
}

export function createActivity(activity: ActivityBlueprint, options: { includeBoard?: boolean } = {}): Activity {
  const now = new Date().toISOString();
  const template = getActivityTemplate(activity);
  const next = {
    schemaVersion: 1,
    id: newId(),
    title: activity.title,
    objective: activity.objective,
    profileId: activity.profileId,
    estimatedTimeMinutes: activity.estimatedTimeMinutes,
    evidencePolicy: activity.evidencePolicy,
    boardTemplateId: activity.boardTemplateId,
    materials: activity.materials.map((material) => ({ id: newId(), ...material })),
    steps: activity.steps.map((step) => ({
      id: newId(),
      boardElementIds: step.boardElementIds ?? [],
      ...step
    })),
    board: options.includeBoard && template ? applyTemplate(template) : undefined,
    createdAt: now,
    updatedAt: now
  };

  return activitySchema.parse(next);
}

export function createActivityBoard(activity: ActivityBlueprint) {
  const template = getActivityTemplate(activity);
  return template ? applyTemplate(template) : null;
}
