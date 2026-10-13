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
  badges: { memories: 0, letters: 0, plans: 0, future: 0, us: 0, drawings: 0, plant: 0 },
};

function renderHome(data: Omit<HomeResponse, "pending" | "badges"> & Partial<Pick<HomeResponse, "pending" | "badges">>) {
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
    const html = renderHome({ ...home, badges: { memories: 2, letters: 1, plans: 0, future: 12, us: 0, drawings: 0, plant: 0 } });
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

describe("gota de la plantita", () => {
  it("avisa con una gota si hoy falta regarla", () => {
    const html = renderHome({ ...home, badges: { ...home.badges, plant: 1 } });
    expect(html).toContain('data-testid="water-badge"');
    expect(html).toContain('aria-label="Plantita, hoy falta regarla"');
    expect(html).not.toContain("count-badge");
  });
});
