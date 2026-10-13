import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { lastLoginError, onMobileSessionChange, startGoogleLogin } from "@/auth/mobileSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Pantalla de entrada de la app de Android. Google se abre en el navegador del sistema: la contraseña
 * se escribe ahí, nunca en la app. Solo entran los dos correos permitidos.
 */
export function MobileLoginPage() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(lastLoginError());

  // Si la persona cierra el navegador sin terminar, el botón vuelve a estar disponible.
  useEffect(() => {
    const listener = App.addListener("resume", () => setOpening(false));
    return () => void listener.then((handle) => handle.remove());
  }, []);

  // Si el regreso de Google trae un error, se muestra aquí.
  useEffect(
    () =>
      onMobileSessionChange(() => {
        setOpening(false);
        setError(lastLoginError());
      }),
    [],
  );

  async function login() {
    setOpening(true);
    setError(null);
    try {
      await startGoogleLogin();
    } catch {
      setOpening(false);
      setError("No se pudo abrir el navegador. Inténtalo otra vez.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-gradient-to-b from-cream via-blush-50 to-lavender-100 px-6 pt-safe pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="animate-fade-up text-center">
        <p className="text-4xl" aria-hidden>
          ♡
        </p>
        <h1 className="mt-3 text-4xl">Nuestro Lugar</h1>
        <p className="mt-2 text-ink-soft">Un lugar solo para nosotros.</p>
      </div>

      <Card className="mt-10 animate-fade-up space-y-4 text-center [animation-delay:80ms]">
        <Button className="w-full" onClick={() => void login()} disabled={opening}>
          <GoogleMark /> {opening ? "Abriendo Google…" : "Entrar con Google"}
        </Button>
        {error && (
          <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </p>
        )}
        <p className="text-xs text-ink-soft">Solo pueden entrar sus dos cuentas. La contraseña se escribe en la página de Google.</p>
      </Card>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
