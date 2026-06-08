import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    };

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      activateWaitingWorker(registration);
      registration.update().catch(() => {});
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            activateWaitingWorker(registration);
          }
        });
      });
    }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
