import type { Song, SongListResponse } from "@shared/api";
import { isShortSongLink, parseSongLink, type ParsedSongLink } from "@shared/songs";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createSongRepository, type SongRow } from "../repositories/songRepository";
import { badRequest, forbidden, notFound } from "../utils/errors";

// Canciones que uno le recomienda al otro (Spotify o YouTube). El título y la portada se piden
// una sola vez al guardarla; si el servicio no responde, se guarda igual con el enlace.

const LIST_LIMIT = 200;
const LOOKUP_TIMEOUT_MS = 4000;
const NOT_A_SONG = "Pega un enlace de Spotify o YouTube (en la app de música: Compartir → Copiar enlace)";

export function toSong(row: SongRow, viewerId: string): Song {
  const parsed = parseSongLink(row.url);
  return {
    id: row.id,
    provider: row.provider,
    url: row.url,
    embedUrl: parsed?.embedUrl ?? row.url,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnail_url,
    note: row.note,
    author: { id: row.author_id, displayName: row.author_name },
    isMine: row.author_id === viewerId,
    listenedAt: row.listened_at,
    loved: row.loved === 1,
    createdAt: row.created_at,
  };
}

export async function listSongs(env: Bindings, user: AuthenticatedUser): Promise<SongListResponse> {
  const rows = await createSongRepository(env.DB).list(user.relationshipId!, LIST_LIMIT);
  return { items: rows.map((row) => toSong(row, user.id)) };
}

/** spotify.link/… solo dice a qué canción lleva después de seguir la redirección. */
async function resolveLink(raw: string, fetcher: typeof fetch): Promise<ParsedSongLink | null> {
  const direct = parseSongLink(raw);
  if (direct || !isShortSongLink(raw)) return direct;
  try {
    const response = await fetcher(raw.trim(), { redirect: "follow", signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    const followed = parseSongLink(response.url);
    if (followed) return followed;
    // A veces la página intermedia redirige con JavaScript: el enlace real viene dentro del HTML.
    const inPage = (await response.text()).match(/https:\/\/open\.spotify\.com\/[^"'\s<>\\]+/);
    return inPage ? parseSongLink(inPage[0]) : null;
  } catch {
    return null;
  }
}

interface OEmbed {
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
}

const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

/** Título, artista y portada desde el oEmbed público de cada servicio (no necesita claves). */
export async function lookupSong(link: ParsedSongLink, fetcher: typeof fetch = fetch): Promise<OEmbed> {
  const endpoint =
    link.provider === "spotify"
      ? `https://open.spotify.com/oembed?url=${encodeURIComponent(link.url)}`
      : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`;
  try {
    const response = await fetcher(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) return { title: null, artist: null, thumbnailUrl: null };
    const data = (await response.json()) as Record<string, unknown>;
    const thumbnail = text(data.thumbnail_url, 500);
    return {
      title: text(data.title, 200),
      // YouTube pone el canal; en "Artista - Topic" el canal es el artista.
      artist: text(typeof data.author_name === "string" ? data.author_name.replace(/ - Topic$/, "") : null, 200),
      thumbnailUrl: thumbnail?.startsWith("https://") ? thumbnail : null,
    };
  } catch {
    return { title: null, artist: null, thumbnailUrl: null };
  }
}

export async function createSong(env: Bindings, user: AuthenticatedUser, input: { url: string; note: string | null }, fetcher: typeof fetch = fetch): Promise<Song> {
  const link = await resolveLink(input.url, fetcher);
  if (!link) throw badRequest(NOT_A_SONG);
  const info = await lookupSong(link, fetcher);

  const relationshipId = user.relationshipId!;
  const repository = createSongRepository(env.DB);
  const id = crypto.randomUUID();
  await repository.insert({ id, relationshipId, authorId: user.id, provider: link.provider, url: link.url, ...info, note: input.note });
  const row = await repository.find(relationshipId, id);
  if (!row) throw notFound("Canción no encontrada");
  return toSong(row, user.id);
}

/** Solo cuenta lo que hace quien la recibió: quien la recomendó ya la conoce. */
async function findForListener(env: Bindings, user: AuthenticatedUser, id: string): Promise<SongRow> {
  const row = await createSongRepository(env.DB).find(user.relationshipId!, id);
  if (!row) throw notFound("Canción no encontrada");
  if (row.author_id === user.id) throw forbidden("Esta canción la recomendaste tú");
  return row;
}

export async function markSongListened(env: Bindings, user: AuthenticatedUser, id: string): Promise<Song> {
  await findForListener(env, user, id);
  const repository = createSongRepository(env.DB);
  await repository.markListened(user.relationshipId!, id, new Date().toISOString());
  return toSong((await repository.find(user.relationshipId!, id))!, user.id);
}

/** Devuelve también si antes no le encantaba, para avisar solo la primera vez. */
export async function setSongLoved(env: Bindings, user: AuthenticatedUser, id: string, loved: boolean): Promise<{ song: Song; newlyLoved: boolean }> {
  const before = await findForListener(env, user, id);
  const repository = createSongRepository(env.DB);
  await repository.setLoved(user.relationshipId!, id, loved, new Date().toISOString());
  return { song: toSong((await repository.find(user.relationshipId!, id))!, user.id), newlyLoved: loved && before.loved === 0 };
}

/** Solo quien la recomendó puede quitarla. */
export async function deleteSong(env: Bindings, user: AuthenticatedUser, id: string): Promise<void> {
  const repository = createSongRepository(env.DB);
  const row = await repository.find(user.relationshipId!, id);
  if (!row) throw notFound("Canción no encontrada");
  if (row.author_id !== user.id) throw forbidden("Solo quien la recomendó puede quitarla");
  await repository.softDelete(user.relationshipId!, id, new Date().toISOString());
}
