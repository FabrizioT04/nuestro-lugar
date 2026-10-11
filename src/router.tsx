import { createBrowserRouter } from "react-router";
import { RequireAuth, SETUP_PATH } from "@/auth/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { MemoriesPage } from "@/pages/MemoriesPage";
import { UsPage } from "@/pages/UsPage";
import { PlansPage } from "@/pages/PlansPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { IntroPage } from "@/pages/IntroPage";
import { SetupPage } from "@/pages/SetupPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Las rutas viven en español porque son las que ve la pareja en la barra de direcciones.
// Todas pasan por RequireAuth: no hay ninguna pantalla pública.
export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      { path: SETUP_PATH, element: <SetupPage /> },
      { path: "/bienvenida", element: <IntroPage /> },
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "recuerdos", element: <MemoriesPage /> },
          { path: "nosotros", element: <UsPage /> },
          { path: "planes", element: <PlansPage /> },
          { path: "perfil", element: <ProfilePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
