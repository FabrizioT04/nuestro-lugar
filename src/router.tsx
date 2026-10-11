import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { MemoriesPage } from "@/pages/MemoriesPage";
import { UsPage } from "@/pages/UsPage";
import { PlansPage } from "@/pages/PlansPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { IntroPage } from "@/pages/IntroPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Las rutas viven en español porque son las que ve la pareja en la barra de direcciones.
export const router = createBrowserRouter([
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
]);
