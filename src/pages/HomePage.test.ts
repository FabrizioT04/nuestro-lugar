import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { HomeResponse } from "@shared/api";
import { useAsync } from "@/hooks/useAsync";
import { HomePage } from "./HomePage";

vi.mock("@/hooks/useAsync", () => ({ useAsync: vi.fn() }));

const home: HomeResponse = {
  relationship: {
    id: "r1", name: "Nuestro Lugar", startedOn: "2025-01-01", timezone: "America/Lima",
    coverMediaId: null, members: [],
  },
  today: "2026-10-13", together: { days: 650, years: 1, months: 9 },
  nextMoment: null, highlightedMemory: null, unopenedLetters: 0, pending: [],
  badges: { memories: 0, letters: 0, plans: 0, future: 0, us: 0, drawings: 0, songs: 0 },
  corners: {
    memories: { count: 0, photos: [] }, letters: { count: 0 }, plans: { pending: 0, done: 0, nextOn: null },
    future: { count: 0 }, us: { count: 0 }, drawings: { count: 0, latestId: null }, songs: { count: 0, latest: null },
  },
};

function renderHome(data: Omit<HomeResponse, "pending" | "badges" | "corners"> & Partial<Pick<HomeResponse, "pending" | "badges" | "corners">>) {
  vi.mocked(useAsync).mockReturnValue({ status: "success", data, stale: true, reload: vi.fn() });
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(HomePage)));
}

describe("pendientes de Inicio con copias antiguas", () => {
  it.each([1, 2])("conserva el aviso de %i cartas cuando falta pending", (count) => {
    const { pending: _pending, badges: _badges, ...legacy } = home;
    const html = renderHome({ ...legacy, unopenedLetters: count });
    expect(html).toContain(count === 1 ? "Tienes una carta sin abrir" : "Tienes 2 cartas sin abrir");
    expect(html).toContain('href="/cartas"');
    expect(html).not.toContain("Todo abierto");
  });

  it("no da por abiertas las cápsulas desconocidas aunque no hubiera cartas", () => {
    const { pending: _pending, badges: _badges, ...legacy } = home;
    const html = renderHome(legacy);
    expect(html).not.toContain("Todo abierto");
    expect(html).not.toContain("No tienen cartas ni cápsulas pendientes");
    expect(html).toContain("Conéctate para actualizar");
  });

  it("muestra Todo abierto cuando la respuesta sí incluye una lista vacía", () => {
    expect(renderHome(home)).toContain("Todo abierto");
  });

  it("sigue mostrando los elementos de una copia con el campo pending", () => {
    const html = renderHome({ ...home, pending: [
      { kind: "letter", id: "l1", title: "Para ti", from: "Fabrizio", isLocked: false, unlockAt: null },
    ] });
    expect(html).toContain("Para ti");
    expect(html).toContain('href="/cartas/l1"');
    expect(html).not.toContain("Todo abierto");
  });
});

describe("globitos de novedades en los rincones", () => {
  it("pone el número encima de cada rincón con novedades", () => {
    const html = renderHome({ ...home, badges: { memories: 2, letters: 1, plans: 0, future: 12, us: 0, drawings: 0, songs: 0 } });
    expect(html.match(/data-testid="count-badge"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Recuerdos, 2 novedades"');
    expect(html).toContain('aria-label="Cartas, 1 novedad"');
    expect(html).toContain(">9+</span>");
    expect(html).not.toContain('aria-label="Planes');
  });

  it("sin novedades no muestra globitos", () => {
    expect(renderHome(home)).not.toContain("count-badge");
  });

  it("con una copia antigua sin badges, solo marca las cartas sin abrir", () => {
    const { badges: _badges, ...legacy } = home;
    const html = renderHome({ ...legacy, unopenedLetters: 2 });
    expect(html.match(/data-testid="count-badge"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Cartas, 2 novedades"');
  });
});

describe("lo que se asoma en los rincones", () => {
  it("muestra sus fotos, su último dibujo y la última canción", () => {
    const html = renderHome({
      ...home,
      corners: {
        ...home.corners,
        memories: { count: 14, photos: [{ id: "f1", width: 800, height: 600 }, { id: "f2", width: null, height: null }] },
        drawings: { count: 3, latestId: "d1" },
        songs: { count: 2, latest: { title: "Te Amo", artist: "Franco de Vita", thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg" } },
        letters: { count: 8 },
      },
    });
    expect(html).toContain("/media/f1?size=thumb");
    expect(html).toContain("/media/f2?size=thumb");
    expect(html).toContain("/drawings/d1/image?size=thumb");
    expect(html).toContain("https://i.ytimg.com/vi/x/hqdefault.jpg");
    expect(html).toContain("14 recuerdos");
    expect(html).toContain("Te Amo · Franco de Vita");
    expect(html).toContain("8 cartas");
  });

  it("sin contenido invita a empezar", () => {
    const html = renderHome(home);
    expect(html).toContain("Guarden el primero");
    expect(html).toContain("Recomiéndense una");
  });

  it("con una copia antigua sin corners no se rompe", () => {
    const { corners: _corners, ...legacy } = home;
    expect(renderHome(legacy)).toContain("Nuestros rincones");
  });

  it("las novedades tienen prioridad sobre la vista previa", () => {
    const html = renderHome({ ...home, badges: { ...home.badges, letters: 1 }, corners: { ...home.corners, letters: { count: 8 } } });
    expect(html).toContain("1 novedad");
    expect(html).not.toContain("8 cartas");
  });
});
