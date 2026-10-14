import { useState } from "react";
import { ClipboardPaste, ExternalLink, Heart, Music, Play, Plus, Trash2 } from "lucide-react";
import type { HomeResponse, Song } from "@shared/api";
import { parseSongLink } from "@shared/songs";
import { useMe } from "@/auth/AuthContext";
import { FavoriteBurst } from "@/components/fx/FavoriteBurst";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Overlay } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { readCache, writeCache } from "@/offline/cache";
import { songsApi } from "@/services/api/songs";
import { formatShortDateIn } from "@/utils/format";

const loadSongs = () => songsApi.list();

type Box = "forMe" | "mine";

/** Canciones que uno le recomienda al otro, con su reproductor dentro de la app. */
export function SongsPage() {
  const me = useMe();
  const songs = useAsync(loadSongs, { cacheKey: "songs" });
  const [box, setBox] = useState<Box>("forMe");
  const [adding, setAdding] = useState(false);
  // Cambios hechos aquí (escuchada, me encantó) sin volver a pedir toda la lista.
  const [patched, setPatched] = useState<Record<string, Song>>({});
  const timezone = me.relationship?.timezone ?? "UTC";
  const partner = me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  const all = songs.status === "success" ? songs.data.items.map((song) => patched[song.id] ?? song) : [];
  const shown = all.filter((song) => (box === "mine" ? song.isMine : !song.isMine));
  const unheard = all.filter((song) => !song.isMine && !song.listenedAt).length;
  const update = (song: Song) => setPatched((current) => ({ ...current, [song.id]: song }));

  return (
    <section>
      <header className="mb-2 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-4xl tracking-tighter">Canciones</h1>
        <button type="button" className="nl-action" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden /> Recomendar
        </button>
      </header>
      <p className="mb-5 animate-fade-up text-sm text-ink-soft [animation-delay:40ms]">
        Pega un enlace de Spotify o YouTube y déjale unas palabras a {partner}.
      </p>

      <div className="nl-tabs mb-5 animate-fade-up [animation-delay:80ms]" role="tablist" aria-label="Canciones">
        <button type="button" role="tab" aria-selected={box === "forMe"} className="nl-tab" onClick={() => setBox("forMe")}>
          Para ti{unheard > 0 ? ` · ${unheard} nueva${unheard === 1 ? "" : "s"}` : ""}
        </button>
        <button type="button" role="tab" aria-selected={box === "mine"} className="nl-tab" onClick={() => setBox("mine")}>
          Las que diste
        </button>
      </div>

      {songs.status === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {songs.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{songs.message}</p>
          <Button variant="secondary" className="mt-4" onClick={songs.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {songs.status === "success" &&
        (shown.length === 0 ? (
          <Card className="text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blush-100 text-blush-500">
              <Music size={26} strokeWidth={1.5} aria-hidden />
            </span>
            <p className="font-medium text-ink">{box === "forMe" ? `${partner} todavía no te recomendó canciones` : "Todavía no recomendaste canciones"}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {box === "forMe" ? "Cuando lo haga, aparecerán aquí para escucharlas." : "Toca Recomendar y pega el enlace de una canción."}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {shown.map((song, index) => (
              <li key={song.id} className="animate-tile-in" style={{ animationDelay: `${120 + Math.min(index, 6) * 60}ms` }}>
                <SongCard
                  song={song}
                  partner={partner}
                  when={formatShortDateIn(song.createdAt, timezone)}
                  onChange={update}
                  onDeleted={songs.reload}
                />
              </li>
            ))}
          </ul>
        ))}

      {adding && (
        <AddSongSheet
          partner={partner}
          onCancel={() => setAdding(false)}
          onSent={() => {
            setAdding(false);
            setBox("mine");
            songs.reload();
          }}
        />
      )}
    </section>
  );
}

const PROVIDER_NAME = { spotify: "Spotify", youtube: "YouTube" } as const;

/** Spotify muestra la canción en una tira; un álbum o una playlist necesita más alto. YouTube es un video. */
function playerClass(embedUrl: string): string {
  if (embedUrl.includes("youtube")) return "aspect-video";
  return /\/embed\/(track|episode)\//.test(embedUrl) ? "h-[152px]" : "h-[352px]";
}

function Player({ embedUrl, title }: { embedUrl: string; title: string }) {
  return (
    <iframe
      src={embedUrl}
      title={title}
      className={`w-full rounded-2xl border-0 bg-blush-200 ${playerClass(embedUrl)}`}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

/** Al abrir el reproductor por primera vez, el globito del inicio baja también en la copia guardada. */
async function lowerCachedBadge() {
  const entry = await readCache<HomeResponse>("home");
  const badges = entry?.value.badges;
  if (!entry || !badges?.songs) return;
  await writeCache("home", { ...entry.value, badges: { ...badges, songs: badges.songs - 1 } });
}

function SongCard({ song, partner, when, onChange, onDeleted }: {
  song: Song;
  partner: string;
  when: string;
  onChange: (song: Song) => void;
  onDeleted: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [likes, setLikes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = song.title ?? `Canción de ${PROVIDER_NAME[song.provider]}`;
  const isNew = !song.isMine && !song.listenedAt;

  function play() {
    setPlaying(true);
    if (!isNew) return;
    onChange({ ...song, listenedAt: new Date().toISOString() });
    void lowerCachedBadge().catch(() => undefined);
    void songsApi.markListened(song.id).then(onChange, () => undefined);
  }

  async function toggleLove() {
    const loved = !song.loved;
    if (loved) setLikes((count) => count + 1);
    onChange({ ...song, loved, listenedAt: song.listenedAt ?? new Date().toISOString() });
    try {
      onChange(await songsApi.love(song.id, loved));
    } catch (err) {
      onChange(song);
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function remove() {
    if (!window.confirm("¿Quitar esta canción? No se puede deshacer.")) return;
    setBusy(true);
    try {
      await songsApi.remove(song.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar");
      setBusy(false);
    }
  }

  return (
    <article className="rounded-card bg-blush-50 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={play}
          aria-label={`Escuchar ${title}`}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink text-paper transition active:scale-95"
        >
          {song.thumbnailUrl && <img src={song.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
          <span className={`absolute inset-0 flex items-center justify-center ${song.thumbnailUrl && !playing ? "bg-ink/25" : ""}`}>
            {playing ? !song.thumbnailUrl && <Music size={24} aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            {isNew && <span className="animate-pop-in shrink-0 rounded-full bg-blush-500 px-2 py-0.5 text-[11px] font-bold text-white">Nueva</span>}
            <span className="truncate font-semibold text-ink">{title}</span>
          </p>
          <p className="truncate text-sm text-ink-soft">
            {song.artist ? `${song.artist} · ` : ""}
            {PROVIDER_NAME[song.provider]}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {song.isMine ? `Para ${partner}` : `De ${song.author.displayName}`} · {when}
          </p>
        </div>
      </div>

      {song.note && <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-[15px] leading-snug text-ink">“{song.note}”</p>}

      {playing && (
        <div className="mt-3 animate-fade-up">
          <Player embedUrl={song.embedUrl} title={title} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!playing && (
          <button type="button" className="nl-action bg-ink text-paper hover:bg-ink/85" onClick={play}>
            <Play size={16} fill="currentColor" aria-hidden /> Escuchar
          </button>
        )}
        <a href={song.url} target="_blank" rel="noopener noreferrer" className="nl-action bg-paper">
          <ExternalLink size={16} aria-hidden /> Abrir en {PROVIDER_NAME[song.provider]}
        </a>
        {!song.isMine && (
          <button
            type="button"
            onClick={() => void toggleLove()}
            aria-pressed={song.loved}
            aria-label={song.loved ? "Te encantó" : "Me encantó"}
            className={`nl-action relative ${song.loved ? "bg-blush-100 text-blush-500 hover:bg-blush-100" : "bg-paper"}`}
          >
            <Heart key={likes} size={16} fill={song.loved ? "currentColor" : "none"} className={likes > 0 && song.loved ? "animate-heart-beat" : undefined} aria-hidden />
            {likes > 0 && song.loved && <FavoriteBurst key={`burst-${likes}`} />}
            {song.loved ? "Te encantó" : "Me encantó"}
          </button>
        )}
        {song.isMine && (
          <>
            <span className="text-sm text-ink-soft">
              {song.loved ? `A ${partner} le encantó ❤️` : song.listenedAt ? `${partner} ya la escuchó` : "Todavía sin escuchar"}
            </span>
            <button type="button" onClick={() => void remove()} disabled={busy} aria-label="Quitar canción" className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-blush-200">
              <Trash2 size={17} aria-hidden />
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-blush-700">{error}</p>}
    </article>
  );
}

function AddSongSheet({ partner, onCancel, onSent }: { partner: string; onCancel: () => void; onSent: () => void }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseSongLink(url);
  const canPaste = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

  async function paste() {
    try {
      setUrl((await navigator.clipboard.readText()).trim());
    } catch {
      setError("No se pudo pegar. Mantén presionado el cuadro y elige Pegar.");
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      await songsApi.create({ url, note });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
      setSending(false);
    }
  }

  return (
    <Overlay label="Recomendar una canción" onClose={sending ? undefined : onCancel}>
      <h2 className="pr-10 text-2xl tracking-tight">Recomendar una canción</h2>
      <p className="mt-1 text-sm text-ink-soft">En Spotify o YouTube toca Compartir → Copiar enlace, y pégalo aquí.</p>

      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="song-url">
        Enlace
      </label>
      <div className="flex items-center gap-2">
        <input
          id="song-url"
          className="nl-input"
          inputMode="url"
          autoComplete="off"
          value={url}
          placeholder="https://open.spotify.com/track/…"
          onChange={(event) => setUrl(event.target.value)}
        />
        {canPaste && (
          <button type="button" className="nl-action mt-1" onClick={() => void paste()}>
            <ClipboardPaste size={16} aria-hidden /> Pegar
          </button>
        )}
      </div>
      {url.trim() !== "" && !parsed && !/spotify\.(link|app\.link)/.test(url) && (
        <p className="mt-2 text-sm text-blush-700">Ese enlace no es de Spotify ni de YouTube.</p>
      )}
      {parsed && (
        <div className="mt-3 animate-fade-up">
          <Player embedUrl={parsed.embedUrl} title="Vista previa" />
        </div>
      )}

      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="song-note">
        Unas palabras para {partner} (opcional)
      </label>
      <textarea
        id="song-note"
        className="nl-input min-h-20 resize-none"
        maxLength={280}
        value={note}
        placeholder="Esta me recuerda a ti…"
        onChange={(event) => setNote(event.target.value)}
      />
      {error && <p className="mt-3 text-sm text-blush-700">{error}</p>}
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={sending}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={() => void send()} disabled={sending || url.trim() === ""}>
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </Overlay>
  );
}
