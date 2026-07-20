import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { setupPwaUpdates } from "./lib/registerPwa";
import { initProjectionTheme } from "./lib/projection";
import "./styles.css";

// Aplica el modo noche guardado antes del render (evita parpadeo claro→oscuro).
initProjectionTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registro del service worker con actualización automática controlada.
setupPwaUpdates();
