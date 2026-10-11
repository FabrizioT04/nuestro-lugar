import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAuth, useMe } from "@/auth/AuthContext";
import { Polaroid } from "@/components/Polaroid";
import { Button } from "@/components/ui/Button";
import { meApi } from "@/services/api/me";

interface Slide {
  text: string;
  art?: ReactNode;
}

const SLIDES: Slide[] = [
  { text: "Todo comenzó con pequeños momentos…", art: <Polaroid tilt={-4} className="w-56" /> },
  {
    text: "Y poco a poco comenzaron a convertirse en recuerdos.",
    art: (
      <div className="relative h-64 w-64">
        <Polaroid tilt={-8} className="absolute top-2 left-0 w-44" />
        <Polaroid tilt={6} className="absolute right-0 bottom-0 w-44 [animation-delay:1.5s]" />
      </div>
    ),
  },
  { text: "Así que hice un lugar para guardarlos." },
  { text: "Un lugar solo para nosotros. ❤️" },
];

const SWIPE_THRESHOLD_PX = 50;

/** Introducción romántica: se muestra una vez por usuario y puede repetirse desde el Perfil. */
export function IntroPage() {
  const me = useMe();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const swipeStart = useRef<number | null>(null);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index]!;
  const next = () => setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  const previous = () => setIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function enter() {
    if (me.user.introSeenAt) {
      navigate("/", { replace: true });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await meApi.markIntroSeen();
      await refresh();
      navigate("/", { replace: true });
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
      setSaving(false);
    }
  }

  return (
    <main
      className="relative mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden bg-gradient-to-b from-cream via-blush-50 to-lavender-100 px-6 pt-safe pb-[max(2rem,env(safe-area-inset-bottom))] select-none"
      onPointerDown={(event) => (swipeStart.current = event.clientX)}
      onPointerUp={(event) => {
        if (swipeStart.current === null) return;
        const delta = event.clientX - swipeStart.current;
        swipeStart.current = null;
        if (delta < -SWIPE_THRESHOLD_PX) next();
        else if (delta > SWIPE_THRESHOLD_PX) previous();
      }}
    >
      <div className="flex h-10 items-center justify-end">
        {!isLast && (
          <button type="button" onClick={() => setIndex(SLIDES.length - 1)} className="text-sm font-semibold text-ink-soft">
            Saltar
          </button>
        )}
      </div>

      {/* Tocar la pantalla avanza, como en una historia. */}
      <button
        type="button"
        key={index}
        onClick={isLast ? undefined : next}
        disabled={isLast}
        aria-label={isLast ? undefined : "Siguiente"}
        className="flex flex-1 cursor-default flex-col items-center justify-center gap-10 text-center"
      >
        {slide.art && <div className="animate-fade-in">{slide.art}</div>}
        <p className="max-w-xs animate-fade-up font-display text-3xl leading-snug text-ink [animation-delay:150ms]">
          {slide.text}
        </p>
      </button>

      <div className="flex flex-col items-center gap-6">
        {isLast ? (
          <div className="flex w-full animate-fade-up flex-col items-center gap-3 [animation-delay:500ms]">
            <Button className="w-full max-w-xs py-4 text-lg" onClick={enter} disabled={saving}>
              {saving ? "Entrando…" : "Entrar a nuestro lugar"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-blush-700">
                {error}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Toca para continuar</p>
        )}

        <ol className="flex gap-2" aria-label={`Pantalla ${index + 1} de ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <li
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-6 bg-blush-300" : "w-1.5 bg-blush-200"}`}
            />
          ))}
        </ol>
      </div>
    </main>
  );
}
