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
        <strong>Modo local</strong> · Tus tableros se guardan en este dispositivo, sin cuenta ni conexión.
        Conecta tu cuenta EDUmind para sincronizarlos en la nube, compartir en vivo y publicar.
      </span>
      <a className="auth-banner-login" href={getLoginUrl()}>
        Conectar cuenta
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
