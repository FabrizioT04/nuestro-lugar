import { createBrowserRouter } from "react-router";
import { INTRO_PATH, RequireAuth, SETUP_PATH } from "@/auth/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { MemoriesPage } from "@/pages/MemoriesPage";
import { MemoryDetailPage } from "@/pages/MemoryDetailPage";
import { MemoryFormPage } from "@/pages/MemoryFormPage";
import { UsPage } from "@/pages/UsPage";
import { PlansPage } from "@/pages/PlansPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { IntroPage } from "@/pages/IntroPage";
import { SetupPage } from "@/pages/SetupPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LettersPage } from "@/pages/LettersPage";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { FuturePage } from "@/pages/FuturePage";

// Las rutas viven en español porque son las que ve la pareja en la barra de direcciones.
// Todas pasan por RequireAuth: no hay ninguna pantalla pública.
export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      { path: SETUP_PATH, element: <SetupPage /> },
      { path: INTRO_PATH, element: <IntroPage /> },
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "recuerdos", element: <MemoriesPage /> },
          { path: "recuerdos/nuevo", element: <MemoryFormPage /> },
          { path: "recuerdos/:id", element: <MemoryDetailPage /> },
          { path: "recuerdos/:id/editar", element: <MemoryFormPage /> },
          { path: "nosotros", element: <UsPage /> },
          { path: "planes", element: <PlansPage /> },
          { path: "perfil", element: <ProfilePage /> },
          { path: "cartas", element: <LettersPage /> },
          { path: "descubrir", element: <DiscoverPage /> },
          { path: "futuro", element: <FuturePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
