import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { AuthProvider } from "./auth/AuthProvider";
import { startSync } from "./offline/sync";
import { isNativeApp } from "./platform/native";
import { startNativeApp } from "./platform/nativeApp";
import { listenForInstallPrompt } from "./pwa/install";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import { router } from "./router";
import "./styles/index.css";

async function start() {
  if (isNativeApp) {
    // En la app los archivos ya vienen dentro del APK: no hace falta service worker ni "instalar".
    await startNativeApp((path) => void router.navigate(path));
  } else {
    listenForInstallPrompt();
    registerServiceWorker();
  }
  startSync();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </StrictMode>,
  );
}

void start();
