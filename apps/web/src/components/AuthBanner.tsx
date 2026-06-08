import { useState } from "react";
import { X } from "lucide-react";
import { dismissBanner, getLoginUrl, isBannerDismissed } from "../lib/auth";

export function AuthBanner() {
  const [visible, setVisible] = useState(!isBannerDismissed());

  if (!visible) return null;

  function handleDismiss() {
    dismissBanner();
    setVisible(false);
  }

  return (
    <div className="auth-banner" role="status" aria-live="polite">
      <span className="auth-banner-text">
        <strong>Modo local</strong> · Los boards se guardan solo en este dispositivo.
        Inicia sesión con tu cuenta EDUmind para guardar en la nube y acceder desde cualquier lugar.
      </span>
      <a className="auth-banner-login" href={getLoginUrl()}>
        Iniciar sesión
      </a>
      <button
        type="button"
        className="auth-banner-close icon-only"
        title="Cerrar"
        onClick={handleDismiss}
        aria-label="Cerrar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}
