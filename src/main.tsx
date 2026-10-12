import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { AuthProvider } from "./auth/AuthProvider";
import { startSync } from "./offline/sync";
import { listenForInstallPrompt } from "./pwa/install";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import { router } from "./router";
import "./styles/index.css";

listenForInstallPrompt();
registerServiceWorker();
startSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
