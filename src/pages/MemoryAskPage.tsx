import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Sparkles, WifiOff } from "lucide-react";
import type { MemorySearchResponse } from "@shared/api";
import { MemoryCard } from "@/components/memories/MemoryCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ApiError } from "@/services/api/client";
import { memoriesApi } from "@/services/api/memories";
import { plural } from "@/utils/format";

const EXAMPLES = ["¿Cuándo fuimos por primera vez a la playa?", "Muéstrame cuando fuimos a comer pizza", "Quiero recordar algún viaje bonito"];

/** "Pregúntale a nuestros recuerdos": búsqueda por significado con una respuesta corta. */
export function MemoryAskPage() {
  const online = useOnlineStatus();
  const [params, setParams] = useSearchParams();
  const [question, setQuestion] = useState(params.get("p") ?? "");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<MemorySearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Desde la búsqueda rápida ("Preguntarle a la IA") se pregunta sola al abrir, una vez.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (autoAsked.current || params.get("preguntar") !== "1") return;
    autoAsked.current = true;
    void ask();
  }, []); // solo al abrir la pantalla

  async function ask(event?: FormEvent, text = question) {
    event?.preventDefault();
    const value = text.trim();
    if (value.length < 3) return;
    setQuestion(value);
    setParams({ p: value }, { replace: true });
    setAsking(true);
    setError(null);
    try {
      setResult(await memoriesApi.ask(value));
    } catch (err) {
      setResult(null);
      setError(
        err instanceof ApiError && err.code === "network_error"
          ? "Sin conexión: para buscar en sus recuerdos hace falta Internet."
          : err instanceof Error
            ? err.message
            : "No se pudo buscar.",
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="animate-fade-up">
        <Link to="/recuerdos" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft">
          <ArrowLeft size={16} aria-hidden /> Recuerdos
        </Link>
        <h1 className="text-4xl tracking-tighter">Pregúntale a sus recuerdos</h1>
        <p className="mt-1 text-ink-soft">Escribe como lo dirías. Buscamos por lo que significa, no solo por palabras.</p>
      </header>

      {!online && (
        <p className="flex items-center gap-2 rounded-2xl bg-lavender-100 px-4 py-3 text-sm text-ink">
          <WifiOff size={16} aria-hidden /> Sin conexión: para preguntar hace falta Internet.
        </p>
      )}

      <form onSubmit={(e) => void ask(e)} className="animate-fade-up space-y-3 [animation-delay:60ms]">
        <Card className="space-y-3">
          <label htmlFor="ask-question" className="sr-only">
            Tu pregunta
          </label>
          <textarea
            id="ask-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            maxLength={300}
            rows={2}
            className="w-full resize-none rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100"
            placeholder={EXAMPLES[0]}
          />
          {!result && !asking && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void ask(undefined, example)}
                  className="rounded-full bg-cream px-3.5 py-2 text-left text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </Card>
        <Button type="submit" className="w-full" disabled={asking || !online || question.trim().length < 3}>
          <Sparkles size={18} aria-hidden /> {asking ? "Buscando en sus recuerdos…" : "Preguntar"}
        </Button>
      </form>

      {asking && (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      )}

      {error && !asking && (
        <Card role="alert" className="text-center text-ink-soft">
          {error}
        </Card>
      )}

      {result && !asking && (
        <div className="space-y-4">
          {result.answer && (
            <Card className="animate-fade-up border border-lavender-300/60 bg-lavender-100/60">
              <p className="flex gap-2 font-display text-xl leading-snug">
                <Sparkles size={20} className="mt-1 shrink-0 text-lavender-500" aria-hidden />
                <span>{result.answer}</span>
              </p>
            </Card>
          )}
          {(result.mode === "keywords" || result.pendingIndex > 0) && (
            <p className="text-sm text-ink-soft">
              {result.mode === "keywords"
                ? "La búsqueda inteligente no está disponible ahora; buscamos por palabras."
                : `Todavía estamos preparando ${plural(result.pendingIndex, "recuerdo")} para la búsqueda. Pregunta otra vez en un momento.`}
            </p>
          )}
          {result.items.length > 0 && (
            <ul className="space-y-4">
              {result.items.map((memory) => (
                <li key={memory.id} className="animate-fade-up">
                  <MemoryCard memory={memory} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
