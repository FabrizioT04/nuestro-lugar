import { describe, expect, it } from "vitest";
import { isShortSongLink, parseSongLink } from "./songs";

describe("enlaces de canciones", () => {
  it("limpia los enlaces de Spotify y arma su reproductor", () => {
    expect(parseSongLink("https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123")).toEqual({
      provider: "spotify",
      url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      embedUrl: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
    });
    expect(parseSongLink("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")?.embedUrl).toBe(
      "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
    );
  });

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42",
    "https://youtu.be/dQw4w9WgXcQ?si=xyz",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])("reconoce el video de %s", (link) => {
    expect(parseSongLink(link)).toEqual({
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("YouTube Music se abre en YouTube Music", () => {
    expect(parseSongLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share")?.url).toBe("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it.each(["", "hola", "https://example.com/track/4uLU6hMCjMI75M1A2tKUQC", "https://open.spotify.com/track/corto", "javascript:alert(1)", "https://youtube.com/watch?v=<script>"])(
    "rechaza %s",
    (link) => expect(parseSongLink(link)).toBeNull(),
  );

  it("detecta los enlaces cortos de Spotify", () => {
    expect(isShortSongLink("https://spotify.link/AbCdEf")).toBe(true);
    expect(isShortSongLink("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBe(false);
  });
});
