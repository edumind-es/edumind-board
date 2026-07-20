import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Activity } from "@edumind-board/shared";

export function ActivityGuide({
  activity,
  onClose
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = activity.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === activity.steps.length - 1;

  return (
    <aside className="activity-guide" aria-label="Actividad guiada">
      <div className="activity-guide-header">
        <span>
          <strong>{activity.title}</strong>
          <small>{activity.estimatedTimeMinutes} min · paso {stepIndex + 1}/{activity.steps.length}</small>
        </span>
        <button type="button" className="icon-only" title="Cerrar actividad" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="activity-guide-progress" aria-hidden="true">
        {activity.steps.map((item, index) => (
          <span key={item.id} className={index <= stepIndex ? "activity-step-done" : ""} />
        ))}
      </div>

      <section className="activity-guide-body">
        <h2>{step.title}</h2>
        <p>{step.studentPrompt || activity.objective}</p>
        {step.teacherNotes && <small>{step.teacherNotes}</small>}
        <div className="activity-guide-meta">
          <span>{step.durationMinutes || 0} min</span>
          <span>Evidencia: {step.expectedEvidence}</span>
        </div>
      </section>

      <div className="activity-guide-actions">
        <button type="button" disabled={isFirst} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>
          <ChevronLeft size={16} />
          Anterior
        </button>
        <button type="button" className="primary" onClick={() => {
          if (isLast) onClose();
          else setStepIndex((current) => Math.min(activity.steps.length - 1, current + 1));
        }}>
          {isLast ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
          {isLast ? "Finalizar" : "Siguiente"}
        </button>
      </div>
    </aside>
  );
}
