// Sistema propio de avisos: toasts no bloqueantes y diálogo de confirmación.
// Sustituye a alert()/confirm() nativos. Uso:
//   toast("Guardado", "success")
//   if (await confirmDialog({ message: "¿Borrar?" })) { ... }
// <FeedbackHost/> debe montarse una vez en la raíz de cada vista.
import { useEffect } from "react";
import { create } from "zustand";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "info" | "success" | "error";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastOptions = {
  /** null = no se autodescarta (para avisos que requieren acción del usuario). */
  duration?: number | null;
  action?: ToastAction;
};

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number | null;
  action?: ToastAction;
};

type ConfirmRequest = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (accepted: boolean) => void;
};

type FeedbackState = {
  toasts: Toast[];
  confirmRequest: ConfirmRequest | null;
  pushToast: (message: string, kind: ToastKind, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
  openConfirm: (request: ConfirmRequest) => void;
  settleConfirm: (accepted: boolean) => void;
};

let toastSeq = 0;

const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toasts: [],
  confirmRequest: null,
  pushToast: (message, kind, options) => {
    const id = ++toastSeq;
    const duration = options?.duration === undefined
      ? (kind === "error" ? 7000 : 4200)
      : options.duration;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, kind, message, duration, action: options?.action }]
    }));
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  openConfirm: (request) => {
    // Si ya hay un diálogo abierto, el anterior se resuelve como cancelado
    get().confirmRequest?.resolve(false);
    set({ confirmRequest: request });
  },
  settleConfirm: (accepted) => {
    get().confirmRequest?.resolve(accepted);
    set({ confirmRequest: null });
  }
}));

export function toast(message: string, kind: ToastKind = "info", options?: ToastOptions) {
  useFeedbackStore.getState().pushToast(message, kind, options);
}

export function confirmDialog(options: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    useFeedbackStore.getState().openConfirm({ ...options, resolve });
  });
}

const TOAST_ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle
};

function ToastItem({ item }: { item: Toast }) {
  const dismissToast = useFeedbackStore((s) => s.dismissToast);
  useEffect(() => {
    if (item.duration === null) return; // persistente: solo se cierra por acción o botón
    const timeout = window.setTimeout(() => dismissToast(item.id), item.duration);
    return () => window.clearTimeout(timeout);
  }, [item.id, item.duration, dismissToast]);

  const Icon = TOAST_ICONS[item.kind];
  return (
    <div className={`toast toast-${item.kind}`} role={item.kind === "error" ? "alert" : "status"}>
      <Icon size={17} aria-hidden="true" />
      <span>{item.message}</span>
      {item.action && (
        <button type="button" className="toast-action"
          onClick={() => { item.action?.onClick(); dismissToast(item.id); }}>
          {item.action.label}
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => dismissToast(item.id)}>
        <X size={14} />
      </button>
    </div>
  );
}

export function FeedbackHost() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const confirmRequest = useFeedbackStore((s) => s.confirmRequest);
  const settleConfirm = useFeedbackStore((s) => s.settleConfirm);

  // Escape cancela el diálogo de confirmación
  useEffect(() => {
    if (!confirmRequest) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); settleConfirm(false); }
      if (event.key === "Enter") { event.stopPropagation(); settleConfirm(true); }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmRequest, settleConfirm]);

  return (
    <>
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((item) => <ToastItem key={item.id} item={item} />)}
        </div>
      )}
      {confirmRequest && (
        <div className="confirm-backdrop" role="presentation" onClick={() => settleConfirm(false)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true"
            aria-label={confirmRequest.title ?? "Confirmación"}
            onClick={(event) => event.stopPropagation()}>
            <h2>{confirmRequest.title ?? "¿Confirmar?"}</h2>
            <p>{confirmRequest.message}</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => settleConfirm(false)} autoFocus={!confirmRequest.danger}>
                {confirmRequest.cancelLabel ?? "Cancelar"}
              </button>
              <button type="button"
                className={confirmRequest.danger ? "confirm-danger" : "primary"}
                autoFocus={confirmRequest.danger}
                onClick={() => settleConfirm(true)}>
                {confirmRequest.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
