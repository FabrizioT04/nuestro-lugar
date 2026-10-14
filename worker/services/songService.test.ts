import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createFakeD1 } from "../testing/fakeD1";
import { getHome } from "./homeService";
import { createSong, deleteSong, listSongs, markSongListened, setSongLoved } from "./songService";

const person = (id: string, displayName: string, relationshipId = "r1"): AuthenticatedUser => ({
  id, email: `${id}@example.com`, displayName, introSeenAt: null, relationshipId,
});
const zuleyka = person("zuleyka", "Zuleyka");
const fabrizio = person("fabrizio", "Fabrizio");
const stranger = person("stranger", "Otra", "other");

const SPOTIFY = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc";

/** oEmbed de mentira: responde como Spotify/YouTube y anota lo que se pidió. */
function fakeFetch(requests: string[], ok = true): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url === "https://spotify.link/AbCdEf") {
      const response = new Response("");
      Object.defineProperty(response, "url", { value: "https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6?si=z" });
      return response;
    }
    if (url === "https://spotify.link/EnPagina") {
      return new Response('<a href="https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b?si=q&amp;x=1">abrir</a>');
    }
    if (!ok) return new Response("no", { status: 500 });
    if (url.includes("youtube.com/oembed")) {
      return Response.json({ title: "Ojitos Lindos", author_name: "Bad Bunny - Topic", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" });
    }
    return Response.json({ title: "Never Gonna Give You Up", thumbnail_url: "https://image-cdn-ak.spotifycdn.com/image/x" });
  }) as typeof fetch;
}

describe("canciones", () => {
  let env: Bindings;
  let requests: string[];

  beforeEach(async () => {
    const db = createFakeD1();
    requests = [];
    env = { DB: db } as unknown as Bindings;
    await db.exec(`
      INSERT INTO users (id, email, display_name) VALUES
        ('zuleyka', 'zuleyka@example.com', 'Zuleyka'), ('fabrizio', 'fabrizio@example.com', 'Fabrizio'),
        ('stranger', 'stranger@example.com', 'Otra');
      INSERT INTO relationships (id, started_on, timezone) VALUES
        ('r1', '2025-01-01', 'America/Lima'), ('other', '2025-01-01', 'America/Lima');
      INSERT INTO relationship_members (relationship_id, user_id) VALUES
        ('r1', 'zuleyka'), ('r1', 'fabrizio'), ('other', 'stranger');
    `);
  });

  it("guarda el enlace limpio con título y portada, y la ven los dos pero no otra pareja", async () => {
    const song = await createSong(env, zuleyka, { url: SPOTIFY, note: "Para ti" }, fakeFetch(requests));
    expect(song).toMatchObject({
      provider: "spotify",
      url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      embedUrl: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
      title: "Never Gonna Give You Up",
      thumbnailUrl: "https://image-cdn-ak.spotifycdn.com/image/x",
      note: "Para ti",
      isMine: true,
      listenedAt: null,
      loved: false,
    });
    expect(requests[0]).toContain("open.spotify.com/oembed");

    const seenByPartner = await listSongs(env, fabrizio);
    expect(seenByPartner.items).toHaveLength(1);
    expect(seenByPartner.items[0]?.isMine).toBe(false);
    expect((await listSongs(env, stranger)).items).toEqual([]);
  });

  it("de YouTube toma el artista del canal", async () => {
    const song = await createSong(env, zuleyka, { url: "https://youtu.be/dQw4w9WgXcQ", note: null }, fakeFetch(requests));
    expect(song).toMatchObject({ provider: "youtube", title: "Ojitos Lindos", artist: "Bad Bunny", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("sigue los enlaces cortos de Spotify", async () => {
    const song = await createSong(env, zuleyka, { url: "https://spotify.link/AbCdEf", note: null }, fakeFetch(requests));
    expect(song.url).toBe("https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6");
    const fromPage = await createSong(env, zuleyka, { url: "https://spotify.link/EnPagina", note: null }, fakeFetch(requests));
    expect(fromPage.url).toBe("https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b");
  });

  it("si el servicio no responde, la guarda igual sin título", async () => {
    const song = await createSong(env, zuleyka, { url: SPOTIFY, note: null }, fakeFetch(requests, false));
    expect(song.title).toBeNull();
    expect(song.thumbnailUrl).toBeNull();
  });

  it("rechaza enlaces que no son de Spotify ni YouTube", async () => {
    await expect(createSong(env, zuleyka, { url: "https://example.com/cancion", note: null }, fakeFetch(requests))).rejects.toMatchObject({ status: 400 });
    expect(requests).toEqual([]);
  });

  it("el globito cuenta las canciones sin escuchar de la otra persona hasta abrirlas", async () => {
    const song = await createSong(env, zuleyka, { url: SPOTIFY, note: null }, fakeFetch(requests));
    await createSong(env, fabrizio, { url: SPOTIFY, note: null }, fakeFetch(requests));
    expect((await getHome(env, fabrizio)).badges.songs).toBe(1);
    expect((await getHome(env, zuleyka)).badges.songs).toBe(1);

    const listened = await markSongListened(env, fabrizio, song.id);
    expect(listened.listenedAt).not.toBeNull();
    expect((await getHome(env, fabrizio)).badges.songs).toBe(0);
  });

  it("solo quien la recibió la marca como escuchada o dice que le encantó", async () => {
    const song = await createSong(env, zuleyka, { url: SPOTIFY, note: null }, fakeFetch(requests));
    await expect(markSongListened(env, zuleyka, song.id)).rejects.toMatchObject({ status: 403 });
    await expect(setSongLoved(env, zuleyka, song.id, true)).rejects.toMatchObject({ status: 403 });
    await expect(setSongLoved(env, stranger, song.id, true)).rejects.toMatchObject({ status: 404 });

    const first = await setSongLoved(env, fabrizio, song.id, true);
    expect(first).toMatchObject({ newlyLoved: true, song: { loved: true } });
    expect(first.song.listenedAt).not.toBeNull();
    expect((await setSongLoved(env, fabrizio, song.id, true)).newlyLoved).toBe(false);
    expect((await setSongLoved(env, fabrizio, song.id, false)).song.loved).toBe(false);
  });

  it("solo quien la recomendó puede quitarla", async () => {
    const song = await createSong(env, zuleyka, { url: SPOTIFY, note: null }, fakeFetch(requests));
    await expect(deleteSong(env, fabrizio, song.id)).rejects.toMatchObject({ status: 403 });
    await deleteSong(env, zuleyka, song.id);
    expect((await listSongs(env, fabrizio)).items).toEqual([]);
  });
});
