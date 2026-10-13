import { createBrowserRouter } from "react-router";
import { INTRO_PATH, RequireAuth, SETUP_PATH } from "@/auth/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { MemoriesPage } from "@/pages/MemoriesPage";
import { MemoryDetailPage } from "@/pages/MemoryDetailPage";
import { MemoryAskPage } from "@/pages/MemoryAskPage";
import { MemoryFormPage } from "@/pages/MemoryFormPage";
import { UsPage } from "@/pages/UsPage";
import { ImportantDateFormPage } from "@/pages/ImportantDateFormPage";
import { TimelinePage } from "@/pages/TimelinePage";
import { PlansPage } from "@/pages/PlansPage";
import { PlanDetailPage } from "@/pages/PlanDetailPage";
import { PlanFormPage } from "@/pages/PlanFormPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { IntroPage } from "@/pages/IntroPage";
import { SetupPage } from "@/pages/SetupPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LettersPage } from "@/pages/LettersPage";
import { LetterDetailPage } from "@/pages/LetterDetailPage";
import { LetterFormPage } from "@/pages/LetterFormPage";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { FuturePage } from "@/pages/FuturePage";
import { CapsuleDetailPage } from "@/pages/CapsuleDetailPage";
import { CapsuleFormPage } from "@/pages/CapsuleFormPage";
import { DrawingsPage } from "@/pages/DrawingsPage";

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
          { path: "recuerdos/preguntar", element: <MemoryAskPage /> },
          { path: "recuerdos/:id", element: <MemoryDetailPage /> },
          { path: "recuerdos/:id/editar", element: <MemoryFormPage /> },
          { path: "nosotros", element: <UsPage /> },
          { path: "nosotros/historia", element: <TimelinePage /> },
          { path: "nosotros/fechas/nueva", element: <ImportantDateFormPage /> },
          { path: "nosotros/fechas/:id", element: <ImportantDateFormPage /> },
          { path: "planes", element: <PlansPage /> },
          { path: "planes/nuevo", element: <PlanFormPage /> },
          { path: "planes/:id", element: <PlanDetailPage /> },
          { path: "planes/:id/editar", element: <PlanFormPage /> },
          { path: "perfil", element: <ProfilePage /> },
          { path: "cartas", element: <LettersPage /> },
          { path: "cartas/nueva", element: <LetterFormPage /> },
          { path: "cartas/:id", element: <LetterDetailPage /> },
          { path: "cartas/:id/editar", element: <LetterFormPage /> },
          { path: "descubrir", element: <DiscoverPage /> },
          { path: "futuro", element: <FuturePage /> },
          { path: "futuro/nueva", element: <CapsuleFormPage /> },
          { path: "futuro/:id", element: <CapsuleDetailPage /> },
          { path: "futuro/:id/editar", element: <CapsuleFormPage /> },
          { path: "dibujos", element: <DrawingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
