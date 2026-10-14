// Enlaces de canciones que se recomiendan entre ellos. Solo Spotify y YouTube (incluido YouTube Music):
// los dos tienen un reproductor que se puede poner dentro de la app sin cuentas ni claves.

export type SongProvider = "spotify" | "youtube";

export interface ParsedSongLink {
  provider: SongProvider;
  /** Enlace limpio (sin ?si= ni rastreadores) que se guarda y se abre en la app de música. */
  url: string;
  /** Página del reproductor que va dentro de un <iframe>. */
  embedUrl: string;
}

const SPOTIFY_KINDS = new Set(["track", "album", "playlist", "episode", "show", "artist"]);
const YOUTUBE_ID = /^[\w-]{11}$/;

/** Reconoce un enlace de Spotify o YouTube. Devuelve null si no es ninguno de los dos. */
export function parseSongLink(raw: string): ParsedSongLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "open.spotify.com") {
    // Los enlaces compartidos desde otro país traen /intl-es/ delante.
    if (parts[0]?.startsWith("intl-")) parts.shift();
    const [kind, id] = parts;
    if (!kind || !id || !SPOTIFY_KINDS.has(kind) || !/^[A-Za-z0-9]{22}$/.test(id)) return null;
    return { provider: "spotify", url: `https://open.spotify.com/${kind}/${id}`, embedUrl: `https://open.spotify.com/embed/${kind}/${id}` };
  }

  let videoId: string | null = null;
  if (host === "youtu.be") videoId = parts[0] ?? null;
  else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (parts[0] === "watch") videoId = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") videoId = parts[1] ?? null;
  }
  if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
  const music = host === "music.youtube.com";
  return {
    provider: "youtube",
    url: music ? `https://music.youtube.com/watch?v=${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
  };
}

/** Enlaces cortos que hay que seguir para saber a qué canción llevan. */
export function isShortSongLink(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return host === "spotify.link" || host === "spotify.app.link";
  } catch {
    return false;
  }
}
