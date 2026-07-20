import type { BoardElementType, ThemeName } from "@edumind-board/shared";

export type ClassroomProfile = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  emoji: string;
  templateId: string;
  theme: ThemeName;
  favoriteWidgetTypes: BoardElementType[];
};

export const CLASSROOM_PROFILES: ClassroomProfile[] = [
  {
    id: "desktop",
    name: "Escritorio docente",
    shortName: "Docente",
    description: "Inicio de aula con widgets, recursos y apps EDUmind visibles.",
    emoji: "🖥️",
    templateId: "escritorio-docente",
    theme: "edumind",
    favoriteWidgetTypes: ["timer", "semaphore", "note", "hub"]
  },
  {
    id: "math",
    name: "Matemáticas manipulativas",
    shortName: "Mate",
    description: "Base 10, cuadrícula y pauta para construir y explicar.",
    emoji: "🔢",
    templateId: "mates-base10",
    theme: "edumind",
    favoriteWidgetTypes: ["mates3d", "base10", "math", "algorithm"]
  },
  {
    id: "cooperative",
    name: "Trabajo cooperativo",
    shortName: "Equipo",
    description: "Plan de equipo, roles y seguimiento visual de acuerdos.",
    emoji: "🤝",
    templateId: "aula-plan-cooperativo",
    theme: "edumind",
    favoriteWidgetTypes: ["note", "comment", "flow", "timer"]
  },
  {
    id: "calm",
    name: "Calma y autorregulación",
    shortName: "Calma",
    description: "Rutinas breves con respiración, timer y guía visual.",
    emoji: "🌿",
    templateId: "calma-respiracion",
    theme: "eink",
    favoriteWidgetTypes: ["timer", "noise", "note", "guidelines"]
  },
  {
    id: "session",
    name: "Sesión activa",
    shortName: "Sesión",
    description: "Semáforo, timer y consigna para dirigir la clase.",
    emoji: "🏃",
    templateId: "ef-semaforo",
    theme: "edumind",
    favoriteWidgetTypes: ["semaphore", "timer", "dice", "spinner"]
  }
];

export const DEFAULT_PROFILE_ID = "desktop";

export const DEFAULT_TEMPLATE_ID =
  CLASSROOM_PROFILES.find((profile) => profile.id === DEFAULT_PROFILE_ID)?.templateId ?? "blank";

export function getClassroomProfile(id: string) {
  return CLASSROOM_PROFILES.find((profile) => profile.id === id);
}

export function getClassroomProfileByTemplate(templateId: string) {
  return CLASSROOM_PROFILES.find((profile) => profile.templateId === templateId);
}
